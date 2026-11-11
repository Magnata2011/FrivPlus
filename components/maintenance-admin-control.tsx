import Link from "next/link";
import { MaintenanceToggle } from "@/components/maintenance-toggle";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function MaintenanceAdminControl({ enabled }: { enabled: boolean }) {
  if (!isSupabaseConfigured()) {
    return (
      <Link className="maintenance-admin-link" href="/login?next=%2F">
        Acesso do responsável
      </Link>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Não foi possível verificar o responsável pela manutenção.", error);
    return <p className="maintenance-admin-error" role="alert">Não foi possível validar o acesso administrativo.</p>;
  }

  if (!isMaintenanceAdminEmail(user?.email)) {
    return (
      <Link className="maintenance-admin-link" href="/login?next=%2F">
        Acesso do responsável
      </Link>
    );
  }

  return (
    <div className="maintenance-admin-actions">
      <MaintenanceToggle enabled={enabled} />
      <Link className="maintenance-admin-link" href="/admin">Abrir painel do administrador</Link>
    </div>
  );
}
