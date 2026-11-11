"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicGame } from "@/lib/types";

export function Catalog({ initialGames }: { initialGames: PublicGame[] }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const search = document.getElementById("catalog-search") as HTMLInputElement | null;
    if (!search) return;
    const onSearch = () => setQuery(search.value.trim().toLocaleLowerCase());
    onSearch();
    search.addEventListener("input", onSearch);
    return () => search.removeEventListener("input", onSearch);
  }, []);

  const visibleGames = useMemo(() => {
    if (!query) return initialGames;
    const directMatches = initialGames.filter((game) =>
      [game.title, game.category, ...game.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
    if (directMatches.length > 0 || query.length < 2) return directMatches;
    return initialGames
      .filter((game) => game.title.toLocaleLowerCase().startsWith(query[0]))
      .slice(0, 6);
  }, [initialGames, query]);

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
              <a
                href={game.gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.dispatchEvent(new CustomEvent("frivplus:playing-game", {
                  detail: { gameId: game.id },
                }))}
              >
                <div className="game-cover">
                  <img src={game.coverUrl} alt={`Capa de ${game.title}`} loading="lazy" />
                </div>
                <div className="game-card-body">
                  <p className="game-card-title">{game.title}</p>
                  <div className="tags">
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
