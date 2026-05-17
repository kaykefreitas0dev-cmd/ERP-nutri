"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

/**
 * Button — NutriCore Design System (Phase 1)
 *
 * Variantes: primary | secondary | ghost | danger | link
 * Tamanhos:  sm (32) | md (36, default) | lg (40) | xl (48) | icon (36²)
 *
 * Detalhes invisíveis:
 *  - `active:scale-[0.98]` em variantes sólidas (feedback tátil de clique).
 *  - Transição com easing customizado (out-expo, igual Linear).
 *  - Loading: substitui conteúdo por spinner mantendo largura (min-w via slot).
 *  - Focus ring sempre 2px brand + offset 2px.
 *  - Ícones esquerdo/direito via children — gap-2 nativo do flex.
 */

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-medium",
    "rounded-md select-none",
    "transition-all duration-base",
    "[transition-timing-function:var(--ease-out-expo)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-brand-primary text-white shadow-sm",
          "hover:bg-brand-primary-hover hover:shadow-md",
          "active:scale-[0.98]",
        ],
        secondary: [
          "bg-bg-surface text-text-primary border border-border-default",
          "hover:bg-bg-surface-hover hover:border-border-strong",
          "active:scale-[0.98]",
        ],
        ghost: [
          "bg-transparent text-text-primary",
          "hover:bg-bg-subtle",
          "active:scale-[0.98]",
        ],
        danger: [
          "bg-danger text-white shadow-sm",
          "hover:opacity-90 hover:shadow-md",
          "focus-visible:ring-danger",
          "active:scale-[0.98]",
        ],
        link: [
          "h-auto px-0 text-text-link underline-offset-4",
          "hover:underline",
        ],
        // Backwards-compat aliases (gradualmente migrar uso → primary/secondary)
        outline: [
          "bg-bg-surface text-text-primary border border-border-default",
          "hover:bg-bg-surface-hover hover:border-border-strong",
          "active:scale-[0.98]",
        ],
        destructive: [
          "bg-danger text-white shadow-sm",
          "hover:opacity-90 hover:shadow-md",
          "focus-visible:ring-danger",
          "active:scale-[0.98]",
        ],
      },
      size: {
        sm: "h-8 px-3 text-tiny [&_svg]:size-3.5",
        md: "h-9 px-4 text-body [&_svg]:size-4",
        lg: "h-10 px-5 text-body [&_svg]:size-4",
        xl: "h-12 px-6 text-h3 [&_svg]:size-5",
        icon: "h-9 w-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>["variant"]
>;
export type ButtonSize = NonNullable<
  VariantProps<typeof buttonVariants>["size"]
>;

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant, size, loading = false, disabled, className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  ),
);

Button.displayName = "Button";

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
