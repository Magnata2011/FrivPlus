import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FriendRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
};

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function getUserClient() {
  if (!isSupabaseConfigured()) {
    return { response: NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 }) };
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Não foi possível validar a sessão do chat.", error);
    return { response: NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 }) };
  }
  if (!user) return { response: NextResponse.json({ error: "Entre para usar o chat." }, { status: 401 }) };
  return { supabase, user };
}

export async function GET() {
  const auth = await getUserClient();
  if ("response" in auth) return auth.response;

  const [{ data: conversations, error: conversationsError }, { data: friends, error: friendsError }] =
    await Promise.all([
      auth.supabase.rpc("list_my_chat_conversations"),
      auth.supabase.rpc("list_accepted_friends"),
    ]);
  if (conversationsError || friendsError) {
    console.error("Não foi possível carregar os dados do chat.", conversationsError ?? friendsError);
    return NextResponse.json({ error: "Não foi possível carregar as conversas e amigos." }, { status: 500 });
  }

  const friendResults = ((friends ?? []) as FriendRow[]).map((friend) => ({
    id: friend.id,
    username: friend.username,
    displayName: friend.display_name || friend.username,
    avatarUrl: friend.avatar_path
      ? auth.supabase.storage.from("avatars").getPublicUrl(friend.avatar_path).data.publicUrl
      : null,
  }));
  return NextResponse.json(
    { conversations: conversations ?? [], friends: friendResults },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  const auth = await getUserClient();
  if ("response" in auth) return auth.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados da conversa inválidos." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("userIds" in payload) ||
      !Array.isArray(payload.userIds) || payload.userIds.length < 1 ||
      payload.userIds.length > 19 ||
      !payload.userIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) ||
      new Set(payload.userIds).size !== payload.userIds.length) {
    return NextResponse.json({ error: "Escolha entre 1 e 19 amigos para a conversa." }, { status: 400 });
  }
  const name = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  if (name.length > 80) {
    return NextResponse.json({ error: "O nome do grupo deve ter até 80 caracteres." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("create_chat_conversation", {
    p_user_ids: payload.userIds,
    p_name: name || null,
  });
  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Só é possível criar conversas com amigos aceitos." }, { status: 403 });
    }
    if (error.code === "22023") {
      return NextResponse.json({ error: "A lista de participantes é inválida." }, { status: 400 });
    }
    console.error("Não foi possível criar a conversa.", error);
    return NextResponse.json({ error: "Não foi possível criar a conversa." }, { status: 500 });
  }

  return NextResponse.json({ conversationId: data }, { status: 201 });
}
