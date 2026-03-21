import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import logo from "../assets/logo.svg"
import { ArrowRight, MessageSquare, Shield, Zap, Sparkles } from "lucide-react"

export default function Landing() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = "Nexus Chat — Seamless Communication for Modern Teams"
  }, [])

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-nexus-border/50 bg-nexus-bg/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Nexus" className="h-8 w-8 rounded-lg bg-nexus-primary p-1 shadow-sm shadow-nexus-primary/20" />
          <span className="font-bold text-lg tracking-tight">Nexus Chat</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium hover:text-nexus-primary transition px-3 py-2 rounded-xl hover:bg-nexus-card"
          >
            Login
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="px-5 py-2 bg-nexus-primary text-white text-sm font-semibold rounded-xl hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-nexus-primary/20"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 md:py-24 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-nexus-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl space-y-6 relative z-10 animate-fadeIn">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-nexus-primary/10 border border-nexus-primary/20 text-nexus-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            AI-Powered Communication
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Seamless Communication for{" "}
            <span className="text-nexus-primary relative">
              Modern Teams
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-nexus-primary/30 rounded-full" />
            </span>
          </h1>
          <p className="text-lg md:text-xl text-nexus-muted max-w-2xl mx-auto leading-relaxed">
            Experience real-time collaboration with AI-powered insights. Secure, fast, and designed for productivity.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate("/signup")}
              className="px-8 py-4 bg-nexus-primary text-white text-lg font-bold rounded-2xl hover:brightness-110 transition-all active:scale-95 flex items-center gap-2 shadow-xl shadow-nexus-primary/25 animate-pulse-glow"
            >
              Start Chatting Free <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-8 py-4 bg-nexus-card border border-nexus-border text-nexus-text text-lg font-bold rounded-2xl hover:bg-nexus-hover transition-all active:scale-95"
            >
              Existing User
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 mt-20 max-w-5xl w-full px-4">
          {[
            {
              icon: MessageSquare,
              color: "blue",
              title: "Real-time Chat",
              desc: "Instant messaging with rich media support and seamless group collaboration.",
            },
            {
              icon: Zap,
              color: "emerald",
              title: "AI Powered",
              desc: "Integrated AI assistant to help you summarize, generate, and analyze on the fly.",
            },
            {
              icon: Shield,
              color: "purple",
              title: "Secure & Private",
              desc: "Enterprise-grade security with encryption for all your conversations.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 bg-nexus-card/50 backdrop-blur-sm rounded-2xl border border-nexus-border/50 hover:border-nexus-border hover:bg-nexus-card transition-all duration-300 group"
            >
              <div className={`w-12 h-12 bg-${feature.color}-500/10 rounded-xl flex items-center justify-center mb-4 text-${feature.color}-400 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-nexus-muted text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-nexus-muted border-t border-nexus-border/50">
        <p>© 2026 Nexus Chat. All rights reserved.</p>
      </footer>
    </div>
  )
}
