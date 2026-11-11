import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChatMessageRow = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  image_path: string | null;
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
      imageUrl: message.image_path
        ? `/api/chat/${conversationId}/images/${message.id}`
        : null,
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

  let body: string;
  let file: File | null = null;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = typeof formData.get("body") === "string" ? formData.get("body") as string : "";
      const image = formData.get("image");
      file = image instanceof File && image.size > 0 ? image : null;
    } else {
      const payload: unknown = await request.json();
      if (!payload || typeof payload !== "object" || !("body" in payload) || typeof payload.body !== "string") {
        return NextResponse.json({ error: "A mensagem é inválida." }, { status: 400 });
      }
      body = payload.body;
    }
  } catch {
    return NextResponse.json({ error: "Dados da mensagem inválidos." }, { status: 400 });
  }

  const cleanBody = body.trim();
  if (!cleanBody && !file) {
    return NextResponse.json({ error: "Escreva uma mensagem ou escolha uma imagem." }, { status: 400 });
  }
  if (cleanBody.length > 2000) {
    return NextResponse.json({ error: "A mensagem deve ter até 2000 caracteres." }, { status: 400 });
  }

  let imagePath: string | null = null;
  if (file) {
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "A imagem deve ter até 5 MB." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const imageType = getImageType(bytes);
    if (!imageType) {
      return NextResponse.json({ error: "Use uma imagem PNG, JPG ou WebP válida." }, { status: 400 });
    }
    imagePath = `${conversationId}/${auth.user.id}/${crypto.randomUUID()}`;
    const { error: uploadError } = await auth.supabase.storage
      .from("chat-images")
      .upload(imagePath, file, { contentType: imageType, upsert: false });
    if (uploadError) {
      console.error("Não foi possível enviar a imagem do chat.", uploadError);
      return NextResponse.json({ error: "Não foi possível enviar a imagem. Verifique a migration de chat." }, { status: 500 });
    }
  }

  const { data, error } = await auth.supabase.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: cleanBody,
    p_image_path: imagePath,
  });
  if (error) {
    if (imagePath) {
      const { error: cleanupError } = await auth.supabase.storage.from("chat-images").remove([imagePath]);
      if (cleanupError) console.error("Não foi possível remover uma imagem de mensagem rejeitada.", cleanupError);
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
