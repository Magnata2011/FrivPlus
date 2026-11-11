import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
  }
  const credentials = payload as { email?: unknown; password?: unknown };

  const email = typeof credentials.email === "string" ? credentials.email.trim() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return NextResponse.json(
      { error: "Informe um e-mail válido e uma senha com pelo menos 8 caracteres." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "A autenticação ainda não foi configurada." },
      { status: 503 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json(
      { error: "Configure NEXT_PUBLIC_SITE_URL para habilitar a confirmação por e-mail." },
      { status: 503 },
    );
  }

  let emailRedirectTo: string;
  try {
    const origin = new URL(siteUrl);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
      throw new Error("Site URL must use HTTPS outside localhost.");
    }
    emailRedirectTo = new URL("/auth/callback", origin).toString();
  } catch {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL deve ser uma URL válida do site." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
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
