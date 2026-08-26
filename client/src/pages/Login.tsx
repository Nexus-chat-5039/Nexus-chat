import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { authService } from "../services/auth/authService"
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react"
import AmbientBackground from "../components/AmbientBackground"
import NexusButton from "../components/ui/NexusButton"
import NexusInput from "../components/ui/NexusInput"
import GlassCard from "../components/ui/GlassCard"
import gsap from "gsap"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { token } = useAuthStore()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (token) {
      navigate("/chat", { replace: true })
    }
  }, [token, navigate])

  useEffect(() => {
    document.title = "Login — Nexus Chat"

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced || !cardRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".login-logo", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 0)
        .fromTo(".login-title", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4 }, 0.1)
        .fromTo(".login-field", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.1 }, 0.2)
        .fromTo(".login-actions", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 0.5)
        .fromTo(".login-divider", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.6)
        .fromTo(".login-alt", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.7)
    }, cardRef)

    return () => ctx.revert()
  }, [])

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setError("")
    setLoading(true)

    try {
      const { user, token: access_token } = await authService.login(email, password)
      useAuthStore.getState().login(access_token, user.email, user.display_name)
      navigate("/chat", { replace: true })
    } catch (err: unknown) {
      console.error(err)
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error)
          : err instanceof Error
          ? err.message
          : "Login failed"
      setError(message || "Login failed")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text flex items-center justify-center p-4 relative isolate">
      <AmbientBackground />

      <div ref={cardRef} className="w-full max-w-[400px] relative z-10">
        <GlassCard className="p-8">
          {/* Logo */}
          <div className="login-logo flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-nexus-primary flex items-center justify-center shadow-[0_0_20px_rgba(164,22,26,0.3)] mb-4">
              <img src="/nexus.svg" alt="Nexus" className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-nexus-muted mt-1">Sign in to your workspace</p>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="login-field mb-4">
            <NexusInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="you@company.com"
              icon={<Mail className="w-4 h-4" />}
            />
          </div>

          {/* Password */}
          <div className="login-field mb-5">
            <NexusInput
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-nexus-muted hover:text-nexus-text transition-colors p-1 rounded-lg hover:bg-nexus-hover flex items-center justify-center"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>

          {/* Sign in button */}
          <div className="login-actions">
            <NexusButton
              fullWidth
              onClick={handleLogin}
              disabled={loading || !email || !password}
              loading={loading}
              className="gap-2"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </NexusButton>
          </div>

          {/* Sign up link */}
          <div className="login-alt mt-6">
            <p className="text-center text-sm text-nexus-muted">
              Don't have an account?{" "}
              <Link to="/signup" className="text-nexus-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
