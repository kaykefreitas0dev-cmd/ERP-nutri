"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./utils";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const variantClass: Record<AlertVariant, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  success: "bg-green-50 border-green-200 text-green-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  danger: "bg-red-50 border-red-200 text-red-900",
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = "info", className, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "rounded-md border p-4 text-sm",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  ),
);

Alert.displayName = "Alert";
