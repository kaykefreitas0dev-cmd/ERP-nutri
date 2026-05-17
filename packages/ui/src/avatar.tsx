"use client";

import { forwardRef, useMemo, useState, type ImgHTMLAttributes } from "react";
import { cn } from "./utils";

/**
 * Avatar — NutriCore Design System (Phase 1)
 *
 * Fallback inteligente:
 *   1. Tenta carregar src.
 *   2. Se ausente ou falhar, renderiza iniciais (até 2 letras) sobre
 *      background pastel determinístico (mesmo nome → mesma cor sempre).
 *   3. StatusDot opcional no canto inferior direito.
 *
 * Cores derivadas via hash do nome — paleta curada de 12 pastéis.
 */

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
> {
  /** URL da imagem. Se omitida ou falhar, mostra iniciais. */
  src?: string | null;
  /** Nome usado para iniciais + cor determinística. */
  name: string;
  size?: AvatarSize;
  /** Dot de status no canto. */
  status?: "active" | "warning" | "danger" | "offline";
}

const sizeClass: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-tiny",
  sm: "h-8 w-8 text-tiny",
  md: "h-10 w-10 text-caption",
  lg: "h-12 w-12 text-body",
  xl: "h-16 w-16 text-h3",
};

const dotSize: Record<AvatarSize, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
};

const statusColor = {
  active: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  offline: "bg-text-subtle",
} as const;

// Paleta de pastéis curada (saturação 35-45%, luminosidade 75-85% no light)
const PALETTE = [
  { bg: "hsl(0 50% 82%)", fg: "hsl(0 40% 28%)" },
  { bg: "hsl(20 50% 80%)", fg: "hsl(20 40% 28%)" },
  { bg: "hsl(40 50% 78%)", fg: "hsl(40 40% 28%)" },
  { bg: "hsl(60 45% 78%)", fg: "hsl(60 40% 26%)" },
  { bg: "hsl(120 35% 78%)", fg: "hsl(120 35% 26%)" },
  { bg: "hsl(150 40% 78%)", fg: "hsl(150 40% 26%)" },
  { bg: "hsl(180 40% 78%)", fg: "hsl(180 40% 26%)" },
  { bg: "hsl(200 45% 80%)", fg: "hsl(200 45% 28%)" },
  { bg: "hsl(220 45% 82%)", fg: "hsl(220 40% 30%)" },
  { bg: "hsl(260 40% 82%)", fg: "hsl(260 40% 30%)" },
  { bg: "hsl(290 38% 82%)", fg: "hsl(290 40% 30%)" },
  { bg: "hsl(330 45% 82%)", fg: "hsl(330 40% 30%)" },
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, name, size = "md", status, className, ...imgProps }, ref) => {
    const [errored, setErrored] = useState(false);
    const showImage = Boolean(src) && !errored;

    const { bg, fg } = useMemo(() => {
      const idx = hashName(name || "?") % PALETTE.length;
      return PALETTE[idx]!;
    }, [name]);

    const inits = useMemo(() => initials(name || "?"), [name]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex shrink-0 select-none overflow-visible rounded-full",
          sizeClass[size],
          className,
        )}
      >
        <span
          aria-hidden={showImage}
          className="absolute inset-0 flex items-center justify-center rounded-full font-semibold tabular-nums"
          style={{ backgroundColor: bg, color: fg }}
        >
          {inits}
        </span>
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={name}
            src={src ?? undefined}
            onError={() => setErrored(true)}
            className="relative h-full w-full rounded-full object-cover"
            {...imgProps}
          />
        )}
        {status && (
          <span
            aria-hidden
            className={cn(
              "absolute bottom-0 right-0 rounded-full ring-2 ring-bg-surface",
              dotSize[size],
              statusColor[status],
            )}
          />
        )}
      </div>
    );
  },
);

Avatar.displayName = "Avatar";
