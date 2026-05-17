"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  /** Ícone à esquerda (size-4 recomendado). Adiciona padding-left. */
  leftIcon?: ReactNode;
  /** Slot à direita (kbd, action button). Adiciona padding-right. */
  rightSlot?: ReactNode;
}

/**
 * Input — NutriCore Design System (Phase 1)
 *
 * Altura padrão 36px (h-9). Estados: default | hover | focus | disabled | error.
 * Focus usa ring brand + border transparente (substitui visualmente a borda).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightSlot, type = "text", ...props }, ref) => {
    const hasLeft = leftIcon != null;
    const hasRight = rightSlot != null;

    if (!hasLeft && !hasRight) {
      return (
        <input
          ref={ref}
          type={type}
          aria-invalid={error || undefined}
          className={cn(baseInputClass, errorClass(error), className)}
          {...props}
        />
      );
    }

    return (
      <div className="relative w-full">
        {hasLeft && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted [&_svg]:size-4"
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          aria-invalid={error || undefined}
          className={cn(
            baseInputClass,
            errorClass(error),
            hasLeft && "pl-9",
            hasRight && "pr-12",
            className,
          )}
          {...props}
        />
        {hasRight && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-text-muted">
            {rightSlot}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

const baseInputClass = [
  "flex h-9 w-full rounded-sm border bg-bg-surface px-3 text-body text-text-primary",
  "placeholder:text-text-muted",
  "transition-[border-color,box-shadow] duration-fast",
  "[transition-timing-function:var(--ease-out-expo)]",
  "focus:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-bg-subtle",
].join(" ");

function errorClass(error?: boolean): string {
  if (error) {
    return "border-danger focus:border-danger focus:[box-shadow:var(--shadow-focus-ring-danger)]";
  }
  return "border-border-default hover:border-border-strong focus:border-brand-primary focus:[box-shadow:var(--shadow-focus-ring)]";
}
