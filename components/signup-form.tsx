"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function SignupForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const result = await response.json() as {
        error?: string;
        confirmationRequired?: boolean;
        signedUp?: boolean;
      };
      if (!response.ok) {
        setError(result.error ?? "Não foi possível criar a conta.");
        return;
      }
      if (result.confirmationRequired) {
        setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.");
        return;
      }
      if (result.signedUp) {
        window.location.assign("/profile");
        return;
      }
      setError("Não foi possível concluir o cadastro.");
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
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="field-hint">Use pelo menos 8 caracteres.</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      <button className="button button-primary" disabled={loading} type="submit">
        {loading ? "Criando conta..." : "Criar conta"}
      </button>
      <Link className="text-button" href="/login">Já tem uma conta? Entrar</Link>
    </form>
  );
}
