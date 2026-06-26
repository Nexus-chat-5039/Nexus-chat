import { cn } from "../../lib/utils"
import { type ReactNode } from "react"

type NexusBadgeProps = {
  children: ReactNode
  variant?: "primary" | "outline" | "ghost"
  className?: string
  icon?: ReactNode
}

export default function NexusBadge({ children, variant = "ghost", className, icon }: NexusBadgeProps) {
  const variants = {
    primary: "bg-nexus-primary/15 text-nexus-primary border-nexus-primary/20",
    outline: "bg-transparent text-nexus-muted border-nexus-border/60",
    ghost: "bg-nexus-surface/50 text-nexus-muted border-nexus-border/30",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {icon}
      {children}
    </span>
  )
}
