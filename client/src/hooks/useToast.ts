import { create } from "zustand"
import type { Toast, ToastType } from "../components/ui/NexusToast"

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => string
  dismissToast: (id: string) => void
  success: (message: string) => string
  error: (message: string) => string
  info: (message: string) => string
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = "info") => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  success: (msg) => useToastStore.getState().addToast(msg, "success"),
  error: (msg) => useToastStore.getState().addToast(msg, "error"),
  info: (msg) => useToastStore.getState().addToast(msg, "info"),
}))

export function useToast() {
  const toasts = useToastStore((state) => state.toasts)
  const addToast = useToastStore((state) => state.addToast)
  const dismissToast = useToastStore((state) => state.dismissToast)
  const success = useToastStore((state) => state.success)
  const error = useToastStore((state) => state.error)
  const info = useToastStore((state) => state.info)

  return { toasts, addToast, dismissToast, success, error, info }
}
