import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeAdminRequest } from "@/lib/admin-auth";
import { coverExtension, parseGameInput } from "@/lib/game-validation";

export const dynamic = "force-dynamic";

const BUCKET = "game-assets";
const GAME_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const context = await authorizeAdminRequest();
  if ("response" in context) return context.response;

  const { id } = await params;
  if (!GAME_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }
  const input = await parseGameInput(form);
  if (typeof input === "string") {
    return NextResponse.json({ error: input }, { status: 400 });
  }

  const { data: existing, error: readError } = await context.client
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "Não foi possível carregar o jogo." }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });
  }

  const uploadedPaths: string[] = [];
  let coverPath = existing.cover_path;
  let coverUrl = existing.cover_url;
  let gameFilePath = existing.game_file_path;
  let gameUrl = existing.game_url;

  if (input.cover) {
    coverPath = `covers/${id}-${crypto.randomUUID()}.${coverExtension(input.cover)}`;
    const upload = await context.client.storage.from(BUCKET).upload(coverPath, input.cover, {
      contentType: input.cover.type,
      upsert: false,
    });
    if (upload.error) {
      return NextResponse.json({ error: "Não foi possível armazenar a nova capa." }, { status: 500 });
    }
    uploadedPaths.push(coverPath);
    coverUrl = null;
  } else if (input.coverUrl) {
    coverPath = null;
    coverUrl = input.coverUrl;
  }

  if (input.gameFile) {
    gameFilePath = `games/${id}-${crypto.randomUUID()}.html`;
    const upload = await context.client.storage
      .from(BUCKET)
      .upload(gameFilePath, input.gameFile, { contentType: "text/html", upsert: false });
    if (upload.error) {
      await removeUploads(context.client, uploadedPaths);
      return NextResponse.json({ error: "Não foi possível armazenar o novo arquivo do jogo." }, { status: 500 });
    }
    uploadedPaths.push(gameFilePath);
    gameUrl = null;
  } else if (input.gameUrl) {
    gameFilePath = null;
    gameUrl = input.gameUrl;
  }

  const { data: updated, error: updateError } = await context.client
    .from("games")
    .update({
      title: input.title,
      description: input.description,
      cover_path: coverPath,
      cover_url: coverUrl,
      category: input.category,
      tags: input.tags,
      featured: input.featured,
      published: input.published,
      game_file_path: gameFilePath,
      game_url: gameUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updated) {
    const cleanup = await removeUploads(context.client, uploadedPaths);
    return NextResponse.json(
      {
        error: cleanup
          ? "O jogo não foi atualizado e alguns arquivos temporários precisam de limpeza."
          : "Não foi possível atualizar o jogo.",
      },
      { status: 500 },
    );
  }

  const obsoletePaths = [
    ...(coverPath !== existing.cover_path && existing.cover_path ? [existing.cover_path] : []),
    ...(gameFilePath !== existing.game_file_path && existing.game_file_path
      ? [existing.game_file_path]
      : []),
  ];
  const cleanup = await removeUploads(context.client, obsoletePaths);
  return NextResponse.json({
    game: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      tags: updated.tags,
      featured: updated.featured,
      published: updated.published,
      coverPath: updated.cover_path,
      coverExternalUrl: updated.cover_url,
      gameFilePath: updated.game_file_path,
      externalGameUrl: updated.game_url,
      coverUrl: updated.cover_url ??
        (updated.cover_path ? await signedUrl(context.client, updated.cover_path) : ""),
      gameUrl:
        updated.game_url ??
        (updated.game_file_path ? await signedUrl(context.client, updated.game_file_path) : ""),
    },
    ...(cleanup ? { warning: "O jogo foi atualizado, mas um arquivo antigo não pôde ser removido." } : {}),
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const context = await authorizeAdminRequest();
  if ("response" in context) return context.response;

  const { id } = await params;
  if (!GAME_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  const { data: existing, error: readError } = await context.client
    .from("games")
    .select("cover_path,game_file_path")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "Não foi possível carregar o jogo." }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });
  }

  const { error: deleteError } = await context.client.from("games").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: "Não foi possível excluir o jogo." }, { status: 500 });
  }

  const cleanup = await removeUploads(
    context.client,
    [existing.cover_path, existing.game_file_path].filter(
      (path): path is string => Boolean(path),
    ),
  );
  return NextResponse.json({
    deleted: true,
    ...(cleanup ? { warning: "O jogo foi excluído, mas um arquivo antigo não pôde ser removido." } : {}),
  });
}

async function signedUrl(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error("Não foi possível gerar a prévia do arquivo.");
  }
  return data.signedUrl;
}

async function removeUploads(
  client: SupabaseClient,
  paths: string[],
) {
  if (paths.length === 0) return false;
  const { error } = await client.storage.from(BUCKET).remove(paths);
  return Boolean(error);
}
