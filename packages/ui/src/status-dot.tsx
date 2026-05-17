"use client";

import { type HTMLAttributes } from "react";
import { cn } from "./utils";

/**
 * StatusDot — substitui bolinhas emoji de status.
 *
 * Tamanho 8×8px (size-2) por default. Quando `pulse=true`, anima com ping
 * externo + dot sólido interno (estilo Linear/Vercel).
 */
export type DotStatus =
  | "active"
  | "warning"
  | "danger"
  | "info"
  | "inactive"
  | "pending";

const statusBg: Record<DotStatus, string> = {
  active: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  inactive: "bg-text-subtle",
  pending: "bg-text-muted",
};

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  status: DotStatus;
  pulse?: boolean;
  /** Tamanho — default 2 (8px). Aceita qualquer número que vire `size-N` no Tailwind. */
  size?: 1.5 | 2 | 2.5 | 3 | 3.5;
}

const sizeClass = {
  1.5: "h-1.5 w-1.5",
  2: "h-2 w-2",
  2.5: "h-2.5 w-2.5",
  3: "h-3 w-3",
  3.5: "h-3.5 w-3.5",
} as const;

export function StatusDot({
  status,
  pulse = false,
  size = 2,
  className,
  ...props
}: StatusDotProps) {
  const sz = sizeClass[size];
  const bg = statusBg[status];

  if (!pulse) {
    return (
      <span
        aria-hidden
        className={cn("inline-block rounded-full", sz, bg, className)}
        {...props}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn("relative inline-flex", sz, className)}
      {...props}
    >
      <span
        className={cn(
          "absolute inset-0 inline-flex animate-ping rounded-full opacity-75",
          bg,
        )}
      />
      <span className={cn("relative inline-flex rounded-full", sz, bg)} />
    </span>
  );
}
