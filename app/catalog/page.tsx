import { GameCatalogPage } from "@/components/game-catalog-page";
import { getMaintenanceEnabled } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const maintenanceEnabled = await getMaintenanceEnabled();
  return <GameCatalogPage maintenanceEnabled={maintenanceEnabled} />;
}
