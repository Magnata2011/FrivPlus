import { NextResponse } from "next/server";
import { isMaintenanceAdminEmail } from "@/lib/maintenance";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  isSupabaseConfigured,
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let validOrigin = false;
  try {
    validOrigin = Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
  } catch {
    validOrigin = false;
  }
  if (!validOrigin) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados de manutenção inválidos." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || !("enabled" in payload) ||
      typeof payload.enabled !== "boolean") {
    return NextResponse.json({ error: "Informe o novo estado da manutenção." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "A autenticação ainda não foi configurada." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Não foi possível validar a sessão administrativa.", authError);
    return NextResponse.json({ error: "Não foi possível validar sua sessão." }, { status: 401 });
  }
  if (!user || !isMaintenanceAdminEmail(user.email)) {
    return NextResponse.json({ error: "Acesso restrito ao responsável pelo site." }, { status: 403 });
  }

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Configure SUPABASE_SERVICE_ROLE_KEY para habilitar o controle de manutenção." },
      { status: 503 },
    );
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const { error } = await serviceClient
    .from("site_settings")
    .update({ enabled: payload.enabled, updated_at: new Date().toISOString() })
    .eq("id", "maintenance");

  if (error) {
    console.error("Não foi possível salvar o estado de manutenção.", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o estado de manutenção no Supabase." },
      { status: 500 },
    );
  }

  return NextResponse.json({ enabled: payload.enabled });
}
