import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type PublicProfileSearchResult = {
  username: string;
  display_name: string;
  avatar_path: string | null;
};

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "A autenticação ainda não foi configurada." }, { status: 503 });
  }

  const searchParams = new URL(request.url).searchParams;
  const query = (searchParams.get("q") ?? "").trim().replace(/^@/, "").slice(0, 40);
  if (query.length < 2) {
    return NextResponse.json({ profiles: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_public_profiles", { p_search_query: query });
  if (error) {
    console.error("Não foi possível pesquisar perfis públicos.", error);
    return NextResponse.json({ error: "Não foi possível pesquisar perfis." }, { status: 500 });
  }

  const searchResults = data as PublicProfileSearchResult[] | null;
  const profiles = (searchResults ?? []).map((profile) => ({
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_path
      ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
      : null,
  }));
  return NextResponse.json({ profiles }, { headers: { "Cache-Control": "no-store" } });
}
