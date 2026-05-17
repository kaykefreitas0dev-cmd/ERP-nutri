/**
 * NutriCore — Design Tokens (TypeScript mirror de theme.css)
 *
 * Use os tokens TS quando precisar dos valores em JS/TS (ex: configurar
 * recharts, gerar SVG de empty state, computar cores em runtime).
 *
 * Para CSS/Tailwind: use as utilities derivadas de @theme inline em theme.css
 * (ex: `bg-brand-primary`, `text-text-primary`, `shadow-md`).
 *
 * Hierarquia:
 *   1. Cores primitivas (escala 50-950) — definidas em theme.css
 *   2. Tokens semânticos (brand-primary, success, etc.) — este arquivo
 *   3. Componentes consomem semânticos, nunca primitivos
 *
 * Dark mode via `[data-theme="dark"]` no <html> (next-themes) — só CSS muda;
 * estes valores TS são os do modo light (referência para cálculos).
 */

export const tokens = {
  // ─── Brand — verde nutricional ─────────────────────────────────────────
  brand: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a", // primary (light)
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
    950: "#052e16",
    primary: "#16a34a",
    primaryHover: "#15803d",
    primaryBg: "#f0fdf4",
    primaryFg: "#ffffff",
  },

  // ─── Semânticos ────────────────────────────────────────────────────────
  semantic: {
    success: "#16a34a",
    successBg: "#dcfce7",
    successBorder: "#86efac",
    warning: "#ea580c", // laranja queimado (orange-600)
    warningBg: "#ffedd5",
    warningBorder: "#fdba74",
    danger: "#dc2626",
    dangerBg: "#fee2e2",
    dangerBorder: "#fca5a5",
    info: "#0284c7",
    infoBg: "#e0f2fe",
    infoBorder: "#7dd3fc",
  },

  // ─── Macros — cores FIXAS em todo o sistema ────────────────────────────
  // Nutri vê âmbar e sabe "carboidrato". Não mudar.
  macros: {
    protein: "#ef4444", // red-500
    proteinBg: "#fee2e2",
    carb: "#f59e0b", // amber-500
    carbBg: "#fef3c7",
    fat: "#a855f7", // purple-500
    fatBg: "#f3e8ff",
    fiber: "#10b981", // emerald-500
    fiberBg: "#d1fae5",
    water: "#06b6d4", // cyan-500
    waterBg: "#cffafe",
  },

  // ─── Backgrounds — warm whites (stone) ─────────────────────────────────
  bg: {
    page: "#fafaf9",
    surface: "#ffffff",
    surfaceHover: "#f5f5f4",
    elevated: "#ffffff",
    subtle: "#f5f5f4",
    muted: "#e7e5e4",
    overlay: "rgba(28, 25, 23, 0.5)",
  },

  // ─── Borders ───────────────────────────────────────────────────────────
  border: {
    subtle: "#e7e5e4",
    default: "#d6d3d1",
    strong: "#a8a29e",
  },

  // ─── Text ──────────────────────────────────────────────────────────────
  text: {
    primary: "#1c1917",
    secondary: "#44403c",
    muted: "#78716c",
    subtle: "#a8a29e",
    inverse: "#fafaf9",
    onBrand: "#ffffff",
    link: "#15803d",
  },

  // ─── Tipografia ────────────────────────────────────────────────────────
  font: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace',
  },

  fontSize: {
    display: "2rem", // 32px
    h1: "1.5rem", // 24px
    h2: "1.125rem", // 18px
    h3: "1rem", // 16px
    body: "0.875rem", // 14px
    caption: "0.8125rem", // 13px
    tiny: "0.75rem", // 12px
  },

  // ─── Radii ─────────────────────────────────────────────────────────────
  radius: {
    xs: "0.25rem", // 4px
    sm: "0.375rem", // 6px
    md: "0.5rem", // 8px
    lg: "0.75rem", // 12px
    xl: "1rem", // 16px
    "2xl": "1.5rem", // 24px
    full: "9999px",
  },

  // ─── Shadows — matiz stone-900 sutil ───────────────────────────────────
  shadow: {
    xs: "0 1px 2px 0 rgb(28 25 23 / 0.04)",
    sm: "0 1px 3px 0 rgb(28 25 23 / 0.06), 0 1px 2px -1px rgb(28 25 23 / 0.04)",
    md: "0 4px 6px -1px rgb(28 25 23 / 0.07), 0 2px 4px -2px rgb(28 25 23 / 0.05)",
    lg: "0 10px 15px -3px rgb(28 25 23 / 0.08), 0 4px 6px -4px rgb(28 25 23 / 0.05)",
    xl: "0 20px 25px -5px rgb(28 25 23 / 0.1), 0 8px 10px -6px rgb(28 25 23 / 0.06)",
    focusRing: "0 0 0 3px rgb(22 163 74 / 0.15)",
    focusRingDanger: "0 0 0 3px rgb(220 38 38 / 0.15)",
  },

  // ─── Motion ────────────────────────────────────────────────────────────
  duration: {
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
    slower: "400ms",
  },

  easing: {
    outExpo: "cubic-bezier(0.16, 1, 0.3, 1)", // padrão de chegada
    outQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)", // overshoot pontual
  },

  // ─── Z-index stack ─────────────────────────────────────────────────────
  z: {
    base: 0,
    sticky: 30,
    fixed: 40,
    dropdown: 50,
    overlay: 60,
    modalBackdrop: 70,
    modal: 80,
    popover: 90,
    tooltip: 100,
    toast: 110,
  },
} as const;

export type Tokens = typeof tokens;
