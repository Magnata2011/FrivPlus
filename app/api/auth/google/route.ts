import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", request.url));
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback", getSiteUrl(request.url)).toString(),
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", request.url));
  }
  return NextResponse.redirect(data.url);
}
