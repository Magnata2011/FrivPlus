import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function getSafeNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/profile";
  }
  try {
    const url = new URL(value, "https://frivplus.invalid");
    return url.origin === "https://frivplus.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : "/profile";
  } catch {
    return "/profile";
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "A autenticação ainda não foi configurada." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitação de login inválida." }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json(
      { error: "Configure NEXT_PUBLIC_SITE_URL para habilitar o login Google." },
      { status: 503 },
    );
  }

  let redirectTo: string;
  try {
    const baseUrl = new URL(siteUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") {
      throw new Error("The site URL must use HTTPS.");
    }
    const callback = new URL("/auth/callback", baseUrl);
    callback.searchParams.set("next", getSafeNextPath(
      payload && typeof payload === "object" && "nextPath" in payload
        ? payload.nextPath
        : undefined,
    ));
    redirectTo = callback.toString();
  } catch {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL deve ser uma URL válida do site." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("Não foi possível iniciar o login Google.", error);
    return NextResponse.json(
      { error: "Não foi possível iniciar o login Google. Confira a configuração do provedor." },
      { status: 503 },
    );
  }

  return NextResponse.json({ url: data.url });
}
