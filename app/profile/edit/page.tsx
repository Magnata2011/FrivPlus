import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ProfileEditor } from "@/components/profile-editor";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
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
  if (!user) redirect("/login?next=%2Fprofile%2Fedit");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_path, banner_path, theme")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Não foi possível carregar os dados do perfil.", profileError);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Perfil ainda não disponível</h1>
          <p>Execute as migrations de perfis e avatares do Supabase e entre novamente.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;
  const bannerUrl = profile.banner_path
    ? supabase.storage.from("profile-banners").getPublicUrl(profile.banner_path).data.publicUrl
    : null;

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
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="wrap profile-page">
        <div className="eyebrow">Sua conta</div>
        <h1>Personalizar perfil</h1>
        <p>Atualize as informações que aparecem na vista do seu perfil.</p>
        <section className="account-email-card" aria-label="E-mail da conta">
          <div>
            <strong>E-mail da conta</strong>
            <p>{user.email ?? "E-mail indisponível"}</p>
          </div>
          <span className={user.email_confirmed_at ? "email-status email-verified" : "email-status"}>
            {user.email_confirmed_at ? "E-mail confirmado" : "E-mail não confirmado"}
          </span>
        </section>
        <ProfileEditor profile={profile} avatarUrl={avatarUrl} bannerUrl={bannerUrl} />
      </main>
    </>
  );
}
