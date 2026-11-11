"use client";

import { useState, type FormEvent } from "react";

export function ChangelogAdminForm() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/changelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          message: formData.get("message"),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível publicar o changelog.");
        return;
      }
      form.reset();
      setNotice("Changelog publicado na página inicial.");
    } catch {
      setError("Erro de conexão ao publicar o changelog.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="changelog-admin-form" onSubmit={submit}>
      <label className="label">
        Título
        <input className="field-input" name="title" required maxLength={100} />
      </label>
      <label className="label">
        Mensagem
        <textarea className="field-input field-textarea" name="message" required maxLength={2000} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <button className="button button-primary" type="submit" disabled={saving}>
        {saving ? "Publicando..." : "Publicar changelog"}
      </button>
    </form>
  );
}
