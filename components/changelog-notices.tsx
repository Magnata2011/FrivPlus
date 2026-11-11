"use client";

import { useEffect, useState } from "react";

type Changelog = { id: string; title: string; message: string };

export function ChangelogNotices({
  changelogs,
  error,
}: {
  changelogs: Changelog[];
  error?: string | null;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("frivplus-dismissed-changelogs");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
          setDismissed(parsed);
        }
      }
    } catch (error) {
      console.error("Não foi possível carregar os changelogs dispensados.", error);
    }
  }, []);

  function dismiss(id: string) {
    const updated = [...new Set([...dismissed, id])];
    setDismissed(updated);
    try {
      window.localStorage.setItem("frivplus-dismissed-changelogs", JSON.stringify(updated));
    } catch (error) {
      console.error("Não foi possível salvar o changelog dispensado.", error);
    }
  }

  const visible = changelogs.filter(({ id }) => !dismissed.includes(id));
  if (visible.length === 0 && !error) return null;

  return (
    <aside className="changelog-notices" aria-label="Novidades do FrivPlus">
      {error && <p className="form-error" role="alert">{error}</p>}
      {visible.map(({ id, title, message }) => (
        <article className="changelog-notice" key={id}>
          <div>
            <span className="admin-card-label">Novidade</span>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
          <button
            className="changelog-dismiss"
            type="button"
            aria-label={`Fechar aviso: ${title}`}
            onClick={() => dismiss(id)}
          >
            ×
          </button>
        </article>
      ))}
    </aside>
  );
}
