"use client";

import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "./utils";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-none text-gray-900", className)}
      {...props}
    />
  ),
);

Label.displayName = "Label";
