import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/", request.url));
    } catch {
      return NextResponse.redirect(new URL("/login?error=auth_unavailable", request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?error=google_login_failed", request.url));
}
