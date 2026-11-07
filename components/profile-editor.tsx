"use client";

import { useEffect, useState, type FormEvent } from "react";

type Profile = {
  username: string | null;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
};

export function ProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { profile?: Profile; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar o perfil.");
        if (active && result.profile) {
          setProfile(result.profile);
          setAvatarPreview(result.profile.avatarUrl ?? "");
          setBannerPreview(result.profile.bannerUrl ?? "");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar o perfil.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!avatar) return;
    const url = URL.createObjectURL(avatar);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  useEffect(() => {
    if (!banner) return;
    const url = URL.createObjectURL(banner);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [banner]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    if (avatar) form.set("avatar", avatar);
    if (banner) form.set("banner", banner);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", body: form });
      const result = (await response.json()) as {
        profile?: Profile;
        error?: string;
        warning?: string;
      };
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fprofile");
        return;
      }
      if (!response.ok || !result.profile) {
        setError(result.error ?? "Não foi possível salvar o perfil.");
        return;
      }
      setProfile(result.profile);
      setAvatar(null);
      setBanner(null);
      setAvatarPreview(result.profile.avatarUrl ?? "");
      setBannerPreview(result.profile.bannerUrl ?? "");
      setNotice(result.warning ?? "Perfil atualizado.");
    } catch {
      setError("Erro de conexão ao salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="empty-state">Carregando seu perfil...</p>;
  if (!profile) {
    return <p className="form-error" role="alert">{error || "Não foi possível carregar o perfil."}</p>;
  }

  return (
    <section className="profile-card">
      <div
        className={`profile-banner${bannerPreview ? " has-image" : ""}`}
        style={bannerPreview ? { backgroundImage: `url("${bannerPreview}")` } : undefined}
        aria-label="Prévia do banner do perfil"
      >
        <span>Banner do perfil</span>
      </div>
      <div className="profile-avatar-area">
        {avatarPreview ? (
          <img className="profile-avatar" src={avatarPreview} alt="Prévia da foto de perfil" />
        ) : (
          <div className="profile-avatar profile-avatar-placeholder" aria-hidden="true">
            {(profile.displayName || profile.username || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <strong>{profile.displayName || "Seu perfil"}</strong>
          <span>{profile.username ? `@${profile.username}` : "Escolha um nome de usuário"}</span>
        </div>
      </div>
      <form className="profile-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="label">
            Nome de exibição
            <input className="field-input" name="displayName" defaultValue={profile.displayName} maxLength={60} />
          </label>
          <label className="label">
            Nome de usuário
            <input
              className="field-input"
              name="username"
              defaultValue={profile.username ?? ""}
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]{3,24}"
              placeholder="exemplo_123"
            />
            <span className="field-hint">3–24 letras, números ou sublinhados; deve ser único.</span>
          </label>
          <label className="label full-width">
            Biografia
            <textarea className="field-textarea" name="bio" defaultValue={profile.bio} maxLength={500} placeholder="Conte um pouco sobre você..." />
            <span className="field-hint">Até 500 caracteres.</span>
          </label>
          <label className="label">
            Foto de perfil
            <input
              className="file-input"
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
            />
            <span className="field-hint">JPEG, PNG ou WebP · máximo 2 MB</span>
          </label>
          <label className="label">
            Banner
            <input
              className="file-input"
              type="file"
              name="banner"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setBanner(event.target.files?.[0] ?? null)}
            />
            <span className="field-hint">JPEG, PNG ou WebP · máximo 2,5 MB (3,5 MB com a foto)</span>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="profile-form-footer">
          <span className="field-hint">Foto e banner somados: até 3,5 MB. Seus dados ficam privados na sua conta.</span>
          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </form>
    </section>
  );
}
