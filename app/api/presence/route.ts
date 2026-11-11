import { NextResponse } from "next/server";
import { catalogGames } from "@/lib/catalog-games";
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
    return NextResponse.json({ error: "Dados de presença inválidos." }, { status: 400 });
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("gameId" in payload) ||
    (payload.gameId !== null && typeof payload.gameId !== "string")
  ) {
    return NextResponse.json({ error: "Informe um jogo válido ou null para status online." }, { status: 400 });
  }
  const gameId = payload.gameId;
  if (typeof gameId === "string" && !catalogGames.some((game) => game.id === gameId)) {
    return NextResponse.json({ error: "Esse jogo não existe no catálogo." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão ao atualizar a presença.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user) return NextResponse.json({ error: "Entre para atualizar sua presença." }, { status: 401 });

  const { error } = await supabase.rpc("update_my_presence", { p_game_id: gameId });
  if (error) {
    console.error("Não foi possível atualizar a presença do usuário.", error);
    return NextResponse.json({ error: "Não foi possível atualizar sua presença." }, { status: 500 });
  }

  return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
}
