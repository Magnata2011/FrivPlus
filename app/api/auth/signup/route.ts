import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function POST(request: Request) {
  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }

  if (
    typeof credentials.email !== "string" ||
    typeof credentials.password !== "string" ||
    !credentials.email.trim() ||
    credentials.password.length < 8
  ) {
    return NextResponse.json(
      { error: "Informe um e-mail válido e uma senha com pelo menos 8 caracteres." },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "A autenticação ainda não foi configurada." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email.trim(),
    password: credentials.password,
    options: {
      emailRedirectTo: new URL("/auth/callback", getSiteUrl(request.url)).toString(),
    },
  });
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível criar a conta. Verifique os dados ou tente entrar." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    data.session
      ? { signedUp: true }
      : { signedUp: true, confirmationRequired: true },
    { status: 201 },
  );
}
