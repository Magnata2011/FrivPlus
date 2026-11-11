import type { Metadata } from "next";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FrivPlus — Jogos",
  description: "Explore e jogue títulos selecionados no FrivPlus.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let theme: "dark" | "light" = "dark";
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("Não foi possível carregar a preferência visual da conta.", authError);
    } else if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Não foi possível carregar o tema do perfil.", profileError);
      } else if (profile?.theme === "light" || profile?.theme === "dark") {
        theme = profile.theme;
      }
    }
  }

  return (
    <html lang="pt-BR" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
