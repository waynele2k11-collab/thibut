import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "gold" | "seal"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 tracking-wider uppercase"
  
  const variants = {
    default: "border-transparent bg-text-primary text-bg-primary hover:bg-text-primary/80",
    secondary: "border-transparent bg-neutral-800 text-stone-100 hover:bg-neutral-800/80",
    outline: "text-text-primary border-neutral-800",
    gold: "border-accent-gold text-accent-gold",
    seal: "border-accent-seal bg-accent-seal/10 text-accent-seal",
  }

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  )
}

export { Badge }
