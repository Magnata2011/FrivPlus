import { AccountNavigation } from "@/components/account-navigation";
import { Catalog } from "@/components/catalog";
import { MaintenanceAdminControl } from "@/components/maintenance-admin-control";
import { getMaintenanceEnabled } from "@/lib/maintenance";
import games from "@/data/games.json";
import Link from "next/link";

const LEGACY_GAMES_BASE_URL = "https://magnata2011.github.io/FrivPlus/";

export default async function HomePage() {
  const maintenanceEnabled = await getMaintenanceEnabled();

  if (maintenanceEnabled) {
    return (
      <main className="maintenance-page">
        <section className="maintenance-poster" aria-labelledby="maintenance-title">
          <div className="maintenance-icon" aria-hidden="true">
            <span />
          </div>
          <p className="maintenance-label">FrivPlus · Aviso importante</p>
          <h1 id="maintenance-title">Estamos em atualização</h1>
          <p className="maintenance-message">
            Estamos trabalhando para melhorar o site. Por favor, não entre nem tente
            jogar enquanto a manutenção estiver acontecendo.
          </p>
          <div className="maintenance-divider" />
          <p className="maintenance-return">Voltamos em breve.</p>
          <span className="maintenance-status">
            <span className="maintenance-status-dot" />
            Manutenção em andamento
          </span>
          <MaintenanceAdminControl enabled={maintenanceEnabled} />
        </section>
        <footer className="maintenance-footer">
          Obrigado pela compreensão.
        </footer>
      </main>
    );
  }

  const legacyGames = games.map((game) => ({
    id: game.id,
    title: game.title,
    coverUrl: game.cardImage,
    category: game.tags[0] ?? "Jogos",
    tags: game.tags,
    gameUrl: new URL(game.url, LEGACY_GAMES_BASE_URL).toString(),
  }));

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
            <AccountNavigation maintenanceEnabled={maintenanceEnabled} />
          </div>
        </div>
      </header>
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
