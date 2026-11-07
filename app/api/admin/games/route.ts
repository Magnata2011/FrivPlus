import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeAdminRequest } from "@/lib/admin-auth";
import { coverExtension, parseGameInput } from "@/lib/game-validation";

export const dynamic = "force-dynamic";

const BUCKET = "game-assets";

export async function GET() {
  const context = await authorizeAdminRequest();
  if ("response" in context) return context.response;

  const { data, error } = await context.client
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar os jogos." }, { status: 500 });
  }

  const games = await Promise.all(
    (data ?? []).map(async (game) => {
      let coverUrl = game.cover_url;
      if (!coverUrl && game.cover_path) {
        const cover = await context.client.storage
          .from(BUCKET)
          .createSignedUrl(game.cover_path, 60 * 60);
        if (cover.error || !cover.data?.signedUrl) return null;
        coverUrl = cover.data.signedUrl;
      }
      if (!coverUrl) return null;

      let gameUrl = game.game_url;
      if (!gameUrl && game.game_file_path) {
        const file = await context.client.storage
          .from(BUCKET)
          .createSignedUrl(game.game_file_path, 60 * 60);
        if (file.error || !file.data?.signedUrl) return null;
        gameUrl = file.data.signedUrl;
      }

      return {
        id: game.id,
        title: game.title,
        description: game.description,
        coverUrl,
        category: game.category,
        tags: game.tags,
        featured: game.featured,
        published: game.published,
        coverPath: game.cover_path,
        coverExternalUrl: game.cover_url,
        gameFilePath: game.game_file_path,
        externalGameUrl: game.game_url,
        gameUrl,
      };
    }),
  );

  if (games.some((game) => game === null)) {
    return NextResponse.json(
      { error: "Não foi possível gerar a prévia de um ou mais jogos." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { games },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const context = await authorizeAdminRequest();
  if ("response" in context) return context.response;

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
  if ((!input.cover && !input.coverUrl) || (!input.gameFile && !input.gameUrl)) {
    return NextResponse.json(
      { error: "Envie uma capa e um arquivo HTML ou uma URL HTTPS para o jogo." },
      { status: 400 },
    );
  }

  const id = input.id || randomUUID();
  const coverPath = input.cover ? `covers/${id}.${coverExtension(input.cover)}` : null;
  const gameFilePath = input.gameFile ? `games/${id}.html` : null;
  const uploadedPaths: string[] = [];

  if (input.cover && coverPath) {
    const coverUpload = await context.client.storage.from(BUCKET).upload(coverPath, input.cover, {
      contentType: input.cover.type,
      upsert: false,
    });
    if (coverUpload.error) {
      return NextResponse.json({ error: "Não foi possível armazenar a imagem de capa." }, { status: 500 });
    }
    uploadedPaths.push(coverPath);
  }

  if (input.gameFile && gameFilePath) {
    const gameUpload = await context.client.storage
      .from(BUCKET)
      .upload(gameFilePath, input.gameFile, { contentType: "text/html", upsert: false });
    if (gameUpload.error) {
      await context.client.storage.from(BUCKET).remove(uploadedPaths);
      return NextResponse.json({ error: "Não foi possível armazenar o arquivo do jogo." }, { status: 500 });
    }
    uploadedPaths.push(gameFilePath);
  }

  const { data: game, error } = await context.client
    .from("games")
    .insert({
      id,
      title: input.title,
      description: input.description,
      cover_path: coverPath,
      cover_url: input.cover ? null : input.coverUrl,
      category: input.category,
      tags: input.tags,
      featured: input.featured,
      published: input.published,
      game_file_path: gameFilePath,
      game_url: input.gameFile ? null : input.gameUrl,
    })
    .select("*")
    .single();

  if (error || !game) {
    const cleanup = await context.client.storage.from(BUCKET).remove(uploadedPaths);
    return NextResponse.json(
      {
        error: cleanup.error
          ? "O jogo não foi salvo e alguns arquivos temporários precisam de limpeza."
          : "Não foi possível salvar o jogo.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ game: await toAdminGame(context.client, game) }, { status: 201 });
}

type GameRecord = {
  id: string;
  title: string;
  description: string;
  cover_path: string | null;
  cover_url: string | null;
  category: string;
  tags: string[];
  featured: boolean;
  published: boolean;
  game_file_path: string | null;
  game_url: string | null;
};

async function toAdminGame(client: SupabaseClient, game: GameRecord) {
  let coverUrl = game.cover_url;
  if (!coverUrl && game.cover_path) {
    const cover = await client.storage.from(BUCKET).createSignedUrl(game.cover_path, 60 * 60);
    if (cover.error || !cover.data?.signedUrl) {
      throw new Error("Não foi possível gerar a prévia da capa.");
    }
    coverUrl = cover.data.signedUrl;
  }
  if (!coverUrl) throw new Error("A capa não está disponível.");

  let gameUrl = game.game_url;
  if (!gameUrl && game.game_file_path) {
    const file = await client.storage
      .from(BUCKET)
      .createSignedUrl(game.game_file_path, 60 * 60);
    if (file.error || !file.data?.signedUrl) {
      throw new Error("Não foi possível gerar a prévia do jogo.");
    }
    gameUrl = file.data.signedUrl;
  }
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    category: game.category,
    tags: game.tags,
    featured: game.featured,
    published: game.published,
    coverPath: game.cover_path,
    coverExternalUrl: game.cover_url,
    gameFilePath: game.game_file_path,
    externalGameUrl: game.game_url,
    coverUrl,
    gameUrl,
  };
}
