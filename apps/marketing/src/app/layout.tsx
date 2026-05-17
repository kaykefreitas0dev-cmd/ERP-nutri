import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

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
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg-page text-text-primary">
        {children}
      </body>
    </html>
  );
}
