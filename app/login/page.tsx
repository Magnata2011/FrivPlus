import { LoginForm } from "@/components/login-form";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = Array.isArray(params.next) ? params.next[0] : params.next;
  const authError = Array.isArray(params.error) ? params.error[0] : params.error;
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">F</span>
          <span>FrivPlus</span>
        </Link>
        <h1>Entrar na administração</h1>
        <p>Use sua conta do Supabase Auth para continuar.</p>
        <LoginForm nextPath={nextPath} authError={authError} />
      </section>
    </main>
  );
}
