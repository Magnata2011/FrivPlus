import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão ao carregar o perfil.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: "Entre para acessar seu perfil." }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_path, theme, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.error("Não foi possível carregar o perfil do usuário.", error);
    return NextResponse.json(
      { error: "Perfil não encontrado. Tente sair e entrar novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      profile,
      account: {
        email: user.email ?? null,
        emailVerified: Boolean(user.email_confirmed_at),
        createdAt: user.created_at,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados do perfil inválidos." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Dados do perfil inválidos." }, { status: 400 });
  }

  const values = payload as Record<string, unknown>;
  const profileFieldsPresent = ["username", "displayName", "bio"].some((key) => key in values);
  const updates: {
    username?: string | null;
    display_name?: string;
    bio?: string;
    theme?: "dark" | "light";
  } = {};

  if (profileFieldsPresent) {
    if (
      typeof values.username !== "string" ||
      typeof values.displayName !== "string" ||
      typeof values.bio !== "string"
    ) {
      return NextResponse.json({ error: "Preencha os campos do perfil corretamente." }, { status: 400 });
    }

    const username = values.username.trim().toLowerCase();
    const displayName = values.displayName.trim();
    const bio = values.bio.trim();
    if (username && !/^[a-z0-9_]{3,24}$/.test(username)) {
      return NextResponse.json(
        { error: "O usuário deve ter de 3 a 24 letras, números ou sublinhados." },
        { status: 400 },
      );
    }
    if (displayName.length > 60 || bio.length > 500) {
      return NextResponse.json({ error: "Nome ou biografia acima do limite permitido." }, { status: 400 });
    }
    updates.username = username || null;
    updates.display_name = displayName;
    updates.bio = bio;
  }

  if ("theme" in values) {
    if (values.theme !== "dark" && values.theme !== "light") {
      return NextResponse.json({ error: "Escolha um tema válido." }, { status: 400 });
    }
    updates.theme = values.theme;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração válida foi enviada." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão ao atualizar o perfil.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: "Entre para atualizar seu perfil." }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id, username, display_name, bio, theme, created_at, updated_at")
    .single();

  if (error || !profile) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Esse nome de usuário já está em uso." }, { status: 409 });
    }
    console.error("Não foi possível salvar o perfil do usuário.", error);
    return NextResponse.json({ error: "Não foi possível salvar o perfil." }, { status: 500 });
  }

  return NextResponse.json({ profile, theme: profile.theme });
}
