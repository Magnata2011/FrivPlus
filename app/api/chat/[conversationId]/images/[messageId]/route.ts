import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChatMessageImageRow = { id: string; image_path: string | null };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão para carregar a imagem do chat.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user) return NextResponse.json({ error: "Entre para ver esta imagem." }, { status: 401 });

  const { conversationId, messageId } = await params;
  if (!UUID_PATTERN.test(conversationId) || !UUID_PATTERN.test(messageId)) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }
  const { data, error } = await supabase.rpc("get_chat_messages", {
    p_conversation_id: conversationId,
  });
  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Você não tem acesso a esta conversa." }, { status: 403 });
    }
    console.error("Não foi possível verificar a imagem da conversa.", error);
    return NextResponse.json({ error: "Não foi possível carregar a imagem." }, { status: 500 });
  }

  const message = ((data ?? []) as ChatMessageImageRow[]).find(({ id }) => id === messageId);
  if (!message?.image_path) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }
  const { data: image, error: imageError } = await supabase.storage
    .from("chat-images")
    .download(message.image_path);
  if (imageError) {
    console.error("Não foi possível baixar uma imagem do chat.", imageError);
    return NextResponse.json({ error: "Não foi possível carregar a imagem." }, { status: 500 });
  }

  return new NextResponse(image, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": image.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
