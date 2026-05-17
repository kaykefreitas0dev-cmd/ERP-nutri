"use client";

import { forwardRef, type HTMLAttributes, type Ref } from "react";
import { cn } from "./utils";

/**
 * Card — NutriCore Design System (Phase 1)
 *
 * Padrão: bg-surface, border-subtle, rounded-lg (12px), shadow-xs.
 * Variantes:
 *  - `default` — apenas card estático.
 *  - `interactive` — cursor-pointer, hover eleva 2px + shadow-sm.
 *  - `highlight` — destaque (item ativo): ring brand sutil + bg sutil.
 */
export type CardVariant = "default" | "interactive" | "highlight";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border-subtle bg-bg-surface text-text-primary [box-shadow:var(--shadow-xs)]",
        "transition-all duration-base [transition-timing-function:var(--ease-out-expo)]",
        variant === "interactive" &&
          "cursor-pointer hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-sm)] hover:border-border-default",
        variant === "highlight" &&
          "ring-1 ring-brand-primary/20 bg-brand-primary-bg",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref as Ref<HTMLHeadingElement>}
    className={cn(
      "text-h3 font-semibold tracking-tight text-text-primary",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref as Ref<HTMLParagraphElement>}
    className={cn("text-caption text-text-secondary", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
