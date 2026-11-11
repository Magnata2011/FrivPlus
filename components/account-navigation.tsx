import Link from "next/link";
import { MaintenanceToggle } from "@/components/maintenance-toggle";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function AccountNavigation({ maintenanceEnabled }: { maintenanceEnabled: boolean }) {
  if (!isSupabaseConfigured()) {
    return (
      <nav className="account-nav" aria-label="Conta">
        <Link className="account-link" href="/login">Entrar</Link>
        <Link className="button button-outline" href="/signup">Criar conta</Link>
      </nav>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Não foi possível verificar a sessão do usuário.", error);
    return (
      <nav className="account-nav" aria-label="Conta">
        <span className="form-error" role="status">Falha ao verificar sua conta.</span>
      </nav>
    );
  }

  return (
    <nav className="account-nav" aria-label="Conta">
      {user ? (
        <>
          <Link className="button button-outline" href="/profile">Minha conta</Link>
          {isMaintenanceAdminEmail(user.email) && (
            <MaintenanceToggle enabled={maintenanceEnabled} />
          )}
        </>
      ) : (
        <>
          <Link className="account-link" href="/login">Entrar</Link>
          <Link className="button button-outline" href="/signup">Criar conta</Link>
        </>
      )}
    </nav>
  );
}
