import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKET = "profile-assets";
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_BANNER_SIZE = 2.5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 3.5 * 1024 * 1024;

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string;
  avatar_path: string | null;
  banner_path: string | null;
};

async function getAuthenticatedClient() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, user: data.user };
}

async function ensureProfile(client: SupabaseClient, user: User) {
  const { data: existing, error: readError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) return { error: true as const };
  if (existing) return { profile: existing as ProfileRow };

  const { data: created, error: insertError } = await client
    .from("profiles")
    .insert({
      id: user.id,
      display_name: String(user.user_metadata.name ?? "").slice(0, 60),
    })
    .select("*")
    .single();
  if (insertError || !created) return { error: true as const };
  return { profile: created as ProfileRow };
}

async function serializeProfile(client: SupabaseClient, profile: ProfileRow) {
  const [avatar, banner] = await Promise.all([
    profile.avatar_path
      ? client.storage.from(BUCKET).createSignedUrl(profile.avatar_path, 60 * 60)
      : Promise.resolve({ data: { signedUrl: null }, error: null }),
    profile.banner_path
      ? client.storage.from(BUCKET).createSignedUrl(profile.banner_path, 60 * 60)
      : Promise.resolve({ data: { signedUrl: null }, error: null }),
  ]);
  if (avatar.error || banner.error) {
    throw new Error("Não foi possível carregar as imagens do perfil.");
  }
  return {
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: avatar.data.signedUrl,
    bannerUrl: banner.data.signedUrl,
  };
}

export async function GET() {
  let session;
  try {
    session = await getAuthenticatedClient();
  } catch {
    return NextResponse.json({ error: "Autenticação indisponível." }, { status: 503 });
  }
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const result = await ensureProfile(session.client, session.user);
  if (!result.profile) {
    return NextResponse.json({ error: "Não foi possível carregar o perfil." }, { status: 500 });
  }

  try {
    return NextResponse.json(
      { profile: await serializeProfile(session.client, result.profile) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as imagens do perfil." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let session;
  try {
    session = await getAuthenticatedClient();
  } catch {
    return NextResponse.json({ error: "Autenticação indisponível." }, { status: 503 });
  }
  if (!session) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }

  const usernameValue = String(form.get("username") ?? "").trim();
  const displayName = String(form.get("displayName") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const avatarValue = form.get("avatar");
  const bannerValue = form.get("banner");
  const avatar = avatarValue instanceof File && avatarValue.size > 0 ? avatarValue : null;
  const banner = bannerValue instanceof File && bannerValue.size > 0 ? bannerValue : null;

  if (usernameValue && !/^[A-Za-z0-9_]{3,24}$/.test(usernameValue)) {
    return NextResponse.json({ error: "O usuário deve ter de 3 a 24 letras, números ou sublinhados." }, { status: 400 });
  }
  if (displayName.length > 60 || bio.length > 500) {
    return NextResponse.json({ error: "Nome ou biografia acima do limite permitido." }, { status: 400 });
  }
  if (avatar && !(await isValidImage(avatar, MAX_AVATAR_SIZE))) {
    return NextResponse.json({ error: "A foto deve ser JPEG, PNG ou WebP, válida e ter até 2 MB." }, { status: 400 });
  }
  if (banner && !(await isValidImage(banner, MAX_BANNER_SIZE))) {
    return NextResponse.json({ error: "O banner deve ser JPEG, PNG ou WebP, válido e ter até 2,5 MB." }, { status: 400 });
  }
  if ((avatar?.size ?? 0) + (banner?.size ?? 0) > MAX_TOTAL_IMAGE_SIZE) {
    return NextResponse.json({ error: "Foto e banner devem somar no máximo 3,5 MB." }, { status: 400 });
  }

  const current = await ensureProfile(session.client, session.user);
  if (!current.profile) {
    return NextResponse.json({ error: "Não foi possível carregar o perfil." }, { status: 500 });
  }
  const oldProfile = current.profile;
  const uploaded: string[] = [];
  let avatarPath = oldProfile.avatar_path;
  let bannerPath = oldProfile.banner_path;

  if (avatar) {
    const path = `${session.user.id}/avatar-${randomUUID()}.${IMAGE_TYPES[avatar.type]}`;
    const { error } = await session.client.storage.from(BUCKET).upload(path, avatar, {
      contentType: avatar.type,
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: "Não foi possível armazenar a foto de perfil." }, { status: 500 });
    }
    uploaded.push(path);
    avatarPath = path;
  }
  if (banner) {
    const path = `${session.user.id}/banner-${randomUUID()}.${IMAGE_TYPES[banner.type]}`;
    const { error } = await session.client.storage.from(BUCKET).upload(path, banner, {
      contentType: banner.type,
      upsert: false,
    });
    if (error) {
      await removePaths(session.client, uploaded);
      return NextResponse.json({ error: "Não foi possível armazenar o banner." }, { status: 500 });
    }
    uploaded.push(path);
    bannerPath = path;
  }

  const { data: updated, error: updateError } = await session.client
    .from("profiles")
    .update({
      username: usernameValue || null,
      display_name: displayName,
      bio,
      avatar_path: avatarPath,
      banner_path: bannerPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    await removePaths(session.client, uploaded);
    const duplicate = updateError?.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "Esse nome de usuário já está em uso." : "Não foi possível salvar o perfil." },
      { status: duplicate ? 409 : 500 },
    );
  }

  const obsoletePaths = [
    ...(avatarPath !== oldProfile.avatar_path && oldProfile.avatar_path
      ? [oldProfile.avatar_path]
      : []),
    ...(bannerPath !== oldProfile.banner_path && oldProfile.banner_path
      ? [oldProfile.banner_path]
      : []),
  ];
  const cleanupFailed = await removePaths(session.client, obsoletePaths);

  try {
    return NextResponse.json({
      profile: await serializeProfile(session.client, updated as ProfileRow),
      ...(cleanupFailed ? { warning: "O perfil foi salvo, mas uma imagem antiga não pôde ser removida." } : {}),
    });
  } catch {
    return NextResponse.json({ error: "O perfil foi salvo, mas não foi possível gerar a prévia das imagens." }, { status: 500 });
  }
}

async function isValidImage(file: File, maxSize: number) {
  if (!IMAGE_TYPES[file.type] || file.size > maxSize) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

async function removePaths(client: SupabaseClient, paths: string[]) {
  if (!paths.length) return false;
  const { error } = await client.storage.from(BUCKET).remove(paths);
  return Boolean(error);
}
