import { useState, useEffect, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { API_URL } from "../api/config"
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check, X } from "lucide-react"
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"details" | "otp">("details")
  const [otp, setOtp] = useState("")
  const [agreed, setAgreed] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  const strength = getPasswordStrength(password)

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
  }, [step])

  const handleSignup = async () => {
    setError("")
    setLoading(true)

    try {
      if (step === "details") {
        if (!isValidEmail(email)) throw new Error("Please enter a valid email")
        if (password.length < 6) throw new Error("Password must be at least 6 characters")
        if (password !== confirmPassword) throw new Error("Passwords do not match")
        if (!agreed) throw new Error("Please agree to the terms")

        const res = await fetch(`${API_URL}/auth/request-register-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.detail || "Failed to send verification code")
        }
        setStep("otp")
        setLoading(false)
      } else {
        if (otp.length !== 6) throw new Error("Please enter a 6-digit code")

        const res = await fetch(`${API_URL}/auth/verify-register-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.detail || "Invalid code")
        }

        const signupRes = await fetch(`${API_URL}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })
        if (!signupRes.ok) {
          const d = await signupRes.json()
          throw new Error(d.detail || "Signup failed")
        }

        const data = await signupRes.json()
        login(data.access_token)
        navigate("/onboarding")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed")
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

          {step === "details" ? (
            <>
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
                <div className="relative">
                  <NexusInput
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                {/* Password strength */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
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
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                />
              </div>

              {/* Terms */}
              <div className="signup-field flex items-start gap-2.5 mb-5">
                <button
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
            </>
          ) : (
            <>
              {/* OTP */}
              <div className="signup-field mb-4">
                <p className="text-sm text-nexus-muted mb-3 text-center">
                  We sent a verification code to <strong className="text-nexus-text">{email}</strong>
                </p>
                <NexusInput
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                  placeholder="000000"
                  className="text-center text-lg tracking-[0.5em] font-mono"
                  maxLength={6}
                />
                <button
                  onClick={() => setStep("details")}
                  className="mt-2 text-xs text-nexus-primary hover:underline w-full text-center"
                >
                  Wrong email? Go back
                </button>
              </div>

              <div className="signup-actions">
                <NexusButton
                  fullWidth
                  onClick={handleSignup}
                  disabled={loading || otp.length !== 6}
                  loading={loading}
                >
                  Verify & Create Account
                </NexusButton>
              </div>
            </>
          )}

          {/* Divider */}
          {step === "details" && (
            <>
              <div className="signup-divider relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-nexus-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-nexus-card px-3 text-nexus-muted">or continue with</span>
                </div>
              </div>

              {/* Google */}
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

              <p className="mt-6 text-center text-sm text-nexus-muted">
                Already have an account?{" "}
                <Link to="/login" className="text-nexus-primary hover:underline font-medium">
                  Log in
                </Link>
              </p>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
