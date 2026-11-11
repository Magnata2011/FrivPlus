"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AvatarCropper } from "@/components/avatar-cropper";

export type EditableProfile = {
  username: string | null;
  display_name: string;
  bio: string;
  theme: "dark" | "light";
};

export function ProfileEditor({
  profile: initialProfile,
  avatarUrl: initialAvatarUrl,
  bannerUrl: initialBannerUrl,
}: {
  profile: EditableProfile;
  avatarUrl: string | null;
  bannerUrl: string | null;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function saveTheme(theme: EditableProfile["theme"]) {
    if (theme === profile.theme || savingTheme) return;
    setError("");
    setNotice("");
    setSavingTheme(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const result = await response.json() as { theme?: EditableProfile["theme"]; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fprofile");
        return;
      }
      if (!response.ok || result.theme !== theme) {
        setError(result.error ?? "Não foi possível salvar o tema.");
        return;
      }

      setProfile((current) => ({ ...current, theme }));
      document.documentElement.dataset.theme = theme;
      setNotice(`Tema ${theme === "dark" ? "escuro" : "claro"} ativado para sua conta.`);
    } catch {
      setError("Erro de conexão ao salvar o tema.");
    } finally {
      setSavingTheme(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          displayName: formData.get("displayName"),
          bio: formData.get("bio"),
        }),
      });
      const result = await response.json() as { profile?: EditableProfile; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fprofile");
        return;
      }
      if (!response.ok || !result.profile) {
        setError(result.error ?? "Não foi possível salvar o perfil.");
        return;
      }

      setProfile(result.profile);
      setNotice("Perfil atualizado.");
    } catch {
      setError("Erro de conexão ao salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) {
      setError("Escolha uma imagem antes de enviar.");
      return;
    }
    setError("");
    setNotice("");
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.set("avatar", avatarFile);

    try {
      const response = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const result = await response.json() as { avatarUrl?: string; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fprofile");
        return;
      }
      if (!response.ok || !result.avatarUrl) {
        setError(result.error ?? "Não foi possível atualizar a foto.");
        return;
      }
      setAvatarUrl(result.avatarUrl);
      setAvatarFile(null);
      setNotice("Foto de perfil atualizada.");
    } catch {
      setError("Erro de conexão ao enviar a foto.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function uploadBanner() {
    if (!bannerFile) {
      setError("Escolha uma imagem antes de enviar.");
      return;
    }
    setError("");
    setNotice("");
    setUploadingBanner(true);
    const formData = new FormData();
    formData.set("banner", bannerFile);

    try {
      const response = await fetch("/api/profile/banner", { method: "POST", body: formData });
      const result = await response.json() as { bannerUrl?: string; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?next=%2Fprofile%2Fedit");
        return;
      }
      if (!response.ok || !result.bannerUrl) {
        setError(result.error ?? "Não foi possível atualizar o banner.");
        return;
      }
      setBannerUrl(result.bannerUrl);
      setBannerFile(null);
      setNotice("Banner atualizado.");
    } catch {
      setError("Erro de conexão ao enviar o banner.");
    } finally {
      setUploadingBanner(false);
    }
  }

  return (
    <section className="profile-card">
      <div className="profile-avatar-area">
        {avatarPreviewUrl || avatarUrl ? (
          <div
            className="profile-avatar profile-avatar-image"
            role="img"
            aria-label="Foto de perfil"
            style={{ backgroundImage: `url("${avatarPreviewUrl ?? avatarUrl}")` }}
          />
        ) : (
          <div className="profile-avatar profile-avatar-placeholder" aria-hidden="true">
            {(profile.display_name || profile.username || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <strong>{profile.display_name || "Seu perfil"}</strong>
          <span>{profile.username ? `@${profile.username}` : "Escolha um nome de usuário"}</span>
        </div>
      </div>
      <div className="avatar-upload">
        <label className="label">
          Foto de perfil
          <input
            className="field-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (!file) return;
              setAvatarFile(null);
              if (file.size > 3 * 1024 * 1024) {
                setError("Escolha uma imagem de até 3 MB.");
                return;
              }
              setError("");
              setAvatarCropFile(file);
            }}
          />
          <span className="field-hint">PNG, JPG ou WebP; até 3 MB. A imagem ficará pública.</span>
        </label>
        <button
          className="button button-outline"
          disabled={!avatarFile || uploadingAvatar || Boolean(avatarCropFile)}
          onClick={uploadAvatar}
          type="button"
        >
          {uploadingAvatar ? "Enviando foto..." : "Enviar foto"}
        </button>
      </div>
      {avatarCropFile && (
        <AvatarCropper
          file={avatarCropFile}
          onCancel={() => setAvatarCropFile(null)}
          onSave={(file) => {
            setAvatarFile(file);
            setAvatarCropFile(null);
          }}
        />
      )}
      <div className="banner-upload">
        <div
          className="banner-upload-preview"
          role={bannerUrl ? "img" : undefined}
          aria-label={bannerUrl ? "Prévia do banner do perfil" : "Prévia do banner padrão"}
          style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : undefined}
        />
        <label className="label">
          Banner do perfil
          <input
            className="field-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}
          />
          <span className="field-hint">PNG, JPG ou WebP; até 5 MB.</span>
        </label>
        <button
          className="button button-outline"
          disabled={!bannerFile || uploadingBanner}
          onClick={() => void uploadBanner()}
          type="button"
        >
          {uploadingBanner ? "Enviando banner..." : "Enviar banner"}
        </button>
      </div>
      <section className="profile-appearance" aria-labelledby="profile-appearance-title">
        <div>
          <h2 id="profile-appearance-title">Aparência</h2>
          <p>Essa preferência fica salva somente na sua conta.</p>
        </div>
        <div className="theme-options" role="group" aria-label="Tema da conta">
          <button
            className={`button ${profile.theme === "dark" ? "button-primary" : "button-outline"}`}
            type="button"
            aria-pressed={profile.theme === "dark"}
            disabled={savingTheme}
            onClick={() => void saveTheme("dark")}
          >
            Modo escuro
          </button>
          <button
            className={`button ${profile.theme === "light" ? "button-primary" : "button-outline"}`}
            type="button"
            aria-pressed={profile.theme === "light"}
            disabled={savingTheme}
            onClick={() => void saveTheme("light")}
          >
            Modo claro
          </button>
          {savingTheme && <span className="field-hint" role="status">Salvando tema...</span>}
        </div>
      </section>
      <form className="profile-form" onSubmit={submit}>
        <label className="label">
          Nome de exibição
          <input
            className="field-input"
            name="displayName"
            value={profile.display_name}
            maxLength={60}
            autoComplete="nickname"
            onChange={(event) => setProfile({ ...profile, display_name: event.target.value })}
          />
          <span className="field-hint">Até 60 caracteres.</span>
        </label>
        <label className="label">
          Nome de usuário
          <input
            className="field-input"
            name="username"
            value={profile.username ?? ""}
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]{3,24}"
            placeholder="exemplo_123"
            autoComplete="username"
            onChange={(event) => setProfile({ ...profile, username: event.target.value })}
          />
          <span className="field-hint">3–24 letras, números ou sublinhados; deve ser único.</span>
        </label>
        <label className="label">
          Biografia
          <textarea
            className="field-input field-textarea"
            name="bio"
            value={profile.bio}
            maxLength={500}
            placeholder="Conte um pouco sobre você..."
            onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
          />
          <span className="field-hint">Até 500 caracteres. Seu perfil e seus dados são privados.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="profile-form-footer">
          <span className="field-hint">O nome de usuário não diferencia maiúsculas de minúsculas.</span>
          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </form>
    </section>
  );
}
