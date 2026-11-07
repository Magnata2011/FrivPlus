"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicGame } from "@/lib/types";

export function Catalog({ initialGames }: { initialGames: PublicGame[] }) {
  const [games, setGames] = useState(initialGames);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const search = document.getElementById("catalog-search") as HTMLInputElement | null;
    if (!search) return;
    const onSearch = () => setQuery(search.value.trim().toLocaleLowerCase());
    search.addEventListener("input", onSearch);
    return () => search.removeEventListener("input", onSearch);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/games", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return [];
        const result = (await response.json()) as { games?: PublicGame[] };
        return Array.isArray(result.games) ? result.games : [];
      })
      .then((remoteGames) => {
        if (!active || remoteGames.length === 0) return;
        const knownIds = new Set(remoteGames.map((game) => game.id));
        setGames([...remoteGames, ...initialGames.filter((game) => !knownIds.has(game.id))]);
      })
      .catch(() => {
        if (active) setGames(initialGames);
      });
    return () => { active = false; };
  }, [initialGames]);

  const visibleGames = useMemo(() => {
    if (!query) return games;
    return games.filter((game) =>
      [game.title, game.category, ...game.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [games, query]);

  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <div className="section-heading">
        <div>
          <h2 id="catalog-title">Catálogo</h2>
          <p>{visibleGames.length} jogo{visibleGames.length === 1 ? "" : "s"} para explorar</p>
        </div>
      </div>
      {visibleGames.length === 0 ? (
        <p className="empty-state">Nenhum jogo encontrado. Tente outra busca.</p>
      ) : (
        <ul className="game-grid">
          {visibleGames.map((game) => (
            <li className="game-card" key={game.id}>
              <a href={game.gameUrl} target="_blank" rel="noopener noreferrer">
                <div className="game-cover">
                  <img src={game.coverUrl} alt={`Capa de ${game.title}`} loading="lazy" />
                </div>
                <div className="game-card-body">
                  <p className="game-card-title">{game.title}</p>
                  {game.description && <p className="game-card-description">{game.description}</p>}
                  <div className="tags">
                    {game.featured && <span className="tag featured-tag">Destaque</span>}
                    <span className="tag">{game.category}</span>
                    {game.tags.slice(0, 2).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
