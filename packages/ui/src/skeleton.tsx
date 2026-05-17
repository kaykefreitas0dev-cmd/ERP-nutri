"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "./utils";

/**
 * Skeleton — shimmer animation pra loading states.
 *
 * Forma do skeleton deve imitar a forma final do conteúdo. Não use spinners
 * genéricos exceto em botões e ações pontuais.
 *
 * Implementação via classe `.shimmer` definida em theme.css.
 */
export const Skeleton = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden
    className={cn("shimmer rounded-md", className)}
    {...props}
  />
));

Skeleton.displayName = "Skeleton";
