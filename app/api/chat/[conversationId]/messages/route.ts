import { NextResponse } from "next/server";
import { getChatAttachmentType, sanitizeChatAttachmentName } from "@/lib/chat-attachments";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

type ChatMessageRow = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  image_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
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

function getImageType(bytes: Uint8Array) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

async function getAuthenticatedClient() {
  if (!isSupabaseConfigured()) {
    return { response: NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 }) };
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Não foi possível validar a sessão da conversa.", error);
    return { response: NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 }) };
  }
  if (!user) return { response: NextResponse.json({ error: "Entre para usar o chat." }, { status: 401 }) };
  return { supabase, user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { conversationId } = await params;
  if (!UUID_PATTERN.test(conversationId)) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  const { data, error } = await auth.supabase.rpc("get_chat_messages", {
    p_conversation_id: conversationId,
  });
  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Você não tem acesso a esta conversa." }, { status: 403 });
    }
    console.error("Não foi possível carregar as mensagens.", error);
    return NextResponse.json({ error: "Não foi possível carregar as mensagens." }, { status: 500 });
  }

  const messages = ((data ?? []) as ChatMessageRow[]).map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      body: message.body,
      attachmentUrl: message.image_path
        ? `/api/chat/${conversationId}/files/${message.id}`
        : null,
      attachmentName: message.attachment_name ?? "Imagem",
      attachmentType: message.attachment_type ?? "image/jpeg",
      createdAt: message.created_at,
    }));

  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados da mensagem inválidos." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("body" in payload) ||
      typeof payload.body !== "string") {
    return NextResponse.json({ error: "A mensagem é inválida." }, { status: 400 });
  }

  const body = payload.body;
  const cleanBody = body.trim();
  if (cleanBody.length > 2000) {
    return NextResponse.json({ error: "A mensagem deve ter até 2000 caracteres." }, { status: 400 });
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  let attachmentType: string | null = null;
  if ("attachment" in payload && payload.attachment !== null) {
    if (!payload.attachment || typeof payload.attachment !== "object" ||
        !("path" in payload.attachment) || typeof payload.attachment.path !== "string" ||
        !("name" in payload.attachment) || typeof payload.attachment.name !== "string" ||
        !("type" in payload.attachment) || typeof payload.attachment.type !== "string") {
      return NextResponse.json({ error: "O anexo da mensagem é inválido." }, { status: 400 });
    }
    const type = getChatAttachmentType(payload.attachment.name, payload.attachment.type);
    const sanitizedName = sanitizeChatAttachmentName(payload.attachment.name);
    const pathParts = payload.attachment.path.split("/");
    const expectedFileName = pathParts[2] ?? "";
    if (!type || !sanitizedName || pathParts.length !== 3 ||
        pathParts[0] !== conversationId || pathParts[1] !== auth.user.id ||
        !new RegExp(`^${UUID_PATTERN.source.slice(1, -1)}\\.${type.extension}$`, "i").test(expectedFileName)) {
      return NextResponse.json({ error: "O anexo da mensagem é inválido." }, { status: 400 });
    }

    const { data: uploadedFiles, error: listError } = await auth.supabase.storage
      .from("chat-images")
      .list(`${conversationId}/${auth.user.id}`, { search: expectedFileName, limit: 1 });
    if (listError) {
      console.error("Não foi possível verificar o upload do anexo.", listError);
      return NextResponse.json({ error: "Não foi possível confirmar o envio do arquivo." }, { status: 500 });
    }
    const uploadedFile = uploadedFiles?.find(({ name }) => name === expectedFileName);
    const uploadedMetadata = uploadedFile?.metadata;
    const uploadedSize = Number(uploadedMetadata?.size);
    if (!uploadedFile || !uploadedMetadata ||
        uploadedMetadata.mimetype !== type.contentType ||
        !Number.isFinite(uploadedSize) || uploadedSize <= 0 ||
        uploadedSize > (type.kind === "image" ? MAX_IMAGE_SIZE : MAX_ATTACHMENT_SIZE)) {
      return NextResponse.json(
        { error: "O arquivo não foi enviado ou ultrapassa o limite permitido." },
        { status: 400 },
      );
    }
    if (type.kind === "image") {
      const { data: image, error: imageError } = await auth.supabase.storage
        .from("chat-images")
        .download(payload.attachment.path);
      if (imageError) {
        console.error("Não foi possível verificar a imagem enviada no chat.", imageError);
        return NextResponse.json({ error: "Não foi possível validar a imagem enviada." }, { status: 500 });
      }
      const signature = new Uint8Array(await image.slice(0, 12).arrayBuffer());
      if (getImageType(signature) !== type.contentType) {
        return NextResponse.json({ error: "O conteúdo da imagem não corresponde ao formato informado." }, { status: 400 });
      }
    }

    attachmentPath = payload.attachment.path;
    attachmentName = sanitizedName;
    attachmentType = type.contentType;
  } else if (!cleanBody) {
    return NextResponse.json({ error: "Escreva uma mensagem ou escolha um arquivo." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("send_chat_attachment_message", {
    p_conversation_id: conversationId,
    p_body: cleanBody,
    p_attachment_path: attachmentPath,
    p_attachment_name: attachmentName,
    p_attachment_type: attachmentType,
  });
  if (error) {
    if (attachmentPath) {
      const { error: cleanupError } = await auth.supabase.storage.from("chat-images").remove([attachmentPath]);
      if (cleanupError) console.error("Não foi possível remover um anexo de mensagem rejeitada.", cleanupError);
    }
    if (error.code === "42501") {
      return NextResponse.json({ error: "Você não tem acesso a esta conversa." }, { status: 403 });
    }
    if (error.code === "22023") {
      return NextResponse.json({ error: "A mensagem é inválida." }, { status: 400 });
    }
    console.error("Não foi possível salvar a mensagem.", error);
    return NextResponse.json({ error: "Não foi possível enviar a mensagem." }, { status: 500 });
  }

  return NextResponse.json({ messageId: data }, { status: 201 });
}
