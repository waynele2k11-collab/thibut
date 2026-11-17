import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary",
  outline:
    "border border-outline bg-transparent text-primary font-label-caps text-label-caps uppercase hover:bg-surface-container-high",
  ghost:
    "bg-transparent text-on-surface-variant font-body-md text-body-md hover:bg-surface-container-high hover:text-primary",
  destructive:
    "bg-error text-on-primary font-label-caps text-label-caps uppercase hover:opacity-90",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  default: "h-11 px-6 py-2.5",
  sm: "h-9 px-4 py-2",
  lg: "h-12 px-8 py-3.5",
  icon: "h-10 w-10 p-0",
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  type = "button",
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className
      )}
      {...props}
    />
  );
}
