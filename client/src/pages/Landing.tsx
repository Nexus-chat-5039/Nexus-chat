import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import logo from "../assets/logo.svg"
import { ArrowRight, Zap, Shield, Sparkles, MessageSquare, ChevronDown } from "lucide-react"
import AmbientBackground from "../components/AmbientBackground"
import NexusButton from "../components/ui/NexusButton"
import NexusBadge from "../components/ui/NexusBadge"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export default function Landing() {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.title = "Nexus Chat — Seamless Communication for Modern Teams"

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    const ctx = gsap.context(() => {
      // Hero entrance animations
      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } })
      heroTl
        .fromTo(".hero-badge", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, 0.2)
        .fromTo(".hero-headline", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 }, 0.3)
        .fromTo(".hero-sub", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, 0.5)
        .fromTo(".hero-cta", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 0.65)
        .fromTo(".hero-mockup", { opacity: 0, y: 60, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 }, 0.8)
        .fromTo(".scroll-cue", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.2)

      // Feature cards scroll animation
      const cards = featuresRef.current?.querySelectorAll(".feature-card")
      if (cards) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: featuresRef.current,
              start: "top 80%",
              once: true,
            },
          }
        )
      }

      // Header scroll effect
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: "top top",
        end: "+=100",
        onUpdate: (self) => {
          if (headerRef.current) {
            const progress = Math.min(self.progress * 2, 1)
            headerRef.current.style.backgroundColor = `rgba(22, 26, 29, ${0.7 + progress * 0.2})`
            headerRef.current.style.borderBottomColor = `rgba(47, 52, 61, ${progress * 0.5})`
          }
        },
      })
    })

    return () => ctx.revert()
  }, [])

  const features = [
    {
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      title: "Lightning Fast",
      desc: "Sub-second messaging with optimized delivery pipelines. Experience real-time collaboration without lag.",
    },
    {
      icon: Shield,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      title: "Enterprise Secure",
      desc: "End-to-end encryption with strict data isolation per room. Your conversations stay private.",
    },
    {
      icon: Sparkles,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      title: "AI Native",
      desc: "Built-in AI assistant that understands your team's context. Ask, summarize, and generate on the fly.",
    },
  ]

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text relative isolate overflow-x-hidden">
      <AmbientBackground />

      {/* Header */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 px-6 md:px-8 h-16 flex items-center justify-between border-b border-transparent transition-colors duration-300"
        style={{ backgroundColor: "rgba(22, 26, 29, 0.7)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center gap-3">
          <img src={logo} alt="Nexus" className="h-8 w-8 rounded-lg bg-nexus-primary p-1 shadow-sm" />
          <span className="font-bold text-lg tracking-tight">Nexus</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium text-nexus-muted hover:text-nexus-text px-4 py-2 rounded-xl hover:bg-nexus-surface/60 transition-all duration-200"
          >
            Login
          </button>
          <NexusButton size="sm" onClick={() => navigate("/signup")}>
            Get Started
          </NexusButton>
        </div>
      </header>

      {/* Hero */}
      <main ref={heroRef} className="relative z-10 flex flex-col items-center pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="hero-badge">
            <NexusBadge variant="primary" icon={<Sparkles className="w-3.5 h-3.5" />}>
              AI-Powered Communication
            </NexusBadge>
          </div>

          {/* Headline */}
          <div className="hero-headline space-y-2">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Seamless Communication
            </h1>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-nexus-primary">
              for Modern Teams
            </h1>
          </div>

          {/* Subtitle */}
          <p className="hero-sub text-lg md:text-xl text-nexus-muted max-w-xl mx-auto leading-relaxed">
            Experience real-time collaboration with AI-powered insights.
            Secure, fast, and designed for productivity.
          </p>

          {/* CTAs */}
          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <NexusButton size="lg" onClick={() => navigate("/signup")} className="gap-2">
              Start Chatting Free <ArrowRight className="w-5 h-5" />
            </NexusButton>
            <NexusButton
              variant="secondary"
              size="lg"
              onClick={() => navigate("/login")}
            >
              Existing User
            </NexusButton>
          </div>
        </div>

        {/* Hero Mockup */}
        <div className="hero-mockup mt-16 w-full max-w-4xl mx-auto perspective-1000">
          <div
            className="relative rounded-2xl border border-nexus-border/40 bg-nexus-card/40 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
            style={{
              animation: "mockupFloat 4s ease-in-out infinite",
              transform: "rotateX(5deg)",
            }}
          >
            {/* Mockup header */}
            <div className="h-10 bg-nexus-card/60 border-b border-nexus-border/30 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] text-nexus-muted">nexus.chat/workspace</span>
              </div>
            </div>
            {/* Mockup body */}
            <div className="p-6 md:p-8 space-y-4">
              {/* Chat bubbles mockup */}
              <div className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-primary/40 to-purple-500/30 shrink-0" />
                <div className="bg-nexus-surface rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[60%]">
                  <div className="h-2.5 w-32 bg-nexus-muted/20 rounded" />
                </div>
              </div>
              <div className="flex gap-3 items-end justify-end">
                <div className="bg-nexus-primary rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[60%]">
                  <div className="h-2.5 w-40 bg-white/30 rounded" />
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/20 shrink-0" />
              </div>
              <div className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 shrink-0" />
                <div className="bg-nexus-surface rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[70%] space-y-1.5">
                  <div className="h-2.5 w-full bg-nexus-muted/20 rounded" />
                  <div className="h-2.5 w-3/4 bg-nexus-muted/20 rounded" />
                </div>
              </div>
              {/* AI bubble */}
              <div className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-full bg-nexus-primary/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-nexus-primary" />
                </div>
                <div className="bg-gradient-to-r from-nexus-primary/10 to-transparent rounded-2xl rounded-bl-sm px-4 py-3 max-w-[75%] border border-nexus-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-16 bg-nexus-primary/30 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full bg-nexus-muted/15 rounded" />
                    <div className="h-2 w-5/6 bg-nexus-muted/15 rounded" />
                    <div className="h-2 w-4/6 bg-nexus-muted/15 rounded" />
                  </div>
                </div>
              </div>
            </div>
            {/* Mockup input */}
            <div className="h-14 bg-nexus-card/40 border-t border-nexus-border/30 flex items-center px-4 gap-3">
              <div className="flex-1 h-9 rounded-xl bg-nexus-input/60 border border-nexus-border/30" />
              <div className="w-9 h-9 rounded-xl bg-nexus-primary/80" />
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="scroll-cue mt-12 flex flex-col items-center gap-2 text-nexus-muted">
          <span className="text-xs">Scroll to explore</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>

        {/* Features */}
        <div ref={featuresRef} className="mt-24 w-full max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Built for modern teams</h2>
            <p className="text-nexus-muted max-w-md mx-auto">
              Everything you need for seamless team communication.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 px-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="feature-card rounded-2xl border border-nexus-border/40 bg-nexus-card/40 backdrop-blur-xl p-6 shadow-lg hover:border-nexus-border/70 hover:-translate-y-px transition-all duration-300"
              >
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", f.bg)}>
                  <f.icon className={cn("w-6 h-6", f.color)} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-nexus-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 max-w-2xl mx-auto text-center px-4">
          <div className="rounded-2xl border border-nexus-border/40 bg-nexus-card/40 backdrop-blur-xl p-8 md:p-12 shadow-xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to transform your team's communication?</h2>
            <p className="text-nexus-muted mb-6">Join thousands of teams already using Nexus Chat.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <NexusButton size="lg" onClick={() => navigate("/signup")} className="gap-2">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </NexusButton>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-nexus-border/20 w-full text-center">
          <p className="text-xs text-nexus-muted">© 2025 Nexus Chat. All rights reserved.</p>
        </footer>
      </main>

      <style>{`
        @keyframes mockupFloat {
          0%, 100% { transform: rotateX(5deg) translateY(0); }
          50% { transform: rotateX(5deg) translateY(-8px); }
        }
        .perspective-1000 { perspective: 1000px; }
      `}</style>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}
