import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ProfileEditor } from "@/components/profile-editor";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Não foi possível validar a sessão do usuário.", error);
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
  if (!user) redirect("/login?next=%2Fprofile");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, display_name, bio")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Não foi possível carregar os dados do perfil.", profileError);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Perfil ainda não disponível</h1>
          <p>Execute a migration de perfis do Supabase e entre novamente.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
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
            <Link className="account-link" href="/">Voltar ao catálogo</Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="wrap profile-page">
        <div className="eyebrow">Sua conta</div>
        <h1>Meu perfil</h1>
        <p>Gerencie seus dados públicos e confira o e-mail vinculado à sua conta.</p>
        <section className="account-email-card" aria-label="E-mail da conta">
          <div>
            <strong>E-mail da conta</strong>
            <p>{user.email ?? "E-mail indisponível"}</p>
          </div>
          <span className={user.email_confirmed_at ? "email-status email-verified" : "email-status"}>
            {user.email_confirmed_at ? "E-mail confirmado" : "E-mail não confirmado"}
          </span>
        </section>
        <ProfileEditor profile={profile} />
      </main>
    </>
  );
}
