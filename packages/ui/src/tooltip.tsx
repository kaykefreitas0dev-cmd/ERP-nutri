"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from "react";
import { cn } from "./utils";

/**
 * Tooltip — wrapper Radix com defaults NutriCore.
 *
 * Delay 300ms (não imediato — evita ruído). Posicionamento com collision
 * detection automático. Animação entrada combinada (fade + zoom + slide).
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-tooltip overflow-hidden rounded-sm px-2.5 py-1.5",
        "bg-text-primary text-text-inverse text-tiny font-medium",
        "[box-shadow:var(--shadow-md)]",
        "animate-in fade-in-0 zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-1",
        "data-[side=left]:slide-in-from-right-1",
        "data-[side=right]:slide-in-from-left-1",
        "data-[side=top]:slide-in-from-bottom-1",
        className,
      )}
      style={{ zIndex: 100 }}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * Atalho — tooltip simples wrappando children.
 * Usar quando só precisar de texto curto no hover.
 */
export function SimpleTooltip({
  content,
  children,
  side = "top",
  delayDuration = 300,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
