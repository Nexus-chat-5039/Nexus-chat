import { cn } from "../../lib/utils"
import { type ReactNode, type ButtonHTMLAttributes } from "react"

type NexusButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost"
  size?: "sm" | "md" | "lg"
  children: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

export default function NexusButton({
  variant = "primary",
  size = "md",
  children,
  loading = false,
  fullWidth = false,
  type = "button",
  className,
  disabled,
  ...props
}: NexusButtonProps) {
  const variants = {
    primary: "bg-nexus-primary text-white shadow-[0_0_20px_rgba(164,22,26,0.2)] hover:brightness-110 hover:shadow-[0_0_30px_rgba(164,22,26,0.3)]",
    secondary: "bg-nexus-surface text-nexus-text border border-nexus-border hover:bg-nexus-hover hover:border-nexus-border/80",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
    ghost: "bg-transparent text-nexus-muted hover:text-nexus-text hover:bg-nexus-surface/50",
  }

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-3.5 text-base",
  }

  return (
    <button
      type={type}
      aria-busy={loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-semibold rounded-xl",
        "transition-all duration-200 ease-out",
        "active:scale-[0.97] active:duration-100",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-nexus-bg",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      )}
      <span className={cn("inline-flex items-center justify-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
    </button>
  )
}
