import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.ComponentPropsWithRef<"input">;

/**
 * Editorial form `<input>` primitive styled with Stitch light-mode tokens.
 *
 * Accessibility requirement: Always pair `<Input id="..." />` with an explicit
 * `<label htmlFor="...">` element. Never rely on `placeholder` alone as a label.
 */
export function Input({ className, type = "text", ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant transition-colors motion-reduce:transition-none file:border-0 file:bg-transparent file:font-body-md file:text-body-md file:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary aria-invalid:border-error disabled:cursor-not-allowed disabled:bg-surface-dim disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}
