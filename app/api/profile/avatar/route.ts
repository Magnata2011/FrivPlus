import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const MAX_AVATAR_SIZE = 3 * 1024 * 1024;

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function getImageType(bytes: Uint8Array) {
  const isPng = [137, 80, 78, 71, 13, 10, 26, 10]
    .every((value, index) => bytes[index] === value);
  if (isPng) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
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
    console.error("Não foi possível validar a sessão ao enviar o avatar.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: "Entre para atualizar sua foto de perfil." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie um arquivo de imagem válido." }, { status: 400 });
  }
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: "Escolha uma imagem de até 3 MB." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = getImageType(bytes);
  if (!contentType) {
    return NextResponse.json(
      { error: "Use uma imagem PNG, JPG ou WebP válida." },
      { status: 400 },
    );
  }

  const avatarPath = `${user.id}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(avatarPath, file, {
      cacheControl: "0",
      contentType,
      upsert: true,
    });
  if (uploadError) {
    console.error("Não foi possível enviar o avatar do usuário.", uploadError);
    return NextResponse.json(
      { error: "Não foi possível enviar a foto. Verifique a migration de avatares." },
      { status: 500 },
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("id", user.id)
    .select("id")
    .single();
  if (profileError) {
    console.error("Não foi possível associar o avatar ao perfil.", profileError);
    return NextResponse.json(
      { error: "A imagem foi enviada, mas não foi possível atualizar o perfil." },
      { status: 500 },
    );
  }

  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(avatarPath);
  const url = new URL(publicUrl.publicUrl);
  url.searchParams.set("v", Date.now().toString());
  return NextResponse.json({ avatarUrl: url.toString() });
}
