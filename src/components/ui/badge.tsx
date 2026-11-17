import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "seal"
  | "error";

export interface BadgeProps extends React.ComponentPropsWithRef<"span"> {
  variant?: BadgeVariant;
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-on-primary",
  secondary: "border-surface-variant bg-surface-container-high text-on-surface",
  outline: "border-outline-variant bg-transparent text-on-surface-variant",
  seal: "border-secondary/30 bg-secondary/10 text-secondary",
  error: "border-error/30 bg-error-container text-on-error-container",
};

export function Badge({
  className,
  variant = "default",
  ref,
  ...props
}: BadgeProps) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded border px-2.5 py-1 font-label-caps text-label-caps uppercase transition-colors motion-reduce:transition-none",
        BADGE_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
