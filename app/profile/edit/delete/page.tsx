import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { ProfileSettingsTabs } from "@/components/profile-settings-tabs";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Autenticação não configurada</h1>
          <p>Configure as variáveis do Supabase para acessar sua conta.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão do usuário.", authError);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Não foi possível carregar sua conta</h1>
          <p role="alert">Tente atualizar a página ou entrar novamente.</p>
          <Link className="button button-outline" href="/login">Entrar</Link>
        </section>
      </main>
    );
  }
  if (!user) redirect("/login?next=%2Fprofile%2Fedit%2Fdelete");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Não foi possível carregar o perfil para confirmar a exclusão.", profileError);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Perfil ainda não disponível</h1>
          <p>Não foi possível carregar o nome de usuário para confirmar a exclusão.</p>
          <Link className="button button-outline" href="/profile/edit">Voltar às configurações</Link>
        </section>
      </main>
    );
  }

  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">F</span>
            <span>FrivPlus</span>
          </Link>
          <div className="profile-actions">
            <Link className="account-link" href="/profile">Ver meu perfil</Link>
            {isMaintenanceAdminEmail(user.email) && (
              <Link className="account-link" href="/admin">Painel admin</Link>
            )}
          </div>
        </div>
      </header>
      <main className="wrap profile-page">
        <div className="eyebrow">Sua conta</div>
        <h1>Configurações de perfil</h1>
        <p>Gerencie sua conta e as informações do seu perfil.</p>
        <ProfileSettingsTabs active="delete" />
        <DeleteAccountForm username={profile.username} />
      </main>
    </>
  );
}
