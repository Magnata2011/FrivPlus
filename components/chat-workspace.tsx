"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

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
  imageUrl: string | null;
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
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
    if (!selectedId || (!draft.trim() && !selectedImage)) return;
    setError("");
    setSending(true);

    try {
      let response: Response;
      if (selectedImage) {
        const formData = new FormData();
        formData.set("body", draft);
        formData.set("image", selectedImage);
        response = await fetch(`/api/chat/${selectedId}/messages`, { method: "POST", body: formData });
      } else {
        response = await fetch(`/api/chat/${selectedId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft }),
        });
      }
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível enviar a mensagem.");
        return;
      }
      setDraft("");
      setSelectedImage(null);
      await loadMessages(selectedId);
      const refresh = await fetch("/api/chat", { cache: "no-store" });
      const refreshed = await refresh.json() as { conversations?: ChatConversation[] };
      if (refresh.ok && refreshed.conversations) setConversations(refreshed.conversations);
    } catch {
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
                  {message.imageUrl && (
                    <a href={message.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img className="chat-message-image" src={message.imageUrl} alt="Imagem enviada na conversa" />
                    </a>
                  )}
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              {selectedImage && (
                <div className="chat-image-selection">
                  <span>{selectedImage.name}</span>
                  <button type="button" onClick={() => setSelectedImage(null)} aria-label="Remover imagem">×</button>
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
                  Enviar imagem
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                <button className="button button-primary" type="submit" disabled={sending || (!draft.trim() && !selectedImage)}>
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </div>
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
