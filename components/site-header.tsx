import Link from "next/link";
import { AccountNavigation } from "@/components/account-navigation";
import { CatalogSearch } from "@/components/catalog-search";
import { catalogGames } from "@/lib/catalog-games";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/" aria-label="FrivPlus, início">
          <span className="brand-mark">F</span>
          <span>FrivPlus</span>
        </Link>
        <div className="header-actions">
          <Link className="header-chat-link" href="/chat">Chat</Link>
          <CatalogSearch games={catalogGames} />
          <AccountNavigation />
        </div>
      </div>
    </header>
  );
}
