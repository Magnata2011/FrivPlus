import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { getAdminPageStatus } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const status = await getAdminPageStatus();
  if (status === "allowed") {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="eyebrow">Sessão ativa</div>
          <h1>Você já entrou</h1>
          <p>Abra o painel para continuar administrando os jogos.</p>
          <Link className="button button-primary" href="/admin">Abrir administração</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">F</span>
          <span>FrivPlus</span>
        </Link>
        <h1>Criar sua conta</h1>
        <p>Cadastre-se para entrar no FrivPlus.</p>
        <SignupForm />
      </section>
    </main>
  );
}
