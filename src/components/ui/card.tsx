import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-surface-variant bg-surface-container-lowest text-on-surface",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"h3">) {
  return (
    <h3
      ref={ref}
      className={cn("font-headline-sm text-headline-sm text-primary", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"p">) {
  return (
    <p
      ref={ref}
      className={cn("font-body-md text-body-md text-on-surface-variant", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  );
}
