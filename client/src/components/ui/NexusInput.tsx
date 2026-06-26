import { cn } from "../../lib/utils"
import { type InputHTMLAttributes, forwardRef } from "react"

type NexusInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  helper?: string
  icon?: React.ReactNode
}

const NexusInput = forwardRef<HTMLInputElement, NexusInputProps>(
  ({ label, error, helper, icon, className, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-[11px] font-medium uppercase tracking-wider text-nexus-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full rounded-xl bg-nexus-input text-nexus-text text-sm",
              "border border-nexus-border px-4 py-3",
              "placeholder:text-nexus-muted/60",
              "outline-none transition-all duration-200",
              "focus:border-nexus-primary/50 focus:ring-[3px] focus:ring-nexus-primary/10",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              icon && "pl-10",
              error && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {helper && !error && <p className="text-xs text-nexus-muted">{helper}</p>}
      </div>
    )
  }
)

NexusInput.displayName = "NexusInput"
export default NexusInput
