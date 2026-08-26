import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { updateProfile } from "../api/auth"
import { ArrowRight, Camera, Check, User, Briefcase } from "lucide-react"
import AmbientBackground from "../components/AmbientBackground"
import NexusButton from "../components/ui/NexusButton"
import NexusInput from "../components/ui/NexusInput"
import gsap from "gsap"

const CONFETTI_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  color: ["#A4161A", "#EDEDED", "#C41E22", "#9CA3AF"][i % 4],
  duration: `${1.5 + ((i * 0.17) % 1.2)}s`,
  delay: `${(i * 0.09) % 0.5}s`,
  rotation: `rotate(${(i * 67) % 360}deg)`,
}))

const steps = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Briefcase },
  { id: "done", label: "Done", icon: Check },
]

const teamSizes = [
  { label: "Just me", value: "1" },
  { label: "2-10", value: "2-10" },
  { label: "11-50", value: "11-50" },
  { label: "50+", value: "50+" },
]

const useCases = ["Engineering", "Design", "Product", "Marketing", "Support", "Other"]

export default function Onboarding() {
  const { token } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [bio, setBio] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [teamSize, setTeamSize] = useState("")
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const contentRef = useRef<HTMLDivElement>(null)
  const confettiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = "Welcome — Nexus Chat"
  }, [])

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced || !contentRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
      )
    })

    return () => ctx.revert()
  }, [step])

  useEffect(() => {
    if (step === 2) {
      const timer = setTimeout(() => navigate("/chat"), 2500)
      return () => clearTimeout(timer)
    }
  }, [step, navigate])

  const handleContinue = async () => {
    if (step === 0) {
      if (!username.trim() || !fullName.trim()) {
        setError("Please fill in all required fields")
        return
      }
      setError("")
      setStep(1)
    } else if (step === 1) {
      setLoading(true)
      setError("")
      try {
        if (!token) throw new Error("Not authenticated")
        await updateProfile(username, undefined, fullName, bio)
        // Store workspace preference (could be sent to API)
        setStep(2)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to save profile")
      } finally {
        setLoading(false)
      }
    }
  }

  const toggleUseCase = (uc: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(uc) ? prev.filter((c) => c !== uc) : [...prev, uc]
    )
  }

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text flex flex-col items-center justify-center p-4 relative isolate">
      <AmbientBackground />

      {/* Progress Bar */}
      <div className="w-full max-w-md mb-8 relative z-10">
        <div className="flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-nexus-border/50">
            <div
              className="h-full bg-nexus-primary transition-all duration-500 ease-out"
              style={{ width: `${(step / (steps.length - 1)) * 100}%` }}
            />
          </div>
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isDone = i < step
            return (
              <div key={s.id} className="flex flex-col items-center gap-2 relative z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isActive
                      ? "bg-nexus-primary border-nexus-primary shadow-[0_0_15px_rgba(164,22,26,0.3)] scale-110"
                      : isDone
                      ? "bg-nexus-primary border-nexus-primary"
                      : "bg-nexus-card border-nexus-border"
                  }`}
                >
                  {isDone ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-nexus-muted"}`} />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider transition-colors ${
                    isActive ? "text-nexus-primary" : isDone ? "text-nexus-text" : "text-nexus-muted"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="w-full max-w-[440px] relative z-10">
        <div className="rounded-2xl border border-nexus-border/50 bg-nexus-card/60 backdrop-blur-xl p-8 shadow-lg">
          {step === 0 && (
            <>
              <h2 className="text-xl font-bold mb-1">Set up your profile</h2>
              <p className="text-sm text-nexus-muted mb-6">Tell us a bit about yourself.</p>

              {/* Avatar upload placeholder */}
              <div className="flex justify-center mb-6">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-nexus-primary/30 to-purple-600/20 flex items-center justify-center border-2 border-nexus-border/50 group-hover:border-nexus-primary/40 transition-all">
                    <User className="w-10 h-10 text-nexus-muted" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 text-sm text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <NexusInput
                  label="Username *"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                />
                <NexusInput
                  label="Full Name *"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                />
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-nexus-muted mb-1.5">
                    Bio <span className="text-nexus-muted/50">(optional)</span>
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={160}
                    placeholder="Tell us about yourself..."
                    className="w-full rounded-xl bg-nexus-input border border-nexus-border px-4 py-2.5 text-nexus-text text-sm placeholder:text-nexus-muted/60 outline-none focus:border-nexus-primary/50 focus:ring-[3px] focus:ring-nexus-primary/10 transition-all resize-none h-20"
                  />
                  <p className="text-[10px] text-nexus-muted mt-1 text-right">{bio.length}/160</p>
                </div>
              </div>

              <div className="mt-6">
                <NexusButton fullWidth onClick={handleContinue} className="gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </NexusButton>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-xl font-bold mb-1">Your workspace</h2>
              <p className="text-sm text-nexus-muted mb-6">Customize your team's space.</p>

              {error && (
                <div className="mb-4 text-sm text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <NexusInput
                  label="Workspace Name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Acme Inc."
                />

                {/* Team Size */}
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-nexus-muted mb-2">
                    Team Size
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {teamSizes.map((ts) => (
                      <button
                        key={ts.value}
                        onClick={() => setTeamSize(ts.value)}
                        className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                          teamSize === ts.value
                            ? "bg-nexus-primary/10 border-nexus-primary/40 text-nexus-primary shadow-[0_0_10px_rgba(164,22,26,0.1)]"
                            : "bg-nexus-input border-nexus-border text-nexus-muted hover:border-nexus-border/80"
                        }`}
                      >
                        {ts.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Use Cases */}
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-nexus-muted mb-2">
                    What do you use Nexus for?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {useCases.map((uc) => (
                      <button
                        key={uc}
                        onClick={() => toggleUseCase(uc)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          selectedUseCases.includes(uc)
                            ? "bg-nexus-primary text-white border-nexus-primary shadow-[0_0_8px_rgba(164,22,26,0.2)]"
                            : "bg-nexus-input border-nexus-border text-nexus-muted hover:border-nexus-muted/50"
                        }`}
                      >
                        {uc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <NexusButton
                  fullWidth
                  onClick={handleContinue}
                  loading={loading}
                  className="gap-2"
                >
                  {loading ? "Saving..." : "Complete Setup"} <ArrowRight className="w-4 h-4" />
                </NexusButton>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="text-center py-8">
              {/* Confetti */}
              <div ref={confettiRef} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                {CONFETTI_PARTICLES.map((particle, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-sm"
                    style={{
                      left: particle.left,
                      top: "-10px",
                      backgroundColor: particle.color,
                      animation: `confettiDrop ${particle.duration} ease-out forwards`,
                      animationDelay: particle.delay,
                      transform: particle.rotation,
                    }}
                  />
                ))}
              </div>

              {/* Success checkmark */}
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                    strokeDasharray="24"
                    strokeDashoffset="24"
                    style={{ animation: "drawCheck 0.5s ease-out 0.3s forwards" }}
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
              <p className="text-sm text-nexus-muted">Redirecting you to your workspace...</p>

              <div className="mt-6 flex justify-center">
                <div className="w-6 h-6 border-2 border-nexus-primary border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
