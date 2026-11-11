import { NextResponse } from "next/server";
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados de confirmação inválidos." }, { status: 400 });
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("username" in payload) ||
    typeof payload.username !== "string" ||
    !("confirmed" in payload) ||
    payload.confirmed !== true
  ) {
    return NextResponse.json({ error: "Confirme a exclusão e informe o nome de usuário." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão antes de excluir a conta.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: "Entre para excluir sua conta." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, avatar_path, banner_path")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    console.error("Não foi possível verificar o perfil antes da exclusão.", profileError);
    return NextResponse.json({ error: "Não foi possível verificar seu perfil." }, { status: 500 });
  }

  const expectedUsername = `@${profile.username ?? "sem_usuario"}`;
  if (payload.username !== expectedUsername) {
    return NextResponse.json({ error: "O nome de usuário digitado não corresponde à sua conta." }, { status: 400 });
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para habilitar a exclusão segura de contas." },
      { status: 503 },
    );
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const avatarPath = profile.avatar_path ? [profile.avatar_path] : [];
  const bannerPath = profile.banner_path ? [profile.banner_path] : [];

  if (avatarPath.length > 0) {
    const { error } = await serviceClient.storage.from("avatars").remove(avatarPath);
    if (error) {
      console.error("Não foi possível remover o avatar antes de excluir a conta.", error);
      return NextResponse.json({ error: "Não foi possível remover sua foto de perfil. A conta não foi excluída." }, { status: 500 });
    }
  }
  if (bannerPath.length > 0) {
    const { error } = await serviceClient.storage.from("profile-banners").remove(bannerPath);
    if (error) {
      console.error("Não foi possível remover o banner antes de excluir a conta.", error);
      return NextResponse.json({ error: "Não foi possível remover seu banner. A conta não foi excluída." }, { status: 500 });
    }
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Não foi possível excluir a conta no Supabase Auth.", deleteError);
    return NextResponse.json(
      { error: "Não foi possível excluir a conta. As imagens foram removidas; tente novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({ deleted: true });
}
