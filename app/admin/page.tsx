import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdminPageStatus } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const status = await getAdminPageStatus();
  if (status === "signed-out") redirect("/login?next=%2Fadmin");
  if (status !== "allowed") {
    return (
      <main className="wrap">
        <section className="access-denied" role="alert">
          <div className="eyebrow">Acesso restrito</div>
          <h1>Acesso negado</h1>
          <p className="section-subtitle">
            Esta área está disponível somente para administradores autorizados.
          </p>
          <Link className="button button-outline" href="/">Voltar ao catálogo</Link>
        </section>
      </main>
    );
  }

  return <AdminDashboard />;
}
