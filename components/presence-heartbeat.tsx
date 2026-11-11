"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY_PREFIX = "frivplus-playing-game:";
const HEARTBEAT_INTERVAL = 60_000;

export function PresenceHeartbeat({ userId }: { userId: string | null }) {
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    try {
      setGameId(sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`));
    } catch (error) {
      console.error("Não foi possível carregar o jogo atual da sessão.", error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    const sendHeartbeat = async (activeGameId: string | null) => {
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId: activeGameId }),
          keepalive: true,
        });
        if (!response.ok && response.status !== 401) {
          console.error("Não foi possível atualizar a presença no FrivPlus.", await response.text());
        }
      } catch (error) {
        if (active) console.error("Erro de conexão ao atualizar a presença no FrivPlus.", error);
      }
    };

    const handleGameLaunch = (event: Event) => {
      const { gameId: nextGameId } = (event as CustomEvent<{ gameId?: unknown }>).detail ?? {};
      if (typeof nextGameId !== "string") return;
      try {
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, nextGameId);
      } catch (error) {
        console.error("Não foi possível salvar o jogo atual da sessão.", error);
      }
      setGameId(nextGameId);
    };

    window.addEventListener("frivplus:playing-game", handleGameLaunch);
    void sendHeartbeat(gameId);
    const intervalId = window.setInterval(() => void sendHeartbeat(gameId), HEARTBEAT_INTERVAL);

    return () => {
      active = false;
      window.removeEventListener("frivplus:playing-game", handleGameLaunch);
      window.clearInterval(intervalId);
    };
  }, [gameId, userId]);

  return null;
}
