import games from "@/data/games.json";
import { Catalog } from "@/components/catalog";
import { QuickAddGame } from "@/components/quick-add-game";
import { getCurrentUserStatus } from "@/lib/admin-auth";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userStatus = await getCurrentUserStatus();
  const legacyGames = games.map((game) => ({
    id: game.id,
    title: game.title,
    description: "",
    coverUrl: game.cardImage,
    category: game.tags[0] ?? "Jogos",
    tags: game.tags,
    featured: false,
    gameUrl: `/${game.url}`,
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
            {userStatus.isAdmin && <QuickAddGame />}
            {userStatus.signedIn ? (
              <>
                <Link className="button button-outline button-small" href="/profile">Meu perfil</Link>
                <LogoutButton />
              </>
            ) : (
              <Link className="button button-outline button-small" href="/login">Entrar</Link>
            )}
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
