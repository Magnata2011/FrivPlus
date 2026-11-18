"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicGame } from "@/lib/types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

  const recommended = useMemo(() => {
    const shuffled = shuffle(initialGames);
    const count = Math.min(Math.max(5, 0), shuffled.length);
    const take = Math.min(8, Math.max(5, shuffled.length >= 5 ? 8 : shuffled.length));
    return shuffled.slice(0, Math.max(5, Math.min(take, shuffled.length)));
  }, [initialGames]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    initialGames.forEach((game) => game.category && set.add(game.category));
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [initialGames]);

  const gamesByCategory = useMemo(() => {
    const map = new Map<string, PublicGame[]>();
    categories.forEach((cat) => {
      map.set(cat, initialGames.filter((game) => game.category === cat));
    });
    return map;
  }, [initialGames, categories]);

  const ps2Games = useMemo(
    () =>
      initialGames.filter((game) =>
        game.tags.some((tag) => tag.toLocaleLowerCase() === "ps2"),
      ),
    [initialGames],
  );

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTo = (key: string) => {
    const el = rowRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (query) {
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
                <Link
                  className="card-link"
                  href={game.openExternal ? game.gameUrl : `/play/${encodeURIComponent(game.id)}`}
                  target={game.openExternal ? "_blank" : undefined}
                  rel={game.openExternal ? "noopener noreferrer" : undefined}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("frivplus:playing-game", { detail: { gameId: game.id } }),
                    )
                  }
                >
                  <div className="game-cover">
                    <img src={game.coverUrl} alt={`Capa de ${game.title}`} loading="lazy" />
                  </div>
                  <div className="game-card-body">
                    <p className="game-card-title">{game.title}</p>
                    <div className="tags">
                      <span className="tag">{game.category}</span>
                      {game.tags.slice(0, 2).map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const rows: { key: string; title: string; games: PublicGame[] }[] = [
    { key: "rec", title: "Recomendados", games: recommended },
    ...categories.map((cat) => ({
      key: cat,
      title: cat,
      games: gamesByCategory.get(cat) || [],
    })),
  ];
  if (ps2Games.length > 0) {
    rows.push({
      key: "ps2",
      title: "Emuladores de PS2 (pesados para computadores fracos)",
      games: ps2Games,
    });
  }

  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <div className="section-heading">
        <div>
          <h2 id="catalog-title">Catálogo</h2>
          <p>{initialGames.length} jogos para explorar</p>
        </div>
      </div>

      <nav className="catalog-menu" aria-label="Categorias">
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            className="catalog-menu-item"
            onClick={() => scrollTo(row.key)}
          >
            {row.title}
          </button>
        ))}
      </nav>

      <div className="catalog-rows">
        {rows.map((row) => (
          <div
            key={row.key}
            ref={(el) => {
              rowRefs.current[row.key] = el;
            }}
            className="catalog-row"
          >
            <h3 className="catalog-row-title">{row.title}</h3>
            <div className="catalog-row-scroll">
              {row.games.map((game) => (
                <li className="game-card catalog-row-card" key={`${row.key}-${game.id}`}>
                  <Link

                    href={game.openExternal ? game.gameUrl : `/play/${encodeURIComponent(game.id)}`}
                    target={game.openExternal ? "_blank" : undefined}
                    rel={game.openExternal ? "noopener noreferrer" : undefined}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("frivplus:playing-game", { detail: { gameId: game.id } }),
                      )
                    }
                  >
                    <div className="game-cover">
                      <img src={game.coverUrl} alt={`Capa de ${game.title}`} loading="lazy" />
                    </div>
                    <div className="game-card-body">
                      <p className="game-card-title">{game.title}</p>
                      <div className="tags">
                        <span className="tag">{game.category}</span>
                        {game.tags.slice(0, 2).map((tag) => (
                          <span className="tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
