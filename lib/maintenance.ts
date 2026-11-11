import "server-only";

import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export function isMaintenanceAdminEmail(email: string | null | undefined) {
  const adminEmail = process.env.MAINTENANCE_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail && email?.trim().toLowerCase() === adminEmail);
}

export async function getMaintenanceEnabled() {
  if (!isSupabaseConfigured()) return true;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("enabled")
    .eq("id", "maintenance")
    .single();

  if (error) {
    console.error("Não foi possível carregar o estado de manutenção.", error);
    throw new Error("Falha ao carregar o estado de manutenção do Supabase.");
  }

  return data.enabled;
}
