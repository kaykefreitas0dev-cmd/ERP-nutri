import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutricore.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NutriCore — SaaS para nutricionistas",
    template: "%s | NutriCore",
  },
  description:
    "Plataforma completa para nutricionistas autônomos e clínicas: agenda, prontuário, planos alimentares, custeio, lembretes e PWA paciente.",
  keywords: [
    "nutricionista",
    "software nutricionista",
    "plano alimentar",
    "agenda nutricionista",
    "TACO",
    "prontuário eletrônico",
    "SaaS nutrição",
  ],
  authors: [{ name: "NutriCore" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "NutriCore",
    title: "NutriCore — SaaS para nutricionistas",
    description:
      "Agenda, prontuário, planos alimentares com custeio e PWA paciente. Construído para nutricionistas brasileiros.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-white text-slate-900">{children}</body>
    </html>
  );
}
