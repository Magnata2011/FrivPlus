import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    const error = request.nextUrl.searchParams.has("error")
      ? "oauth_failed"
      : "confirmation_failed";
    return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/profile";
  try {
    const url = new URL(value, "https://frivplus.invalid");
    return url.origin === "https://frivplus.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : "/profile";
  } catch {
    return "/profile";
  }
}
