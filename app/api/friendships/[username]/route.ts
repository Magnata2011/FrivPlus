import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type FriendshipStatus = "self" | "none" | "outgoing" | "incoming" | "accepted";

const isFriendshipStatus = (value: unknown): value is FriendshipStatus =>
  value === "self" ||
  value === "none" ||
  value === "outgoing" ||
  value === "incoming" ||
  value === "accepted";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function getAuthenticatedClient() {
  if (!isSupabaseConfigured()) {
    return { response: NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 }) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Não foi possível validar a sessão para gerenciar amizades.", error);
    return { response: NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 }) };
  }
  if (!user) {
    return { response: NextResponse.json({ error: "Entre para gerenciar amizades." }, { status: 401 }) };
  }
  return { supabase };
}

function handleFriendshipError(error: { code?: string }) {
  if (error.code === "P0002") {
    return NextResponse.json({ error: "Este perfil não foi encontrado." }, { status: 404 });
  }
  if (error.code === "22023") {
    return NextResponse.json({ error: "Não é possível adicionar sua própria conta." }, { status: 400 });
  }
  console.error("Não foi possível atualizar a amizade.", error);
  return NextResponse.json({ error: "Não foi possível atualizar a amizade." }, { status: 500 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { username } = await params;
  const { data, error } = await auth.supabase.rpc("get_friendship_status", {
    p_username: username,
  });
  if (error) return handleFriendshipError(error);
  if (!isFriendshipStatus(data)) {
    console.error("O Supabase retornou um estado de amizade inválido.");
    return NextResponse.json({ error: "Não foi possível verificar a amizade." }, { status: 500 });
  }
  return NextResponse.json({ status: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { username } = await params;
  const { data, error } = await auth.supabase.rpc("request_friendship", {
    p_username: username,
  });
  if (error) return handleFriendshipError(error);
  if (data !== "outgoing" && data !== "accepted") {
    console.error("O Supabase retornou um estado de solicitação de amizade inválido.");
    return NextResponse.json({ error: "Não foi possível atualizar a amizade." }, { status: 500 });
  }
  return NextResponse.json({ status: data });
}
