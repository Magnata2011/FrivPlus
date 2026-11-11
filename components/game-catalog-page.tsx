import Link from "next/link";
import { Catalog } from "@/components/catalog";
import { catalogGames } from "@/lib/catalog-games";
import { ChangelogNotices } from "@/components/changelog-notices";
import { getPublicChangelogs } from "@/lib/changelogs";

export async function GameCatalogPage({ maintenanceEnabled }: { maintenanceEnabled: boolean }) {
  const { changelogs, error } = await getPublicChangelogs();

  return (
    <>
      {maintenanceEnabled && (
        <aside className="catalog-maintenance-notice">
          O aviso de manutenção continua ativo. Você escolheu continuar para o catálogo.
          <Link href="/">Ver aviso</Link>
        </aside>
      )}
      <main className="wrap">
        <ChangelogNotices changelogs={changelogs} error={error} />
        <section className="hero">
          <div className="eyebrow">Jogue algo novo</div>
          <h1>Seu próximo jogo favorito está aqui.</h1>
          <p>Uma coleção de jogos para descobrir, explorar e jogar.</p>
        </section>
        <Catalog initialGames={catalogGames} />
      </main>
      <footer className="site-footer">
        <div className="wrap">FrivPlus · Uma coleção feita para jogar.</div>
      </footer>
    </>
  );
}
