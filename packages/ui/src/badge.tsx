"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./utils";

export type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  default: "bg-teal-100 text-teal-800",
  secondary: "bg-gray-100 text-gray-800",
  outline: "border border-gray-300 text-gray-700",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
