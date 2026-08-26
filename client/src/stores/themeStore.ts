import { create } from "zustand"

export type Theme = "dark" | "light" | "system"

interface ThemeState {
  theme: Theme
  resolvedTheme: "dark" | "light"
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  const root = document.documentElement
  const resolved = theme === "system" ? getSystemTheme() : theme

  root.classList.remove("dark", "light")
  root.classList.add(resolved)
  root.style.colorScheme = resolved

  const metaColorScheme = document.querySelector('meta[name="color-scheme"]')
  if (metaColorScheme) {
    metaColorScheme.setAttribute("content", resolved)
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", resolved === "dark" ? "#161a1d" : "#f6f8fa")
  }

  return resolved
}

const savedTheme = (typeof window !== "undefined" ? (localStorage.getItem("nexus_theme") as Theme) : null) || "dark"

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: savedTheme,
  resolvedTheme: typeof window !== "undefined" ? applyTheme(savedTheme) : "dark",

  setTheme: (theme: Theme) => {
    try {
      localStorage.setItem("nexus_theme", theme)
    } catch {
      // ignore storage errors in restricted mode
    }
    const resolvedTheme = applyTheme(theme)
    set({ theme, resolvedTheme })
  },

  toggleTheme: () => {
    const current = get().resolvedTheme
    const next: Theme = current === "dark" ? "light" : "dark"
    get().setTheme(next)
  },
}))

// Global listener for system theme changes
if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
  mediaQuery.addEventListener("change", () => {
    const currentTheme = useThemeStore.getState().theme
    if (currentTheme === "system") {
      const resolved = applyTheme("system")
      useThemeStore.setState({ resolvedTheme: resolved })
    }
  })

  // Apply immediately on load
  applyTheme(savedTheme)
}
