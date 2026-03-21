import { useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !contentRef.current) return
    const focusable = contentRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length > 0) focusable[0].focus()
  }, [isOpen])

  // Click outside to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  if (!isOpen) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-nexus-border bg-nexus-card p-6 shadow-2xl shadow-black/40 relative animate-scaleIn mx-4"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-nexus-muted hover:text-nexus-text hover:bg-nexus-bg rounded-lg transition-all"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <h2 className="mb-5 text-xl font-semibold text-nexus-text">{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  )
}
