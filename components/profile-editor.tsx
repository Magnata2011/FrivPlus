"use client";

import { useState, type FormEvent } from "react";

export type EditableProfile = {
  username: string | null;
  display_name: string;
  bio: string;
};

export function ProfileEditor({ profile: initialProfile }: { profile: EditableProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <section className="profile-card">
      <div className="profile-avatar-area">
        <div className="profile-avatar profile-avatar-placeholder" aria-hidden="true">
          {(profile.display_name || profile.username || "?").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <strong>{profile.display_name || "Seu perfil"}</strong>
          <span>{profile.username ? `@${profile.username}` : "Escolha um nome de usuário"}</span>
        </div>
      </div>
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
