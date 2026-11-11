import Link from "next/link";
import { AccountNavigation } from "@/components/account-navigation";
import { Catalog } from "@/components/catalog";
import games from "@/data/games.json";

const LEGACY_GAMES_BASE_URL = "https://magnata2011.github.io/FrivPlus/";

const legacyGames = games.map((game) => ({
  id: game.id,
  title: game.title,
  coverUrl: game.cardImage,
  category: game.tags[0] ?? "Jogos",
  tags: game.tags,
  gameUrl: new URL(game.url, LEGACY_GAMES_BASE_URL).toString(),
}));

export function GameCatalogPage({ maintenanceEnabled }: { maintenanceEnabled: boolean }) {
  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" href="/" aria-label="FrivPlus, início">
            <span className="brand-mark">F</span>
            <span>FrivPlus</span>
          </Link>
          <div className="header-actions">
            <label className="sr-only" htmlFor="catalog-search">Buscar jogos</label>
            <input
              className="search-input"
              id="catalog-search"
              type="search"
              placeholder="Buscar jogo..."
            />
            <AccountNavigation />
          </div>
        </div>
      </header>
      {maintenanceEnabled && (
        <aside className="catalog-maintenance-notice">
          O aviso de manutenção continua ativo. Você escolheu continuar para o catálogo.
          <Link href="/">Ver aviso</Link>
        </aside>
      )}
      <main className="wrap">
        <section className="hero">
          <div className="eyebrow">Jogue algo novo</div>
          <h1>Seu próximo jogo favorito está aqui.</h1>
          <p>Uma coleção de jogos para descobrir, explorar e jogar.</p>
        </section>
        <Catalog initialGames={legacyGames} />
      </main>
      <footer className="site-footer">
        <div className="wrap">FrivPlus · Uma coleção feita para jogar.</div>
      </footer>
    </>
  );
}
