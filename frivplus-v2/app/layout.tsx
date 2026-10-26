import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrivPlus — Jogos para descobrir",
  description: "Descubra jogos, acompanhe seu progresso e salve suas partidas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
