import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/**
 * FOUC-prevention script injected before React hydrates.
 * Replaces next-themes' own <script> injection (which triggers a React 19
 * dev-mode warning about scripts inside component trees).
 * Matches ThemeProvider props: attribute="data-theme", storageKey="theme",
 * defaultTheme="system", enableSystem=true, themes=["light","dark"].
 */
const THEME_INIT_SCRIPT = /* js */ `(function(){try{var root=document.documentElement;var stored=localStorage.getItem("theme")||"system";var theme=stored==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):stored;root.setAttribute("data-theme",theme);if(theme==="light"||theme==="dark"){root.style.colorScheme=theme;}}catch(e){}})();`;

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

export const metadata: Metadata = {
  title: { default: "NutriCore", template: "%s — NutriCore" },
  description:
    "Plataforma de gestão para nutricionistas brasileiros (CRN, LGPD, CFN 599).",
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
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col bg-bg-page text-text-primary"
        suppressHydrationWarning
      >
        {/* beforeInteractive: injected into <head> by Next.js before React hydrates — no component-tree warning */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
