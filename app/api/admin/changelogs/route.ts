import { NextResponse } from "next/server";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  isSupabaseConfigured,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/server";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão administrativa.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user || !isMaintenanceAdminEmail(user.email)) {
    return NextResponse.json({ error: "Acesso restrito ao responsável pelo site." }, { status: 403 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Configure SUPABASE_SERVICE_ROLE_KEY para publicar changelogs." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados do changelog inválidos." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("title" in payload) || !("message" in payload) ||
      typeof payload.title !== "string" || typeof payload.message !== "string") {
    return NextResponse.json({ error: "Informe o título e a mensagem do changelog." }, { status: 400 });
  }

  const title = payload.title.trim();
  const message = payload.message.trim();
  if (!title || title.length > 100 || !message || message.length > 2000) {
    return NextResponse.json({ error: "Use um título de até 100 e uma mensagem de até 2000 caracteres." }, { status: 400 });
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { error } = await serviceClient.from("site_changelogs").insert({
    title,
    message,
    created_by: user.id,
  });
  if (error) {
    console.error("Não foi possível salvar o changelog.", error);
    return NextResponse.json({ error: "Não foi possível publicar o changelog." }, { status: 500 });
  }

  return NextResponse.json({ published: true }, { status: 201 });
}
