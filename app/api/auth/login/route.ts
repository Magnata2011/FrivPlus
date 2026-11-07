import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 });
  }

  if (
    typeof credentials.email !== "string" ||
    typeof credentials.password !== "string" ||
    !credentials.email.trim() ||
    !credentials.password
  ) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
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

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email.trim(),
    password: credentials.password,
  });
  if (error) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  return NextResponse.json({ signedIn: true });
}
