"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export function LoginForm({
  nextPath,
  authError,
}: {
  nextPath?: string;
  authError?: string;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice] = useState(
    authError === "auth_unavailable"
      ? "A autenticação ainda não está configurada."
      : authError
        ? "Não foi possível entrar com Google. Tente novamente."
        : "",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível entrar.");
        return;
      }
      const destination = new URL(nextPath || "/admin", window.location.origin);
      window.location.assign(
        destination.origin === window.location.origin ? destination.href : "/admin",
      );
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="label">
        E-mail
        <input className="field-input" type="email" name="email" autoComplete="email" required />
      </label>
      <label className="label">
        Senha
        <input className="field-input" type="password" name="password" autoComplete="current-password" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={loading} type="submit">
        {loading ? "Entrando..." : "Entrar"}
      </button>
      {notice && <p className="form-error" role="alert">{notice}</p>}
      <div className="login-alternatives">
        <Link className="button button-outline" href="/signup">Criar conta</Link>
        <a className="button button-outline" href="/api/auth/google">
          Entrar com Google
        </a>
      </div>
      <Link className="text-button" href="/">Voltar ao catálogo</Link>
    </form>
  );
}
