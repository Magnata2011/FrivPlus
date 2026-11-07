"use client";

import { useState, type FormEvent } from "react";

export function QuickAddGame() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = new FormData(event.currentTarget);
    form.set("description", "");
    form.set("category", "Geral");
    form.set("featured", "false");
    form.set("published", "true");

    try {
      const response = await fetch("/api/admin/games", { method: "POST", body: form });
      const result = (await response.json()) as { error?: string };
      if (response.status === 401 || response.status === 403) {
        setError("Sua sessão não tem autorização para adicionar jogos.");
        return;
      }
      if (!response.ok) {
        setError(result.error ?? "Não foi possível adicionar o jogo.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Erro de conexão ao adicionar o jogo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="button button-primary button-small" onClick={() => setOpen(true)} type="button">
        Adicionar jogo
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="game-modal quick-game-modal" role="dialog" aria-modal="true" aria-labelledby="quick-game-title">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">Administração</div>
                <h2 id="quick-game-title">Adicionar jogo</h2>
              </div>
              <button className="button button-outline button-small" onClick={() => setOpen(false)} type="button">
                Fechar
              </button>
            </div>
            <form className="stack" onSubmit={submit}>
              <label className="label">
                ID do jogo *
                <input className="field-input" name="id" maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}" required />
              </label>
              <label className="label">
                Nome do jogo *
                <input className="field-input" name="title" maxLength={100} required />
              </label>
              <label className="label">
                Link da capa da imagem *
                <input className="field-input" name="coverUrl" type="url" placeholder="https://..." required />
              </label>
              <label className="label">
                Tags do jogo
                <input className="field-input" name="tags" maxLength={310} placeholder="Ação, Aventura, Casual" />
                <span className="field-hint">Separe as tags por vírgula.</span>
              </label>
              <label className="label">
                Link do jogo *
                <input className="field-input" name="gameUrl" type="url" placeholder="https://..." required />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal-footer">
                <span className="field-hint">O novo jogo será publicado imediatamente.</span>
                <button className="button button-primary" type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Adicionar jogo"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
