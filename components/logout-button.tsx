"use client";

import { useState } from "react";

export function LogoutButton() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError("Não foi possível encerrar a sessão.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Erro de conexão ao encerrar a sessão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="button button-outline button-small" disabled={loading} onClick={signOut} type="button">
        {loading ? "Saindo..." : "Sair"}
      </button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </>
  );
}
