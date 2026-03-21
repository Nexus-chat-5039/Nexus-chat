import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = "Authenticating… — Nexus Chat"
    const token = searchParams.get("token")
    if (token) {
      login(token)
      navigate("/chat")
    } else {
      navigate("/login?error=oauth_failed")
    }
  }, [searchParams, login, navigate])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-nexus-bg text-nexus-text">
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-nexus-primary border-t-transparent" />
        <p className="text-nexus-muted text-sm">Authenticating…</p>
      </div>
    </div>
  )
}
