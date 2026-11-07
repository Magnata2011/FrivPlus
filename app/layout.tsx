import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrivPlus — Jogos",
  description: "Explore e jogue títulos selecionados no FrivPlus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
