import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutricore.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/precos", "/faq", "/para/", "/contato", "/portabilidade"],
        disallow: ["/studio", "/api/", "/c/"], // booking pages privadas
      },
      // Bloqueia AI scrapers (opcional, mas comum)
      {
        userAgent: ["GPTBot", "ClaudeBot", "CCBot", "anthropic-ai"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
