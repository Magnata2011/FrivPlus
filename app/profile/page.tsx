import Link from "next/link";
import { redirect } from "next/navigation";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
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
    .select("username, display_name, bio, avatar_path, banner_path")
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
  const displayName = profile.display_name || profile.username || "Seu perfil";

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
            {isMaintenanceAdminEmail(user.email) && (
              <Link className="account-link" href="/admin">Painel admin</Link>
            )}
          </div>
        </div>
      </header>
      <main className="wrap profile-page">
        <div className="profile-preview">
          <div
            className="profile-preview-banner"
            role={bannerUrl ? "img" : undefined}
            aria-label={bannerUrl ? `Banner de ${displayName}` : undefined}
            style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : undefined}
          />
          <div className="profile-preview-content">
            <div className="profile-preview-heading">
              {avatarUrl ? (
                <div
                  className="profile-avatar profile-avatar-image profile-preview-avatar"
                  role="img"
                  aria-label={`Foto de ${displayName}`}
                  style={{ backgroundImage: `url("${avatarUrl}")` }}
                />
              ) : (
                <div className="profile-avatar profile-avatar-placeholder profile-preview-avatar" aria-hidden="true">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <Link className="button button-primary profile-customize-button" href="/profile/edit">
                Personalizar perfil
              </Link>
            </div>
            <div className="profile-preview-identity">
              <h1>{displayName}</h1>
              <span>{profile.username ? `@${profile.username}` : "FrivPlus"}</span>
            </div>
            <section className="profile-preview-about" aria-labelledby="profile-about-title">
              <h2 id="profile-about-title">Sobre mim</h2>
              <p>{profile.bio || "Este perfil ainda não tem uma biografia."}</p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
