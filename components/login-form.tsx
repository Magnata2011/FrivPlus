"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function LoginForm({
  nextPath,
  authError,
}: {
  nextPath?: string;
  authError?: string;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const notice = authError === "auth_unavailable"
    ? "A autenticação ainda não foi configurada."
    : authError === "oauth_failed"
      ? "Não foi possível concluir o login Google. Tente novamente."
    : authError
      ? "Não foi possível confirmar o cadastro. Entre novamente ou tente cadastrar outra vez."
      : "";

  async function signInWithGoogle() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextPath }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        setError(result.error ?? "Não foi possível iniciar o login Google.");
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Erro de conexão ao iniciar o login Google.");
    } finally {
      setLoading(false);
    }
  }

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
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível entrar.");
        return;
      }

      let destination = "/profile";
      if (nextPath) {
        try {
          const parsed = new URL(nextPath, window.location.origin);
          if (parsed.origin === window.location.origin) {
            destination = `${parsed.pathname}${parsed.search}${parsed.hash}`;
          }
        } catch {
          setError("O endereço de destino é inválido.");
          return;
        }
      }
      window.location.assign(destination);
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
        <input
          className="field-input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-error" role="alert">{notice}</p>}
      <button className="button button-primary" disabled={loading} type="submit">
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <div className="auth-divider"><span>ou</span></div>
      <button
        className="button button-outline google-button"
        disabled={loading}
        onClick={signInWithGoogle}
        type="button"
      >
        {loading ? "Conectando..." : "Continuar com Google"}
      </button>
      <p className="field-hint auth-optional-note">Criar conta e entrar são opcionais para jogar.</p>
      <Link className="text-button" href="/signup">Ainda não tem uma conta? Cadastre-se</Link>
      <Link className="text-button" href="/">Voltar ao catálogo</Link>
    </form>
  );
}
