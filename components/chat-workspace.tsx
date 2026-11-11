"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { getChatAttachmentType } from "@/lib/chat-attachments";

export type ChatFriend = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
};

export type ChatMember = {
  id: string;
  username: string | null;
  displayName: string;
  avatarPath: string | null;
};

export type ChatConversation = {
  id: string;
  name: string | null;
  created_at: string;
  is_group: boolean;
  members: ChatMember[];
  last_message: string | null;
  last_message_at: string | null;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  createdAt: string;
};

export function ChatWorkspace({
  friends,
  initialConversations,
  currentUserId,
}: {
  friends: ChatFriend[];
  initialConversations: ChatConversation[];
  currentUserId: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef<string | null>(null);

  const selectedConversation = conversations.find(({ id }) => id === selectedId) ?? null;
  const conversationTitle = useMemo(() => {
    if (!selectedConversation) return "";
    if (selectedConversation.name) return selectedConversation.name;
    return selectedConversation.members
      .filter(({ id }) => id !== currentUserId)
      .map(({ displayName }) => displayName)
      .join(", ");
  }, [selectedConversation, currentUserId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/${conversationId}/messages`, { cache: "no-store" });
      const result = await response.json() as { messages?: ChatMessage[]; error?: string };
      if (selectedConversationRef.current !== conversationId) return;
      if (!response.ok || !result.messages) {
        setError(result.error ?? "Não foi possível carregar as mensagens.");
        return;
      }
      setMessages((current) => {
        if (
          current.length === result.messages?.length &&
          current.every((message, index) => message.id === result.messages?.[index]?.id)
        ) return current;
        return result.messages ?? [];
      });
      setError("");
    } catch {
      if (selectedConversationRef.current === conversationId) {
        setError("Erro de conexão ao carregar as mensagens.");
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    setMessages([]);
    void loadMessages(selectedId);
    const intervalId = window.setInterval(() => void loadMessages(selectedId), 5000);
    return () => window.clearInterval(intervalId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedFriends.length === 0) {
      setError("Escolha ao menos um amigo para iniciar uma conversa.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedFriends, name: groupName }),
      });
      const result = await response.json() as { conversationId?: string; error?: string };
      if (!response.ok || !result.conversationId) {
        setError(result.error ?? "Não foi possível criar a conversa.");
        return;
      }
      const refresh = await fetch("/api/chat", { cache: "no-store" });
      const refreshed = await refresh.json() as { conversations?: ChatConversation[]; error?: string };
      if (!refresh.ok || !refreshed.conversations) {
        setError(refreshed.error ?? "A conversa foi criada, mas a lista não pôde ser atualizada.");
        return;
      }
      setConversations(refreshed.conversations);
      selectedConversationRef.current = result.conversationId;
      setSelectedId(result.conversationId);
      setSelectedFriends([]);
      setGroupName("");
      setShowNewConversation(false);
    } catch {
      setError("Erro de conexão ao criar a conversa.");
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || (!draft.trim() && !selectedFile)) return;
    setError("");
    setSending(true);
    let uploadedPath: string | null = null;

    try {
      let attachment: { path: string; name: string; type: string } | null = null;
      if (selectedFile) {
        const fileType = getChatAttachmentType(selectedFile.name, selectedFile.type);
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!fileType || !supabaseUrl || !anonKey) {
          setError("O formato do arquivo não é aceito ou a autenticação está indisponível.");
          return;
        }

        const uploadResponse = await fetch(`/api/chat/${selectedId}/uploads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
          }),
        });
        const uploadResult = await uploadResponse.json() as {
          path?: string;
          token?: string;
          name?: string;
          type?: string;
          error?: string;
        };
        if (!uploadResponse.ok || !uploadResult.path || !uploadResult.token ||
            !uploadResult.name || !uploadResult.type) {
          setError(uploadResult.error ?? "Não foi possível preparar o envio do arquivo.");
          return;
        }

        const supabase = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .uploadToSignedUrl(uploadResult.path, uploadResult.token, selectedFile, {
            contentType: uploadResult.type,
          });
        if (uploadError) {
          setError("Não foi possível enviar o arquivo. Tente novamente.");
          return;
        }
        uploadedPath = uploadResult.path;
        attachment = {
          path: uploadResult.path,
          name: uploadResult.name,
          type: uploadResult.type,
        };
      }

      const response = await fetch(`/api/chat/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft, attachment }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível enviar a mensagem.");
        if (uploadedPath) {
          const cleanupResponse = await fetch(`/api/chat/${selectedId}/uploads`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: uploadedPath }),
          });
          if (!cleanupResponse.ok) {
            console.error("Não foi possível remover um anexo que não foi enviado.", await cleanupResponse.text());
          }
          uploadedPath = null;
        }
        return;
      }
      setDraft("");
      setSelectedFile(null);
      await loadMessages(selectedId);
      const refresh = await fetch("/api/chat", { cache: "no-store" });
      const refreshed = await refresh.json() as { conversations?: ChatConversation[] };
      if (refresh.ok && refreshed.conversations) setConversations(refreshed.conversations);
    } catch {
      if (uploadedPath) {
        try {
          const cleanupResponse = await fetch(`/api/chat/${selectedId}/uploads`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: uploadedPath }),
          });
          if (!cleanupResponse.ok) {
            console.error("Não foi possível remover um anexo que não foi enviado.", await cleanupResponse.text());
          }
        } catch (cleanupError) {
          console.error("Erro de conexão ao remover um anexo que não foi enviado.", cleanupError);
        }
      }
      setError("Erro de conexão ao enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-workspace" aria-label="Conversas">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-heading">
          <h2>Conversas</h2>
          <button
            className="button button-primary"
            type="button"
            onClick={() => { setShowNewConversation((visible) => !visible); setError(""); }}
          >
            + Nova
          </button>
        </div>
        {showNewConversation && (
          <form className="chat-new-conversation" onSubmit={createConversation}>
            <label className="label">
              Nome do grupo (opcional)
              <input
                className="field-input"
                value={groupName}
                maxLength={80}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>
            <p className="field-hint">Selecione amigos; mais de uma pessoa cria um grupo.</p>
            {friends.length === 0 ? (
              <p className="field-hint">Você ainda não tem amizades aceitas.</p>
            ) : (
              <ul className="chat-friend-picker">
                {friends.map((friend) => (
                  <li key={friend.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedFriends.includes(friend.id)}
                        onChange={(event) => setSelectedFriends((current) =>
                          event.target.checked
                            ? [...current, friend.id]
                            : current.filter((id) => id !== friend.id),
                        )}
                      />
                      <span>{friend.displayName}</span>
                      <small>@{friend.username}</small>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button className="button button-primary" type="submit" disabled={creating || friends.length === 0}>
              {creating ? "Criando..." : "Criar conversa"}
            </button>
          </form>
        )}
        {conversations.length === 0 ? (
          <p className="chat-empty">Nenhuma conversa ainda. Inicie uma com seus amigos.</p>
        ) : (
          <ul className="chat-conversation-list">
            {conversations.map((conversation) => {
              const title = conversation.name || conversation.members
                .filter(({ id }) => id !== currentUserId)
                .map(({ displayName }) => displayName)
                .join(", ");
              return (
                <li key={conversation.id}>
                  <button
                    className={`chat-conversation ${selectedId === conversation.id ? "is-selected" : ""}`}
                    type="button"
                    onClick={() => {
                      selectedConversationRef.current = conversation.id;
                      setSelectedId(conversation.id);
                      setError("");
                    }}
                  >
                    <span className="chat-conversation-avatar" aria-hidden="true">
                      {conversation.is_group ? "G" : title.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="chat-conversation-info">
                      <strong>{title || "Conversa"}</strong>
                      <small>{conversation.last_message || (conversation.is_group ? "Grupo" : "Inicie a conversa")}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="chat-main">
        {selectedConversation ? (
          <>
            <header className="chat-conversation-header">
              <div>
                <h2>{conversationTitle || "Conversa"}</h2>
                <span>{selectedConversation.is_group
                  ? `${selectedConversation.members.length} participantes`
                  : "Conversa privada entre amigos"}</span>
              </div>
            </header>
            <div className="chat-messages" aria-live="polite">
              {messages.length === 0 && <p className="chat-empty">Envie a primeira mensagem.</p>}
              {messages.map((message) => (
                <article
                  className={`chat-message ${message.senderId === currentUserId ? "chat-message-own" : ""}`}
                  key={message.id}
                >
                  <div className="chat-message-meta">
                    <strong>{message.senderId === currentUserId ? "Você" : message.senderName}</strong>
                    <time dateTime={message.createdAt}>
                      {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                  {message.body && <p>{message.body}</p>}
                  {message.attachmentUrl && message.attachmentType?.startsWith("image/") && (
                    <div className="chat-attachment">
                      <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          className="chat-message-image"
                          src={message.attachmentUrl}
                          alt={message.attachmentName ?? "Imagem enviada na conversa"}
                        />
                      </a>
                      <a className="button button-outline chat-download-button" href={`${message.attachmentUrl}?download=1`}>
                        Baixar imagem
                      </a>
                    </div>
                  )}
                  {message.attachmentUrl && message.attachmentType?.startsWith("video/") && (
                    <div className="chat-attachment">
                      <video className="chat-message-video" controls playsInline preload="metadata">
                        <source src={message.attachmentUrl} type={message.attachmentType} />
                        Seu navegador não consegue reproduzir este vídeo.
                      </video>
                      <a className="button button-outline chat-download-button" href={`${message.attachmentUrl}?download=1`}>
                        Baixar vídeo
                      </a>
                    </div>
                  )}
                  {message.attachmentUrl &&
                    !message.attachmentType?.startsWith("image/") &&
                    !message.attachmentType?.startsWith("video/") && (
                      <div className="chat-file-attachment">
                        <span className="chat-file-icon" aria-hidden="true">↓</span>
                        <span className="chat-file-name">{message.attachmentName ?? "Arquivo"}</span>
                        <a className="button button-outline chat-download-button" href={`${message.attachmentUrl}?download=1`}>
                          Baixar arquivo
                        </a>
                      </div>
                  )}
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              {selectedFile && (
                <div className="chat-image-selection">
                  <span>{selectedFile.name}</span>
                  <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remover anexo">×</button>
                </div>
              )}
              <textarea
                className="field-input field-textarea"
                value={draft}
                maxLength={2000}
                placeholder="Escreva uma mensagem..."
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="chat-composer-actions">
                <label className="button button-outline chat-image-button">
                  Anexar arquivo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      const fileType = file ? getChatAttachmentType(file.name, file.type) : null;
                      const maxSize = fileType?.kind === "image" ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
                      if (file && file.size > maxSize) {
                        setError(fileType?.kind === "image"
                          ? "Imagens podem ter até 5 MB."
                          : "Vídeos e documentos podem ter até 25 MB.");
                        return;
                      }
                      setError("");
                      setSelectedFile(file);
                    }}
                  />
                </label>
                <button className="button button-primary" type="submit" disabled={sending || (!draft.trim() && !selectedFile)}>
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </div>
              <span className="field-hint">Imagens até 5 MB; vídeos e documentos (PDF, Office ou TXT) até 25 MB.</span>
            </form>
          </>
        ) : (
          <div className="chat-welcome">
            <div className="chat-welcome-icon" aria-hidden="true">F</div>
            <h2>Seu espaço para conversar</h2>
            <p>Escolha uma conversa ou crie um grupo com seus amigos.</p>
          </div>
        )}
        {error && <p className="form-error chat-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
