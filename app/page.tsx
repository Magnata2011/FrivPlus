import { GameCatalogPage } from "@/components/game-catalog-page";
import { getMaintenanceEnabled } from "@/lib/maintenance";
import Link from "next/link";

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
          <Link className="button button-outline maintenance-continue" href="/catalog">
            Continuar mesmo assim
          </Link>
        </section>
        <footer className="maintenance-footer">
          Obrigado pela compreensão.
        </footer>
      </main>
    );
  }

  return <GameCatalogPage maintenanceEnabled={maintenanceEnabled} />;
}
