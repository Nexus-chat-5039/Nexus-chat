import { type ReactNode } from "react"
import { cn } from "../../lib/utils"

type GlassCardProps = {
  children: ReactNode
  className?: string
  hover?: boolean
}

export default function GlassCard({ children, className, hover = true }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-nexus-border/50 bg-nexus-card/60 backdrop-blur-xl shadow-lg",
        hover && "transition-all duration-200 hover:border-nexus-border/80 hover:-translate-y-px",
        className
      )}
    >
      {children}
    </div>
  )
}
