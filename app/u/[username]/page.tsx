import Link from "next/link";
import { notFound } from "next/navigation";
import { FriendshipButton } from "@/components/friendship-button";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { PresenceBadge } from "@/components/presence-badge";
import { catalogGames } from "@/lib/catalog-games";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Autenticação não configurada</h1>
          <p>Configure as variáveis do Supabase para acessar perfis.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  const { username } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: profiles, error } = await supabase.rpc("get_public_profile", {
    p_username: username,
  });
  if (error) {
    console.error("Não foi possível carregar o perfil público.", error);
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Não foi possível carregar o perfil</h1>
          <p role="alert">Tente atualizar a página.</p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  const profile = profiles[0];
  if (!profile) notFound();

  const displayName = profile.display_name || profile.username;
  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;
  const bannerUrl = profile.banner_path
    ? supabase.storage.from("profile-banners").getPublicUrl(profile.banner_path).data.publicUrl
    : null;

  return (
    <>
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
            </div>
            <div className="profile-preview-identity">
              <h1>{displayName}</h1>
              <div className="public-profile-identity">
                <span>@{profile.username}</span>
                <FriendshipButton username={profile.username} />
              </div>
              <PresenceBadge
                online={profile.is_online}
                gameName={catalogGames.find(({ id }) => id === profile.current_game_id)?.title ?? null}
              />
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
