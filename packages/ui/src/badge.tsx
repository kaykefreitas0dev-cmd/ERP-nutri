"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./utils";

/**
 * Badge — NutriCore Design System (Phase 1)
 *
 * Forma pill com bg sutil (-bg token) + text saturado + ring-1 inset sutil.
 * Variantes semânticas: neutral | primary | success | warning | danger | info.
 *
 * Aceita `leftIcon` slot pra StatusDot, AlertTriangle, etc.
 */
export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  // legacy aliases — gradualmente migrar para neutral/primary/etc.
  | "default"
  | "secondary"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  leftIcon?: ReactNode;
}

const variantClass: Record<BadgeVariant, string> = {
  neutral:
    "bg-bg-subtle text-text-secondary ring-1 ring-inset ring-border-subtle",
  primary:
    "bg-brand-primary-bg text-brand-primary-hover ring-1 ring-inset ring-brand-200",
  success: "bg-success-bg text-success ring-1 ring-inset ring-success-border",
  warning: "bg-warning-bg text-warning ring-1 ring-inset ring-warning-border",
  danger: "bg-danger-bg text-danger ring-1 ring-inset ring-danger-border",
  info: "bg-info-bg text-info ring-1 ring-inset ring-info-border",

  // legacy → mapeia para semântico
  default:
    "bg-brand-primary-bg text-brand-primary-hover ring-1 ring-inset ring-brand-200",
  secondary:
    "bg-bg-subtle text-text-secondary ring-1 ring-inset ring-border-subtle",
  outline:
    "bg-transparent text-text-secondary ring-1 ring-inset ring-border-default",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "neutral", className, leftIcon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny font-medium tabular-nums",
        "[&_svg]:size-3 [&_svg]:shrink-0",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {leftIcon}
      {children}
    </span>
  ),
);

Badge.displayName = "Badge";
