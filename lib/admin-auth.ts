import "server-only";

import { NextResponse } from "next/server";
import { createServiceRoleClient, createSupabaseServerClient } from "@/lib/supabase/server";

function normalizedAdminEmails() {
  return [process.env.FRIV_ADMIN_EMAIL_1, process.env.FRIV_ADMIN_EMAIL_2]
    .map((email) => email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
}

export function isAuthorizedAdmin(email: string | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  return Boolean(
    normalizedEmail &&
      normalizedAdminEmails().some((allowedEmail) => allowedEmail === normalizedEmail),
  );
}

export type AdminContext =
  | { client: ReturnType<typeof createServiceRoleClient> }
  | { response: NextResponse };

export async function authorizeAdminRequest(): Promise<AdminContext> {
  let authClient;
  try {
    authClient = await createSupabaseServerClient();
  } catch {
    return {
      response: NextResponse.json(
        { error: "A autenticação ainda não foi configurada." },
        { status: 503 },
      ),
    };
  }

  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    return {
      response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }),
    };
  }

  if (normalizedAdminEmails().length === 0) {
    return {
      response: NextResponse.json(
        { error: "A administração ainda não foi configurada." },
        { status: 503 },
      ),
    };
  }

  if (!isAuthorizedAdmin(data.user.email)) {
    return {
      response: NextResponse.json({ error: "Acesso negado." }, { status: 403 }),
    };
  }

  try {
    return { client: createServiceRoleClient() };
  } catch {
    return {
      response: NextResponse.json(
        { error: "A administração ainda não foi configurada." },
        { status: 503 },
      ),
    };
  }
}

export async function getAdminPageStatus() {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return "signed-out" as const;
    return isAuthorizedAdmin(data.user.email) ? ("allowed" as const) : ("denied" as const);
  } catch {
    return "unavailable" as const;
  }
}

export async function getCurrentUserStatus() {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { signedIn: false, isAdmin: false } as const;
    return {
      signedIn: true,
      isAdmin: isAuthorizedAdmin(data.user.email),
    } as const;
  } catch {
    return { signedIn: false, isAdmin: false } as const;
  }
}
