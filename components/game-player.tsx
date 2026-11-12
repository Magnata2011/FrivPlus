"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicGame } from "@/lib/types";

export function GamePlayer({ game }: { game: PublicGame }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  async function toggleFullscreen() {
    setFullscreenError("");

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (frameRef.current?.requestFullscreen) {
        await frameRef.current.requestFullscreen();
      } else {
        setFullscreenError("A tela cheia não é compatível com este navegador.");
      }
    } catch (error) {
      console.error("Não foi possível alternar para tela cheia.", error);
      setFullscreenError("Não foi possível abrir a tela cheia.");
    }
  }

  return (
    <section className="game-player" aria-labelledby="game-player-title">
      <div className="game-player-heading">
        <div>
          <p className="eyebrow">FrivPlus · Jogando agora</p>
          <h1 id="game-player-title">{game.title}</h1>
        </div>
      </div>

      <div className="game-player-frame" ref={frameRef}>
        <div className="game-player-frame-bar">
          <span className="game-player-brand"><span aria-hidden="true">F</span> FrivPlus</span>
          <span className="game-player-frame-title">{game.title}</span>
          <span className="game-player-live"><span aria-hidden="true" /> Ao vivo</span>
        </div>
        <iframe
          key={reloadKey}
          className="game-player-iframe"
          src={game.gameUrl}
          title={game.title}
          allow="autoplay; fullscreen; gamepad; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="game-player-actions" aria-label="Controles do jogo">
        <Link className="button button-outline game-player-back" href="/catalog">
          <span aria-hidden="true">←</span> Voltar ao catálogo
        </Link>
        <div className="game-player-action-group">
          <button
            className="button button-outline"
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Reiniciar jogo
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <a
            className="button button-outline"
            href={game.gameUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir em outra aba
          </a>
          <button
            className="button button-primary game-player-save"
            type="button"
            disabled
            aria-describedby="game-save-status"
            title="O salvamento ainda não funciona"
          >
            Salvar progresso
          </button>
        </div>
      </div>
      <p className="game-player-save-status" id="game-save-status">
        Ainda não funciona — o sistema de salvamento está em desenvolvimento.
      </p>
      {fullscreenError && <p className="game-player-error" role="status">{fullscreenError}</p>}
    </section>
  );
}
