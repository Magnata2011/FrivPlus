import Link from "next/link";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">F</span>
          <span>FrivPlus</span>
        </Link>
        <h1>Criar conta</h1>
        <p>Cadastre-se para acessar seu perfil no FrivPlus.</p>
        <SignupForm />
      </section>
    </main>
  );
}
