import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { API_URL } from "../api/config"
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react"
import AmbientBackground from "../components/AmbientBackground"
import NexusButton from "../components/ui/NexusButton"
import NexusInput from "../components/ui/NexusInput"
import GlassCard from "../components/ui/GlassCard"
import gsap from "gsap"

export default function Login() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetSent, setResetSent] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

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
    if (!identifier.trim() || !password) return
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Invalid credentials")
      }

      const data = await res.json()
      login(data.access_token)
      navigate("/chat")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleRequestReset = async () => {
    if (!resetEmail.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/request-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      })
      if (!res.ok) throw new Error("Failed to send reset email")
      setResetSent(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send reset email")
    } finally {
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

          {!resetMode ? (
            <>
              {/* Email */}
              <div className="login-field mb-4">
                <NexusInput
                  label="Email"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="you@company.com"
                  icon={<Mail className="w-4 h-4" />}
                />
              </div>

              {/* Password */}
              <div className="login-field mb-3">
                <div className="relative">
                  <NexusInput
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="••••••••"
                    icon={<Lock className="w-4 h-4" />}
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[30px] text-nexus-muted hover:text-nexus-text transition-colors"
                    type="button"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div className="login-field flex justify-end mb-5">
                <button
                  onClick={() => { setResetMode(true); setError("") }}
                  className="text-xs text-nexus-primary hover:underline transition-all"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign in button */}
              <div className="login-actions">
                <NexusButton
                  fullWidth
                  onClick={handleLogin}
                  disabled={loading || !identifier || !password}
                  loading={loading}
                  className="gap-2"
                >
                  Sign In <ArrowRight className="w-4 h-4" />
                </NexusButton>
              </div>
            </>
          ) : (
            <>
              {/* Reset password flow */}
              {!resetSent ? (
                <>
                  <p className="text-sm text-nexus-muted mb-4">
                    Enter your email and we'll send you a reset link.
                  </p>
                  <div className="login-field mb-4">
                    <NexusInput
                      label="Email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRequestReset()}
                      placeholder="you@company.com"
                      icon={<Mail className="w-4 h-4" />}
                    />
                  </div>
                  <div className="login-actions flex gap-2">
                    <NexusButton
                      variant="secondary"
                      onClick={() => { setResetMode(false); setError("") }}
                      className="flex-1"
                    >
                      Back
                    </NexusButton>
                    <NexusButton
                      onClick={handleRequestReset}
                      disabled={loading || !resetEmail}
                      loading={loading}
                      className="flex-1 gap-2"
                    >
                      Send Link
                    </NexusButton>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-1">Check your email</h3>
                  <p className="text-sm text-nexus-muted mb-4">We sent a reset link to {resetEmail}</p>
                  <NexusButton variant="secondary" onClick={() => { setResetMode(false); setResetSent(false); setResetEmail("") }}>
                    Back to Login
                  </NexusButton>
                </div>
              )}
            </>
          )}

          {/* Divider */}
          {!resetMode && (
            <>
              <div className="login-divider relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-nexus-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-nexus-card px-3 text-nexus-muted">or continue with</span>
                </div>
              </div>

              {/* Google SSO */}
              <div className="login-alt">
                <a
                  href={`${API_URL}/auth/login/google`}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-nexus-border py-2.5 text-sm font-medium transition-all hover:bg-nexus-hover active:scale-[0.98]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </a>

                {/* Sign up link */}
                <p className="mt-6 text-center text-sm text-nexus-muted">
                  Don't have an account?{" "}
                  <Link to="/signup" className="text-nexus-primary hover:underline font-medium">
                    Sign up
                  </Link>
                </p>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
