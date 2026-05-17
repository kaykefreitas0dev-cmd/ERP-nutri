"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(
        "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm",
        "placeholder:text-gray-400",
        "focus:outline-none focus:ring-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
          : "border-gray-300 focus:border-teal-500 focus:ring-teal-500",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
