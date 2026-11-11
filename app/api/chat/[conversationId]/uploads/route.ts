import { NextResponse } from "next/server";
import { getChatAttachmentType, sanitizeChatAttachmentName } from "@/lib/chat-attachments";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

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
    console.error("Não foi possível validar a sessão para anexar um arquivo.", error);
    return { response: NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 }) };
  }
  if (!user) return { response: NextResponse.json({ error: "Entre para usar o chat." }, { status: 401 }) };
  return { supabase, user };
}

async function verifyConversationAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string,
) {
  const { error } = await supabase.rpc("get_chat_messages", { p_conversation_id: conversationId });
  if (!error) return null;
  if (error.code === "42501") {
    return NextResponse.json({ error: "Você não tem acesso a esta conversa." }, { status: 403 });
  }
  console.error("Não foi possível verificar o acesso ao chat.", error);
  return NextResponse.json({ error: "Não foi possível verificar o acesso à conversa." }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { conversationId } = await params;
  if (!UUID_PATTERN.test(conversationId)) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  const accessError = await verifyConversationAccess(auth.supabase, conversationId);
  if (accessError) return accessError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados do arquivo inválidos." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("name" in payload) ||
      typeof payload.name !== "string" || !("type" in payload) ||
      typeof payload.type !== "string" || !("size" in payload) ||
      typeof payload.size !== "number" || !Number.isFinite(payload.size)) {
    return NextResponse.json({ error: "Informe os dados do arquivo." }, { status: 400 });
  }

  const fileType = getChatAttachmentType(payload.name, payload.type);
  const fileName = sanitizeChatAttachmentName(payload.name);
  const maxSize = fileType?.kind === "image" ? 5 * 1024 * 1024 : MAX_ATTACHMENT_SIZE;
  if (!fileType || !fileName || payload.size <= 0 || payload.size > maxSize) {
    return NextResponse.json(
      { error: "Imagens podem ter até 5 MB; vídeos e documentos, até 25 MB." },
      { status: 400 },
    );
  }

  const path = `${conversationId}/${auth.user.id}/${crypto.randomUUID()}.${fileType.extension}`;
  const { data, error } = await auth.supabase.storage
    .from("chat-images")
    .createSignedUploadUrl(path, { upsert: false });
  if (error) {
    console.error("Não foi possível preparar o upload do anexo.", error);
    return NextResponse.json({ error: "Não foi possível preparar o envio do arquivo." }, { status: 500 });
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    name: fileName,
    type: fileType.contentType,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { conversationId } = await params;
  if (!UUID_PATTERN.test(conversationId)) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  const accessError = await verifyConversationAccess(auth.supabase, conversationId);
  if (accessError) return accessError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados do arquivo inválidos." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("path" in payload) || typeof payload.path !== "string") {
    return NextResponse.json({ error: "O arquivo é inválido." }, { status: 400 });
  }

  const pathParts = payload.path.split("/");
  if (pathParts.length !== 3 || pathParts[0] !== conversationId ||
      pathParts[1] !== auth.user.id || !/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(pathParts[2])) {
    return NextResponse.json({ error: "O arquivo é inválido." }, { status: 400 });
  }
  const { data: messages, error: messagesError } = await auth.supabase.rpc("get_chat_messages", {
    p_conversation_id: conversationId,
  });
  if (messagesError) {
    console.error("Não foi possível verificar as mensagens antes de remover o upload.", messagesError);
    return NextResponse.json({ error: "Não foi possível remover o arquivo enviado." }, { status: 500 });
  }
  if (((messages ?? []) as { image_path: string | null }[]).some(({ image_path }) => image_path === payload.path)) {
    return NextResponse.json({ error: "Este arquivo já está anexado a uma mensagem." }, { status: 409 });
  }
  const { error } = await auth.supabase.storage.from("chat-images").remove([payload.path]);
  if (error) {
    console.error("Não foi possível remover um upload de mensagem não enviado.", error);
    return NextResponse.json({ error: "Não foi possível remover o arquivo enviado." }, { status: 500 });
  }
  return NextResponse.json({ removed: true });
}
