import Link from "next/link";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function AccountNavigation() {
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
        <Link className="account-link" href="/login">Entrar (opcional)</Link>
      </nav>
    );
  }

  return (
    <nav className="account-nav" aria-label="Conta">
      {user ? (
        <>
          <Link className="button button-outline" href="/profile">Minha conta</Link>
          {isMaintenanceAdminEmail(user.email) && (
            <Link className="button button-outline" href="/admin">Painel admin</Link>
          )}
        </>
      ) : (
        <>
          <Link className="account-link" href="/login">Entrar (opcional)</Link>
          <Link className="button button-outline" href="/signup">Criar conta</Link>
        </>
      )}
    </nav>
  );
}
