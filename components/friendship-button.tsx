"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FriendshipStatus = "self" | "none" | "outgoing" | "incoming" | "accepted";

export function FriendshipButton({ username }: { username: string }) {
  const [status, setStatus] = useState<FriendshipStatus | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/friendships/${encodeURIComponent(username)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { status?: FriendshipStatus; error?: string };
        if (response.status === 401) {
          setAuthRequired(true);
          return;
        }
        if (!response.ok || !result.status) {
          setError(result.error ?? "Não foi possível verificar a amizade.");
          return;
        }
        setStatus(result.status);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError("Erro de conexão ao verificar a amizade.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [username]);

  async function addFriend() {
    setError("");
    setUpdating(true);
    try {
      const response = await fetch(`/api/friendships/${encodeURIComponent(username)}`, {
        method: "POST",
      });
      const result = await response.json() as { status?: FriendshipStatus; error?: string };
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      if (!response.ok || (result.status !== "outgoing" && result.status !== "accepted")) {
        setError(result.error ?? "Não foi possível atualizar a amizade.");
        return;
      }
      setStatus(result.status);
    } catch {
      setError("Erro de conexão ao atualizar a amizade.");
    } finally {
      setUpdating(false);
    }
  }

  if (authRequired) {
    return (
      <Link className="button button-outline" href={`/login?next=${encodeURIComponent(`/u/${username}`)}`}>
        Entrar para adicionar amizade
      </Link>
    );
  }
  if (loading) {
    return <button className="button button-outline" type="button" disabled>Carregando...</button>;
  }
  if (status === "self") return <span className="field-hint">Este é o seu perfil</span>;
  if (status === "accepted") return <span className="friendship-status">Amigos</span>;

  return (
    <div className="friendship-action">
      {status === "outgoing" ? (
        <button className="button button-outline" type="button" disabled>
          Solicitação enviada
        </button>
      ) : (
        <button className="button button-primary" type="button" disabled={updating} onClick={() => void addFriend()}>
          {updating
            ? "Atualizando..."
            : status === "incoming"
              ? "Aceitar solicitação"
              : "Adicionar amizade"}
        </button>
      )}
      {error && <span className="form-error" role="alert">{error}</span>}
    </div>
  );
}
