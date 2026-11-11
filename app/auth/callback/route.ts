import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }

  return NextResponse.redirect(new URL("/profile", request.url));
}
