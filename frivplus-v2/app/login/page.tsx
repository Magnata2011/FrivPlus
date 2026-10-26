"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Login realizado. A área do usuário será implementada na próxima etapa.");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(data.session ? "Conta criada com sucesso." : "Conta solicitada! Confira seu e-mail para confirmar o cadastro.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="authbox">
        <Link className="brand" href="/">Friv<span>Plus</span></Link>
        <h1>{mode === "login" ? "Bem-vindo de volta." : "Crie sua conta."}</h1>
        <p className="muted">{mode === "login" ? "Entre para acessar seu espaço." : "Prepare sua conta para salvar seu progresso."}</p>
        <form onSubmit={handleSubmit}>
          <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="password">Senha (mínimo de 8 caracteres)</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button className="btn primary full" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
        </form>
        {message && <p className="message" role="status" style={{ marginTop: 16 }}>{message}</p>}
        <p className="authback">{mode === "login" ? "Ainda não tem conta? " : "Já tem uma conta? "}<button className="btn" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "Cadastrar" : "Entrar"}</button></p>
        <Link className="authback" href="/">← Voltar ao início</Link>
      </section>
    </main>
  );
}
