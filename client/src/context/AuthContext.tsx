import { createContext, useContext, useState, useMemo, useCallback } from "react"
import { jwtDecode } from "jwt-decode"

type JwtPayload = {
  sub: string
  username?: string
  exp?: number
}

type AuthContextType = {
  token: string | null
  userEmail: string
  username: string
  login: (token: string) => void
  logout: () => void
  getToken: () => string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

function decodeToken(token: string | null): { email: string; username: string } {
  if (!token) return { email: "", username: "" }
  try {
    const payload = jwtDecode<JwtPayload>(token)
    return {
      email: payload.sub || "",
      username: payload.username || payload.sub?.split("@")[0] || "",
    }
  } catch {
    return { email: "", username: "" }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("nexus_token")
  )

  const decoded = useMemo(() => decodeToken(token), [token])

  const login = useCallback((newToken: string) => {
    setToken(newToken)
    localStorage.setItem("nexus_token", newToken)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem("nexus_token")
  }, [])

  const getToken = useCallback(() => {
    return localStorage.getItem("nexus_token")
  }, [])

  const value = useMemo(
    () => ({
      token,
      userEmail: decoded.email,
      username: decoded.username,
      login,
      logout,
      getToken,
    }),
    [token, decoded, login, logout, getToken]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
