import { useState, useCallback } from "react"
import type { Toast, ToastType } from "../components/ui/NexusToast"

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    return id
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((message: string) => addToast(message, "success"), [addToast])
  const error = useCallback((message: string) => addToast(message, "error"), [addToast])
  const info = useCallback((message: string) => addToast(message, "info"), [addToast])

  return { toasts, addToast, dismissToast, success, error, info }
}
