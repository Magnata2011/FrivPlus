import "server-only";

import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type PublicChangelog = { id: string; title: string; message: string };

export async function getPublicChangelogs(): Promise<{
  changelogs: PublicChangelog[];
  error: string | null;
}> {
  if (!isSupabaseConfigured()) return { changelogs: [], error: null };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_changelogs");
  if (error) {
    console.error("Não foi possível carregar os changelogs.", error);
    return {
      changelogs: [],
      error: "Não foi possível carregar as novidades agora.",
    };
  }
  return { changelogs: (data ?? []) as PublicChangelog[], error: null };
}
