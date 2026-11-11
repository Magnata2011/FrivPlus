import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChatMessageAttachmentRow = {
  id: string;
  image_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
};

function safeDownloadName(name: string | null) {
  return (name ?? "arquivo")
    .replace(/[\\/\u0000-\u001f\u007f"]/g, "_")
    .trim()
    .slice(0, 180) || "arquivo";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão para carregar o anexo do chat.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user) return NextResponse.json({ error: "Entre para ver este anexo." }, { status: 401 });

  const { conversationId, messageId } = await params;
  if (!UUID_PATTERN.test(conversationId) || !UUID_PATTERN.test(messageId)) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }
  const { data, error } = await supabase.rpc("get_chat_messages", {
    p_conversation_id: conversationId,
  });
  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Você não tem acesso a esta conversa." }, { status: 403 });
    }
    console.error("Não foi possível verificar o anexo da conversa.", error);
    return NextResponse.json({ error: "Não foi possível carregar o anexo." }, { status: 500 });
  }

  const message = ((data ?? []) as ChatMessageAttachmentRow[]).find(({ id }) => id === messageId);
  if (!message?.image_path) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const fileName = safeDownloadName(message.attachment_name);
  const shouldDownload = new URL(request.url).searchParams.has("download") ||
    !message.attachment_type?.startsWith("image/") &&
    !message.attachment_type?.startsWith("video/");
  const { data: signedFile, error: signedFileError } = await supabase.storage
    .from("chat-images")
    .createSignedUrl(
      message.image_path,
      60,
      shouldDownload ? { download: fileName } : {},
    );
  if (signedFileError) {
    console.error("Não foi possível assinar o link de um anexo do chat.", signedFileError);
    return NextResponse.json({ error: "Não foi possível preparar o download." }, { status: 500 });
  }

  return NextResponse.redirect(signedFile.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
