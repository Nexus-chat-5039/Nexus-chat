import { useEffect, useRef } from "react"
import { CheckCircle, AlertCircle, Info, X } from "lucide-react"
import { cn } from "../../lib/utils"
import gsap from "gsap"

export type ToastType = "success" | "error" | "info"

export type Toast = {
  id: string
  message: string
  type: ToastType
}

type NexusToastProps = {
  toast: Toast
  onDismiss: (id: string) => void
}

const icons = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
}

const bgMap = {
  success: "bg-emerald-500/10 border-emerald-500/20",
  error: "bg-red-500/10 border-red-500/20",
  info: "bg-blue-500/10 border-blue-500/20",
}

export default function NexusToast({ toast, onDismiss }: NexusToastProps) {
  const ref = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const onDismissRef = useRef(onDismiss)
  const toastIdRef = useRef(toast.id)

  useEffect(() => {
    onDismissRef.current = onDismiss
    toastIdRef.current = toast.id
  }, [onDismiss, toast.id])

  useEffect(() => {
    const el = ref.current
    const progress = progressRef.current
    if (!el || !progress) return

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Entrance
    gsap.fromTo(
      el,
      { x: 100, opacity: 0 },
      { x: 0, opacity: 1, duration: prefersReduced ? 0.01 : 0.3, ease: "power3.out" }
    )

    // Progress bar
    gsap.fromTo(
      progress,
      { scaleX: 1 },
      { scaleX: 0, duration: 3, ease: "linear", onComplete: () => onDismissRef.current(toastIdRef.current) }
    )

    return () => {
      gsap.killTweensOf(el)
      gsap.killTweensOf(progress)
    }
  }, [])

  const handleDismiss = () => {
    const el = ref.current
    if (!el) return
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    gsap.to(el, {
      x: 100,
      opacity: 0,
      duration: prefersReduced ? 0.01 : 0.2,
      ease: "power2.in",
      onComplete: () => onDismissRef.current(toastIdRef.current),
    })
  }

  return (
    <div
      ref={ref}
      role={toast.type === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "relative w-72 rounded-xl border backdrop-blur-md overflow-hidden",
        "shadow-lg shadow-black/30",
        bgMap[toast.type]
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {icons[toast.type]}
        <p className="text-sm text-nexus-text flex-1">{toast.message}</p>
        <button
          onClick={handleDismiss}
          type="button"
          aria-label="Dismiss notification"
          className="text-nexus-muted hover:text-nexus-text transition-colors p-1 rounded-lg hover:bg-white/5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        ref={progressRef}
        className={cn(
          "h-0.5 origin-left",
          toast.type === "success" && "bg-emerald-500/40",
          toast.type === "error" && "bg-red-500/40",
          toast.type === "info" && "bg-blue-500/40"
        )}
      />
    </div>
  )
}
