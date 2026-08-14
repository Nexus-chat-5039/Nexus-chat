import { cn } from "../../lib/utils"

type NexusAvatarProps = {
  src?: string | null
  name?: string
  size?: "sm" | "md" | "lg" | "xl"
  online?: boolean
  className?: string
}

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-lg",
  xl: "w-24 h-24 text-2xl",
}

const onlineSizeMap = {
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-3.5 h-3.5",
  xl: "w-4 h-4",
}

export default function NexusAvatar({ src, name, size = "md", online, className }: NexusAvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : "?"

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center font-semibold",
          "bg-gradient-to-br from-nexus-primary/30 to-purple-600/20",
          "border-2 border-nexus-border/50",
          sizeMap[size]
        )}
      >
        {src ? (
          <img src={src} alt={name ? `${name}'s avatar` : "User avatar"} className="w-full h-full object-cover" />
        ) : (
          <span className="text-nexus-text/80 select-none">{initial}</span>
        )}
      </div>
      {online !== undefined && (
        <span
          role="status"
          aria-label={online ? "Online" : "Offline"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-nexus-bg",
            onlineSizeMap[size],
            online ? "bg-emerald-500" : "bg-nexus-muted"
          )}
        >
          {online && (
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
          )}
        </span>
      )}
    </div>
  )
}
