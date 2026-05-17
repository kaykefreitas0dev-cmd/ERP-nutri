/**
 * Design tokens centralizados do NutriCore.
 *
 * Mudar valores aqui afeta TODOS os apps (web, patient, admin, marketing)
 * após rebuild. Não use cores hardcoded em componentes — sempre referencie
 * estes tokens via classes Tailwind extendidas (ex: bg-brand-primary) ou
 * via CSS variables (ex: var(--color-brand-primary)).
 *
 * Hierarquia:
 *   1. Cores primitivas (slate-50, teal-700, etc) — Tailwind defaults
 *   2. Tokens semânticos (brand, surface, danger) — ESTE arquivo
 *   3. Componentes que consomem os tokens
 *
 * Para dark mode futuro, basta adicionar bloco `[data-theme="dark"]` em
 * theme.css com overrides — JS/components não precisam mudar.
 */

export const tokens = {
  // ─── Brand ──────────────────────────────────────────────────────────────
  // Identidade visual primária. Trocar aqui = trocar em todo o sistema.
  brand: {
    primary: "#0f766e", // teal-700 — botões CTA, links, ícones primários
    primaryHover: "#115e59", // teal-800
    primaryLight: "#ccfbf1", // teal-100 — backgrounds suaves
    primaryDark: "#134e4a", // teal-900

    secondary: "#0f172a", // slate-900 — admin app, headers escuros
    secondaryHover: "#1e293b", // slate-800

    accent: "#f59e0b", // amber-500 — destaques, badges
  },

  // ─── Status semântico ───────────────────────────────────────────────────
  status: {
    success: "#16a34a", // green-600
    successBg: "#dcfce7", // green-100
    danger: "#dc2626", // red-600
    dangerBg: "#fee2e2", // red-100
    warning: "#d97706", // amber-600
    warningBg: "#fef3c7", // amber-100
    info: "#2563eb", // blue-600
    infoBg: "#dbeafe", // blue-100
  },

  // ─── Surfaces (fundos, bordas, divisores) ──────────────────────────────
  surface: {
    page: "#f8fafc", // slate-50 — fundo geral
    card: "#ffffff", // white — cards, modais
    cardHover: "#f1f5f9", // slate-100
    border: "#e2e8f0", // slate-200 — bordas padrão
    borderStrong: "#cbd5e1", // slate-300
    overlay: "rgba(15, 23, 42, 0.5)", // overlay de modais
  },

  // ─── Texto ──────────────────────────────────────────────────────────────
  text: {
    primary: "#0f172a", // slate-900 — texto principal
    secondary: "#475569", // slate-600 — texto secundário
    muted: "#94a3b8", // slate-400 — placeholders, captions
    inverse: "#ffffff", // texto sobre fundo escuro
  },

  // ─── Tipografia ─────────────────────────────────────────────────────────
  font: {
    sans: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"Geist Mono", "SF Mono", Monaco, Consolas, monospace',
  },

  // ─── Spacing scale (rem) ────────────────────────────────────────────────
  // Mesma scale do Tailwind por consistência. Tokens semânticos abaixo.
  space: {
    componentPad: "0.75rem", // 12px — padding interno de cards
    sectionGap: "1.5rem", // 24px — entre seções
    pageMargin: "1.5rem", // 24px — margem da página
  },

  // ─── Border radius ──────────────────────────────────────────────────────
  radius: {
    sm: "0.25rem", // 4px — inputs pequenos
    md: "0.375rem", // 6px — botões padrão
    lg: "0.5rem", // 8px — cards
    xl: "0.75rem", // 12px — modais
    full: "9999px", // pills, avatars
  },

  // ─── Sombras ────────────────────────────────────────────────────────────
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    overlay: "0 25px 50px -12px rgb(0 0 0 / 0.25)", // modais
  },
} as const;

export type Tokens = typeof tokens;
