import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { authService } from "../services/auth/authService"
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check } from "lucide-react"
import AmbientBackground from "../components/AmbientBackground"
import NexusButton from "../components/ui/NexusButton"
import NexusInput from "../components/ui/NexusInput"
import GlassCard from "../components/ui/GlassCard"
import gsap from "gsap"

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getPasswordStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  return score
}

const strengthLabels = ["Weak", "Fair", "Good", "Strong"]
const strengthColors = ["bg-red-500", "bg-amber-500", "bg-yellow-400", "bg-emerald-500"]

export default function Signup() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [agreed, setAgreed] = useState(false)

  const { token } = useAuthStore()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  const strength = getPasswordStrength(password)

  useEffect(() => {
    if (token) {
      navigate("/onboarding", { replace: true })
    }
  }, [token, navigate])

  useEffect(() => {
    document.title = "Sign Up — Nexus Chat"

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced || !cardRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".signup-logo", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 0)
        .fromTo(".signup-field", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.08 }, 0.15)
        .fromTo(".signup-actions", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 0.5)
    }, cardRef)

    return () => ctx.revert()
  }, [])

  const handleSignup = async () => {
    setError("")
    
    if (!isValidEmail(email)) {
      setError("Please enter a valid email")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (!agreed) {
      setError("Please agree to the terms")
      return
    }

    setLoading(true)

    try {
      const { user, token: access_token } = await authService.register(email, password, email.split("@")[0])
      useAuthStore.getState().login(access_token, user.email, user.display_name)
      navigate("/onboarding", { replace: true })
    } catch (err: unknown) {
      console.error(err)
      const message =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error)
          : err instanceof Error
          ? err.message
          : "Signup failed"
      setError(message || "Signup failed")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text flex items-center justify-center p-4 relative isolate">
      <AmbientBackground />

      <div ref={cardRef} className="w-full max-w-[400px] relative z-10">
        <GlassCard className="p-8">
          {/* Logo */}
          <div className="signup-logo flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-nexus-primary flex items-center justify-center shadow-[0_0_20px_rgba(164,22,26,0.3)] mb-4">
              <img src="/nexus.svg" alt="Nexus" className="w-9 h-9" />
            </div>
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-sm text-nexus-muted mt-1">Start your team's Nexus workspace</p>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="signup-field mb-4">
            <NexusInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              icon={<Mail className="w-4 h-4" />}
            />
          </div>

          {/* Password */}
          <div className="signup-field mb-3">
            <NexusInput
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-nexus-muted hover:text-nexus-text transition-colors p-1 rounded-lg hover:bg-white/5 flex items-center justify-center"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            {/* Password strength */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1" role="status" aria-label={`Password strength: ${strengthLabels[strength - 1] || "Too short"}`}>
                <div className="flex gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength ? strengthColors[strength - 1] : "bg-nexus-border"
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[10px] font-medium ${
                  strength <= 1 ? "text-red-400" : strength === 2 ? "text-amber-400" : strength === 3 ? "text-yellow-400" : "text-emerald-400"
                }`}>
                  {strengthLabels[strength - 1] || "Too short"}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="signup-field mb-4">
            <NexusInput
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              icon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-nexus-muted hover:text-nexus-text transition-colors p-1 rounded-lg hover:bg-white/5 flex items-center justify-center"
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>

          {/* Terms */}
          <div className="signup-field flex items-start gap-2.5 mb-5">
            <button
              type="button"
              role="checkbox"
              aria-checked={agreed}
              aria-label="I agree to Terms of Service and Privacy Policy"
              onClick={() => setAgreed(!agreed)}
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                agreed
                  ? "bg-nexus-primary border-nexus-primary"
                  : "border-nexus-border hover:border-nexus-muted"
              }`}
            >
              {agreed && <Check className="w-3 h-3 text-white" />}
            </button>
            <p className="text-xs text-nexus-muted leading-relaxed">
              I agree to the{" "}
              <span className="text-nexus-primary hover:underline cursor-pointer">Terms of Service</span>
              {" "}and{" "}
              <span className="text-nexus-primary hover:underline cursor-pointer">Privacy Policy</span>
            </p>
          </div>

          {/* Create button */}
          <div className="signup-actions">
            <NexusButton
              fullWidth
              onClick={handleSignup}
              disabled={loading || !email || !password || !confirmPassword || !agreed}
              loading={loading}
              className="gap-2"
            >
              Create Account <ArrowRight className="w-4 h-4" />
            </NexusButton>
          </div>

          <p className="mt-6 text-center text-sm text-nexus-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-nexus-primary hover:underline font-medium">
              Log in
            </Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
