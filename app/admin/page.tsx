import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { MaintenanceToggle } from "@/components/maintenance-toggle";
import { getMaintenanceEnabled, isMaintenanceAdminEmail } from "@/lib/maintenance";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Painel indisponível</h1>
          <p>Configure a autenticação para acessar o painel administrativo.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Não foi possível validar a sessão administrativa.", error);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Não foi possível abrir o painel</h1>
          <p>Tente entrar novamente.</p>
          <Link className="button button-primary" href="/login?next=%2Fadmin">Entrar</Link>
        </section>
      </main>
    );
  }
  if (!user) redirect("/login?next=%2Fadmin");
  if (!isMaintenanceAdminEmail(user.email)) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Acesso restrito</h1>
          <p>Esta conta não está autorizada a acessar o painel administrativo.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  const maintenanceEnabled = await getMaintenanceEnabled();

  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">F</span>
            <span>FrivPlus</span>
          </Link>
          <div className="profile-actions">
            <Link className="account-link" href="/catalog">Abrir catálogo</Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="wrap admin-page">
        <div className="eyebrow">Administração</div>
        <h1>Painel do administrador</h1>
        <p className="admin-intro">Controles e atalhos da conta responsável pelo FrivPlus.</p>

        <section className="admin-card" aria-labelledby="maintenance-heading">
          <div>
            <span className="admin-card-label">Visibilidade do site</span>
            <h2 id="maintenance-heading">Aviso de manutenção</h2>
            <p>
              {maintenanceEnabled
                ? "O aviso está ligado. Visitantes ainda podem escolher continuar para o catálogo."
                : "O aviso está desligado e o catálogo é a página inicial."}
            </p>
          </div>
          <MaintenanceToggle enabled={maintenanceEnabled} />
        </section>

        <section className="admin-card" aria-labelledby="account-heading">
          <div>
            <span className="admin-card-label">Conta atual</span>
            <h2 id="account-heading">Acesso administrativo</h2>
            <p>{user.email ?? "E-mail indisponível"}</p>
          </div>
          <Link className="button button-outline" href="/profile">Gerenciar perfil</Link>
        </section>

        <section className="admin-card" aria-labelledby="future-heading">
          <div>
            <span className="admin-card-label">Próximos recursos</span>
            <h2 id="future-heading">Salvamento de progresso</h2>
            <p>
              A base local para salvamentos está preparada. Cada jogo precisará ser
              integrado para identificar e registrar seu próprio progresso.
            </p>
          </div>
          <span className="admin-status">Preparação em andamento</span>
        </section>
      </main>
    </>
  );
}
