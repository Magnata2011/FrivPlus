import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = createPublicSupabaseClient();
  } catch {
    return NextResponse.json(
      { error: "O catálogo remoto ainda não foi configurado." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("games")
    .select("id,title,description,cover_path,cover_url,category,tags,featured,game_file_path,game_url")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar o catálogo." }, { status: 500 });
  }

  const games = await Promise.all(
    (data ?? []).map(async (game) => {
      let coverUrl = game.cover_url;
      if (!coverUrl && game.cover_path) {
        const { data: cover, error: coverError } = await supabase.storage
          .from("game-assets")
          .createSignedUrl(game.cover_path, 60 * 60);
        if (coverError || !cover?.signedUrl) return null;
        coverUrl = cover.signedUrl;
      }
      if (!coverUrl) return null;

      let gameUrl = game.game_url;
      if (!gameUrl && game.game_file_path) {
        const { data: file, error: fileError } = await supabase.storage
          .from("game-assets")
          .createSignedUrl(game.game_file_path, 60 * 60);
        if (fileError || !file?.signedUrl) return null;
        gameUrl = file.signedUrl;
      }

      if (!gameUrl) return null;
      return {
        id: game.id,
        title: game.title,
        description: game.description,
        coverUrl,
        category: game.category,
        tags: game.tags,
        featured: game.featured,
        gameUrl,
      };
    }),
  );

  return NextResponse.json(
    { games: games.filter((game) => game !== null) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
