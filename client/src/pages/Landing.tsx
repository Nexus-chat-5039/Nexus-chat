import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import logo from "../assets/logo.svg"
import { 
  ArrowRight, Sparkles, Brain, Zap, Search, Users, Network, Lock,
  ChevronDown, Github, Shield, CheckCircle2
} from "lucide-react"
import AmbientBackground from "../components/AmbientBackground"
import NexusButton from "../components/ui/NexusButton"
import NexusBadge from "../components/ui/NexusBadge"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const SCENARIOS = [
  {
    channel: "engineering",
    users: [
      { name: "Alex", initial: "A", color: "blue", time: "10:35 AM", text: "Hey team, looking at the Q3 roadmap, we need to finalize the migration phases today." },
      { name: "Sarah", initial: "S", color: "emerald", time: "10:38 AM", text: "Agreed. I finished the pre-migration audit yesterday. The data sync is the next big hurdle we have to plan for." },
      { name: "David", initial: "D", color: "amber", time: "10:41 AM", text: "Should we do a staged rollout or a full cutover? I remember we talked about this in the architecture channel." },
      { name: "Alex", initial: "A", color: "blue", time: "10:42 AM", text: "<span class=\"text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded font-medium\">@Nexus</span> can you summarize our discussions on staged vs cutover from #architecture, and draft a migration plan based on Sarah's audit?" },
    ],
    aiResponse: "I've reviewed the #architecture channel and Sarah's recent audit. The team heavily favored a **staged rollout** due to legacy database constraints.\n\nHere is a draft of the Q3 Migration Plan:\n- **Phase 1**: Pre-migration audit (Completed by Sarah)\n- **Phase 2**: Data sync staging (Target: Friday)\n- **Phase 3**: Staged Rollout - 10% traffic redirection\n- **Phase 4**: Full Cutover - Scheduled for maintenance window.",
    sources: "2 Sources"
  },
  {
    channel: "incidents",
    users: [
      { name: "Ops", initial: "O", color: "red", time: "02:14 PM", text: "Production database CPU is spiking to 100%." },
      { name: "Backend", initial: "B", color: "purple", time: "02:15 PM", text: "Is it the indexing job again?" },
      { name: "Ops", initial: "O", color: "red", time: "02:16 PM", text: "<span class=\"text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded font-medium\">@Nexus</span> check DataDog logs for the last 15 mins and identify the slow queries causing the CPU spike." },
    ],
    aiResponse: "I analyzed the DataDog logs. The spike is caused by 3 slow queries originating from the `analytics_worker` service.\n\nThey are missing an index and performing full table scans on `events`:\n\n`SELECT * FROM events WHERE type = 'pageview' AND user_id IS NULL;`\n\nI recommend applying the index from PR #442 to resolve this.",
    sources: "DataDog • GitHub"
  },
  {
    channel: "product",
    users: [
      { name: "Product", initial: "P", color: "fuchsia", time: "09:00 AM", text: "We need to figure out our Q4 objectives." },
      { name: "Design", initial: "D", color: "pink", time: "09:12 AM", text: "I think user onboarding is the biggest dropoff point." },
      { name: "Product", initial: "P", color: "fuchsia", time: "09:15 AM", text: "<span class=\"text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded font-medium\">@Nexus</span> synthesize customer feedback from last month regarding onboarding and draft 3 potential OKRs." },
    ],
    aiResponse: "Based on 142 Intercom conversations and 3 user interviews, the main friction is the setup wizard.\n\n**Draft OKRs for Q4:**\n1. **Increase Activation:** Improve day-1 setup completion from 40% to 65%.\n2. **Reduce Time-to-Value:** Cut average onboarding time to under 3 minutes.\n3. **User Education:** Launch interactive tooltip walkthroughs for core features.",
    sources: "Intercom • Dovetail"
  },
  {
    channel: "sales",
    users: [
      { name: "Sales", initial: "S", color: "orange", time: "11:20 AM", text: "I have a closing call with Acme Corp tomorrow." },
      { name: "Solutions", initial: "S", color: "cyan", time: "11:22 AM", text: "They had some strict security requirements last time." },
      { name: "Sales", initial: "S", color: "orange", time: "11:24 AM", text: "<span class=\"text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded font-medium\">@Nexus</span> pull up Acme Corp's last 3 Gong transcripts and summarize their primary security blockers." },
    ],
    aiResponse: "I reviewed the 3 most recent Gong transcripts with Acme Corp.\n\nTheir primary security blockers are:\n1. **Data Residency:** They require EU data centers.\n2. **Compliance:** SOC2 Type II report is mandatory before signing.\n3. **SSO:** They need SAML integration with Okta for all users.\n\nWe currently support all three. I've attached our SOC2 report to this thread.",
    sources: "Gong • Salesforce"
  },
  {
    channel: "frontend",
    users: [
      { name: "Frontend", initial: "F", color: "yellow", time: "04:30 PM", text: "The new dashboard is rendering very slowly on mobile." },
      { name: "QA", initial: "Q", color: "teal", time: "04:35 PM", text: "Yeah, getting 12fps when scrolling the lists." },
      { name: "Frontend", initial: "F", color: "yellow", time: "04:38 PM", text: "<span class=\"text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded font-medium\">@Nexus</span> analyze the React performance profiles attached and suggest rendering optimizations." },
    ],
    aiResponse: "I've analyzed the React performance profiles.\n\nThe bottleneck is the `DataGrid` component re-rendering on every scroll event because `selectedRowIds` is mutating.\n\n**Suggestions:**\n1. Wrap `DataGrid` in `React.memo`.\n2. Use `useMemo` for the `columns` array.\n3. Implement virtualization using `@tanstack/react-virtual` for the list container.",
    sources: "React Profiler"
  }
];

const COLOR_MAP: Record<string, string> = {
  blue: "from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-500",
  emerald: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-500",
  amber: "from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-500",
  red: "from-red-500/20 to-red-600/10 border-red-500/20 text-red-500",
  purple: "from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-500",
  fuchsia: "from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/20 text-fuchsia-500",
  pink: "from-pink-500/20 to-pink-600/10 border-pink-500/20 text-pink-500",
  orange: "from-orange-500/20 to-orange-600/10 border-orange-500/20 text-orange-500",
  cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-500",
  yellow: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/20 text-yellow-500",
  teal: "from-teal-500/20 to-teal-600/10 border-teal-500/20 text-teal-500"
};

function AnimatedChatMockup() {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [step, setStep] = useState(0)
  const [aiText, setAiText] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const scenario = SCENARIOS[scenarioIndex]

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [step, aiText, scenarioIndex])

  // Sequence
  useEffect(() => {
    let isSubscribed = true
    const runSequence = async () => {
      while (isSubscribed) {
        for (let sIndex = 0; sIndex < SCENARIOS.length; sIndex++) {
          if (!isSubscribed) break
          
          setScenarioIndex(sIndex)
          const currentScenario = SCENARIOS[sIndex]
          
          setStep(0)
          setAiText("")
          await new Promise(r => setTimeout(r, 800))
          if (!isSubscribed) break
          
          // Show each user message sequentially
          for (let i = 1; i < currentScenario.users.length; i++) {
            setStep(i)
            await new Promise(r => setTimeout(r, 1200))
            if (!isSubscribed) break
          }
          
          if (!isSubscribed) break
          
          const thinkingStep = currentScenario.users.length
          setStep(thinkingStep) // AI Typing
          await new Promise(r => setTimeout(r, 800))
          if (!isSubscribed) break
          
          const streamingStep = thinkingStep + 1
          setStep(streamingStep) // AI Streaming
          for (let i = 1; i <= currentScenario.aiResponse.length; i += 5) {
            if (!isSubscribed) break
            setAiText(currentScenario.aiResponse.slice(0, i))
            await new Promise(r => setTimeout(r, 1)) // typewriter speed
          }
          if (isSubscribed) setAiText(currentScenario.aiResponse)
          
          const doneStep = streamingStep + 1
          setStep(doneStep) // Done
          await new Promise(r => setTimeout(r, 6000)) // wait before next scenario
        }
      }
    }
    
    runSequence()
    return () => { isSubscribed = false }
  }, [])

  const renderText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i} className="block min-h-[1.2em]">
        {line.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="text-[#e5e7eb] font-semibold">{part.slice(2, -2)}</strong> 
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={j} className="text-[#e03c31] bg-[#e03c31]/10 px-1 py-0.5 rounded text-[13px] font-mono">{part.slice(1, -1)}</code>
          }
          return part
        })}
      </span>
    ))
  }

  return (
    <div className="w-full md:w-1/2 h-[450px] bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-[0_0_40px_rgba(224,60,49,0.1)] flex flex-col relative overflow-hidden group">
      <style>{`
        .animate-message { animation: fadeInUp 0.4s ease-out forwards; opacity: 0; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {/* Header */}
      <div className="h-10 border-b border-[#2a2a2a] flex items-center px-4 gap-2 bg-[#0d0d0d]/90 backdrop-blur-md z-20 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
        </div>
        <div className="ml-2 font-medium text-xs text-[#6b7280]"># {scenario.channel}</div>
      </div>
      
      {/* Chat Body */}
      <div ref={scrollRef} className="flex-1 p-4 md:p-5 flex flex-col gap-5 overflow-y-auto scrollbar-thin relative bg-[#121212] scroll-smooth">
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e03c31]/5 to-transparent pointer-events-none z-0" />
        
        {scenario.users.map((user, idx) => (
          step >= idx && (
            <div key={`${scenarioIndex}-${idx}`} className="flex gap-4 items-start relative z-10 animate-message px-2 py-2 hover:bg-white/[0.02] rounded-lg transition-colors group/msg">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${COLOR_MAP[user.color]} border flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold`}>{user.initial}</div>
              <div className="space-y-1 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#e5e7eb]">{user.name}</span>
                  <span className="text-[11px] text-[#6b7280]">{user.time}</span>
                </div>
                <div className="text-[14px] text-[#a1a1aa] leading-relaxed" dangerouslySetInnerHTML={{ __html: user.text }} />
              </div>
            </div>
          )
        ))}

        {/* AI Typing Indicator */}
        {step === scenario.users.length && (
          <div className="flex gap-4 items-start relative z-10 animate-message px-2 py-3 mt-2 bg-gradient-to-r from-[#e03c31]/[0.03] to-transparent rounded-r-lg border-l-2 border-[#e03c31]/50">
            <div className="w-8 h-8 rounded-lg bg-[#e03c31]/10 border border-[#e03c31]/20 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_10px_rgba(224,60,49,0.2)]">
              <Sparkles className="w-4 h-4 text-[#e03c31] animate-pulse" />
            </div>
            <div className="space-y-1 w-full flex flex-col justify-center h-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[#e03c31]">Nexus AI</span>
                <span className="text-xs text-[#6b7280] italic">is thinking</span>
              </div>
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-[#e03c31]/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-[#e03c31]/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-[#e03c31]/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* AI message streaming/complete */}
        {step >= scenario.users.length + 1 && (
          <div className="flex gap-4 items-start relative z-10 animate-message px-2 py-3 mt-2 bg-gradient-to-r from-[#e03c31]/[0.03] to-transparent rounded-r-lg border-l-2 border-[#e03c31]">
            <div className="w-8 h-8 rounded-lg bg-[#e03c31]/10 border border-[#e03c31]/20 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_10px_rgba(224,60,49,0.2)]">
              <Sparkles className="w-4 h-4 text-[#e03c31]" />
            </div>
            <div className="space-y-2 w-full">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#e03c31]">Nexus AI</span>
                <span className="text-[11px] text-[#6b7280]">Just now</span>
              </div>
              <div className="text-[14px] text-[#e5e7eb] leading-relaxed space-y-1">
                {renderText(aiText)}
                
                {step === scenario.users.length + 2 && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-[#e03c31]/10 animate-message">
                     <span className="px-2 py-0.5 rounded bg-[#e03c31]/10 text-[10px] font-sans text-[#e03c31] border border-[#e03c31]/20 cursor-pointer hover:bg-[#e03c31]/20 transition-colors uppercase tracking-wider font-bold">{scenario.sources}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


export default function Landing() {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

      // Header scroll effect
      ScrollTrigger.create({
        start: "top -50",
        onUpdate: (self) => {
          if (headerRef.current) {
            const isScrolled = self.progress > 0
            headerRef.current.style.backgroundColor = isScrolled ? "rgba(22, 26, 29, 0.85)" : "transparent"
            headerRef.current.style.borderBottomColor = isScrolled ? "rgba(42, 42, 42, 1)" : "transparent"
            headerRef.current.style.backdropFilter = isScrolled ? "blur(12px)" : "none"
          }
        },
      })

      // Generic animate-on-scroll
      const animateElements = document.querySelectorAll(".animate-on-scroll")
      animateElements.forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              once: true,
            },
          }
        )
      })
      
      // Staggered animate-on-scroll-group
      const groups = document.querySelectorAll(".animate-on-scroll-group")
      groups.forEach((group) => {
        const children = group.children
        gsap.fromTo(children,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: group,
              start: "top 85%",
              once: true,
            },
          }
        )
      })

    }, containerRef)

    return () => ctx.revert()
  }, [])

  const features = [
    {
      icon: Brain,
      title: "It actually remembers things",
      desc: "Had a discussion about the migration plan 3 weeks ago? Nexus indexed it. Ask and it'll pull up exactly what was decided, with context.",
    },
    {
      icon: Zap,
      title: "Fast enough to not be annoying",
      desc: "Responses come back in under a second. We use Groq for inference — it's genuinely fast, not 'fast for AI' fast.",
    },
    {
      icon: Search,
      title: "Search by what you meant",
      desc: "Forget keyword searches. Type 'that thing about the API rate limits' and Nexus finds the right conversation.",
    },
    {
      icon: Users,
      title: "Your space + team spaces",
      desc: "A personal workspace where you can think out loud with AI. Shared groups where the whole team collaborates. Both have full context.",
    },
    {
      icon: Network,
      title: "Not just another chatbot",
      desc: "Nexus uses RAG to ground every response in your actual conversations. It doesn't make things up — it references what your team actually said.",
    },
    {
      icon: Lock,
      title: "Self-host it if you want",
      desc: "JWT auth, role-based access, full Docker support. Run it on your own servers or let us handle it. Your call.",
    },
  ]

  const techStack = [
    "React", "TypeScript", "FastAPI", "MongoDB", 
    "Socket.io", "Groq", "Docker", "RAG"
  ]

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0d0d0d] text-nexus-text font-sans relative isolate overflow-x-hidden selection:bg-nexus-primary/30 selection:text-white">
      <AmbientBackground />

      {/* Header */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 px-6 md:px-8 h-16 flex items-center justify-between border-b border-transparent transition-all duration-300"
      >
        <div className="flex items-center gap-3">
          <img src={logo} alt="Nexus Chat" width="32" height="32" className="h-8 w-8 rounded-lg bg-nexus-primary p-1 shadow-sm" />
          <span className="font-bold text-lg tracking-tight text-white">Nexus</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium text-[#9CA3AF] hover:text-white px-4 py-2 rounded-xl hover:bg-[#161616] transition-all duration-200"
          >
            Login
          </button>
          <NexusButton size="sm" onClick={() => navigate("/signup")}>
            Get Started
          </NexusButton>
        </div>
      </header>

      {/* Hero */}
      <main id="main-content" tabIndex={-1} className="relative z-10 flex flex-col items-center pt-32 pb-20 px-4 focus:outline-none">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="hero-badge">
            <NexusBadge variant="primary" icon={<Sparkles className="w-3.5 h-3.5" />}>
              Open Source · Free to Use
            </NexusBadge>
          </div>

          <h1 className="hero-headline text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
            Team chat where the AI <span className="text-[#e03c31] block">actually remembers stuff</span>
          </h1>

          <p className="hero-sub text-lg md:text-xl text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
            Nexus is a workspace where your conversations aren't just stored — they're understood. 
            The AI reads the room, remembers past discussions, and jumps in when it has something useful.
          </p>

          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <NexusButton size="lg" onClick={() => navigate("/signup")} className="gap-2">
              Try it out <ArrowRight className="w-5 h-5" />
            </NexusButton>
            <NexusButton
              variant="secondary"
              size="lg"
              onClick={() => navigate("/login")}
            >
              I have an account
            </NexusButton>
          </div>
        </div>

        {/* Hero Mockup */}
        <div className="hero-mockup mt-16 w-full max-w-4xl mx-auto perspective-1000">
          <div
            className="relative rounded-2xl border border-[#2a2a2a] bg-[#161616]/80 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
            style={{
              animation: "mockupFloat 4s ease-in-out infinite",
              transform: "rotateX(5deg)",
            }}
          >
            <div className="h-10 bg-[#0d0d0d]/60 border-b border-[#2a2a2a] flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] text-[#6b7280]">nexus.chat/workspace</span>
              </div>
            </div>
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e03c31]/40 to-purple-500/30 shrink-0" />
                <div className="bg-[#2a2a2a] rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[60%]">
                  <div className="h-2.5 w-32 bg-[#6b7280]/20 rounded" />
                </div>
              </div>
              <div className="flex gap-3 items-end justify-end">
                <div className="bg-[#e03c31] rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[60%]">
                  <div className="h-2.5 w-40 bg-white/30 rounded" />
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/20 shrink-0" />
              </div>
              <div className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-full bg-[#e03c31]/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-[#e03c31]" />
                </div>
                <div className="bg-gradient-to-r from-[#e03c31]/10 to-transparent rounded-2xl rounded-bl-sm px-4 py-3 max-w-[75%] border border-[#e03c31]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-16 bg-[#e03c31]/50 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full bg-[#6b7280]/20 rounded" />
                    <div className="h-2 w-5/6 bg-[#6b7280]/20 rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div className="h-14 bg-[#0d0d0d]/60 border-t border-[#2a2a2a] flex items-center px-4 gap-3">
              <div className="flex-1 h-9 rounded-xl bg-[#161616] border border-[#2a2a2a]" />
              <div className="w-9 h-9 rounded-xl bg-[#e03c31]/80" />
            </div>
          </div>
        </div>

        <div className="scroll-cue mt-12 flex flex-col items-center gap-2 text-[#6b7280]">
          <span className="text-xs">Scroll to explore</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </main>

      {/* 1. BUILT WITH BAR */}
      <section className="w-full border-y border-[#2a2a2a] bg-[#161616]/30 py-8 relative z-10 animate-on-scroll">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 opacity-60">
          <span className="text-sm font-medium text-[#6b7280] uppercase tracking-wider">Built with —</span>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-[#6b7280] font-semibold text-base tracking-tight">
            <span>React + TypeScript</span>
            <span className="text-[#2a2a2a]">·</span>
            <span>FastAPI</span>
            <span className="text-[#2a2a2a]">·</span>
            <span>MongoDB</span>
            <span className="text-[#2a2a2a]">·</span>
            <span>Socket.io</span>
            <span className="text-[#2a2a2a]">·</span>
            <span>Groq + RAG</span>
          </div>
        </div>
      </section>

      {/* 2. FEATURES SECTION */}
      <section className="py-24 max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16 animate-on-scroll">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">What makes it different</h2>
          <p className="text-[#6b7280] text-lg md:text-xl max-w-2xl mx-auto">Most AI chat tools forget everything the moment you close the tab. Nexus doesn't.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-on-scroll-group">
          {features.map((f, i) => (
            <div key={i} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-8 hover:border-[#e03c31]/50 transition-colors group">
              <div className="w-12 h-12 bg-[#e03c31]/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <f.icon className="w-6 h-6 text-[#e03c31]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-[#6b7280] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="py-24 max-w-6xl mx-auto px-6 relative z-10 border-t border-[#2a2a2a]/50">
        <div className="text-center mb-20 animate-on-scroll">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Here's what happens when you @mention Nexus</h2>
        </div>

        <div className="relative animate-on-scroll">
          <div className="hidden md:block absolute top-6 left-12 right-12 h-px bg-[#2a2a2a]" />
          <div className="grid md:grid-cols-4 gap-10 md:gap-6 animate-on-scroll-group">
            {[
              { title: "You type a message", desc: "In any channel, group, or your personal space" },
              { title: "Context is pulled", desc: "Nexus searches past conversations for anything relevant" },
              { title: "AI writes a response", desc: "Grounded in what your team actually discussed, not hallucinated" },
              { title: "Shows up instantly", desc: "Streamed into the chat in real-time via WebSockets" }
            ].map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#161616] border-2 border-[#e03c31] text-[#e03c31] flex items-center justify-center font-bold text-lg mb-6 z-10 shadow-[0_0_15px_rgba(224,60,49,0.3)]">
                  {i + 1}
                </div>
                <h4 className="text-white font-bold mb-2">{step.title}</h4>
                <p className="text-[#6b7280] text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. SPLIT FEATURE HIGHLIGHT */}
      <section className="py-24 max-w-6xl mx-auto px-6 relative z-10 space-y-32">
        {/* Row 1 — Searchable Memory */}
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20 animate-on-scroll">
          <AnimatedChatMockup />
          <div className="w-full md:w-1/2 space-y-6">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">"Wait, didn't we talk about this already?"</h2>
            <p className="text-[#6b7280] text-lg leading-relaxed">
              Yeah, you did. Three weeks ago in #engineering. Nexus found it. 
              It searches across all your channels and pulls up the actual discussion — not a summary, the real thing.
            </p>
            <button onClick={() => navigate("/signup")} className="text-[#e03c31] font-semibold flex items-center gap-2 hover:gap-3 transition-all">
              Try it out <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2 — Enterprise Security */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-20 animate-on-scroll">
          <div className="w-full md:w-1/2 aspect-video bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-[0_0_40px_rgba(224,60,49,0.1)] flex items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e03c31]/10 to-transparent opacity-50" />
             {/* Security visual */}
             <div className="relative z-10 flex flex-col items-center gap-4">
               <div className="w-16 h-16 rounded-2xl bg-[#e03c31]/10 border border-[#e03c31]/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                 <Shield className="w-8 h-8 text-[#e03c31]/70" />
               </div>
               <div className="flex gap-3">
                 {["SSO", "RBAC", "E2E"].map(tag => (
                   <span key={tag} className="px-3 py-1 rounded-full bg-[#e03c31]/5 border border-[#e03c31]/15 text-[11px] font-mono text-[#e03c31]/60 uppercase tracking-wider">{tag}</span>
                 ))}
               </div>
             </div>
          </div>
          <div className="w-full md:w-1/2 space-y-6">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Your data stays yours. Seriously.</h2>
            <p className="text-[#6b7280] text-lg leading-relaxed">
              Nexus is open-source and fully self-hostable. Run it on your own servers, 
              behind your own firewall. We built it with proper auth and access controls from the start — not bolted on later.
            </p>
            <ul className="space-y-3">
              {["Self-host with Docker — takes about 5 minutes", "Role-based access per workspace and group", "JWT auth with secure session management"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[#9CA3AF] text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#e03c31] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. TECH STACK */}
      <section className="py-24 w-full border-t border-[#2a2a2a]/50 bg-[#161616]/30 relative z-10 animate-on-scroll">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h3 className="text-[#6b7280] font-medium mb-10 tracking-wide">The stack under the hood</h3>
          <div className="flex flex-wrap justify-center gap-4 animate-on-scroll-group">
            {techStack.map(tech => (
              <div key={tech} className="px-5 py-2.5 rounded-full border border-[#2a2a2a] text-[#6b7280] font-mono text-sm bg-[#0d0d0d] hover:border-[#e03c31]/30 hover:text-white transition-colors">
                {tech}
              </div>
            ))}
          </div>
          <p className="text-[#6b7280]/60 text-xs mt-6">Fully Dockerized · MIT Licensed · Contributions welcome</p>
        </div>
      </section>

      {/* 6. CTA SECTION */}
      <section className="py-24 max-w-5xl mx-auto px-6 relative z-10 animate-on-scroll">
        <div className="w-full rounded-3xl border border-[#2a2a2a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e03c31]/15 via-[#161616] to-[#161616] p-12 md:p-20 text-center overflow-hidden relative">
          <div className="relative z-10 max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Want to give it a spin?</h2>
            <p className="text-[#9CA3AF] text-lg md:text-xl">It's free, open-source, and takes about 5 minutes to set up. No credit card, no sales calls.</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button 
                onClick={() => navigate("/signup")}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#e03c31] hover:bg-[#e03c31]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#e03c31]"
              >
                Create an account <ArrowRight className="w-5 h-5" />
              </button>
              <a 
                href="https://github.com/Rajat25022005/Nexus-chat"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source code on GitHub"
                className="w-full sm:w-auto px-8 py-3.5 bg-transparent border border-[#2a2a2a] hover:border-[#9CA3AF] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-nexus-border"
              >
                <Github className="w-5 h-5" /> Check out the repo
              </a>
            </div>
            
            <p className="text-xs text-[#9CA3AF] pt-4">MIT Licensed · Self-hostable · PRs welcome</p>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="border-t border-[#2a2a2a]/40 bg-[#0d0d0d] pt-20 pb-10 px-6 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="Nexus Chat logo" width="32" height="32" className="h-8 w-8 rounded-lg bg-[#e03c31] p-1 shadow-sm" />
              <span className="font-bold text-lg tracking-tight text-white">Nexus</span>
            </div>
            <p className="text-[#9CA3AF] text-sm">Team chat with AI that actually pays attention.</p>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-[#9CA3AF]">
              <li><button onClick={() => navigate("/signup")} className="hover:text-[#e03c31] transition-colors">Features</button></li>
              <li><button onClick={() => navigate("/login")} className="hover:text-[#e03c31] transition-colors">Sign In</button></li>
              <li><button onClick={() => navigate("/signup")} className="hover:text-[#e03c31] transition-colors">Get Started</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-3 text-sm text-[#9CA3AF]">
              <li><a href="https://github.com/Rajat25022005/Nexus-chat" target="_blank" rel="noopener noreferrer" className="hover:text-[#e03c31] transition-colors">GitHub Repository</a></li>
              <li><a href="https://github.com/Rajat25022005/Nexus-chat#readme" target="_blank" rel="noopener noreferrer" className="hover:text-[#e03c31] transition-colors">Documentation</a></li>
              <li><a href="https://github.com/Rajat25022005/Nexus-chat/releases" target="_blank" rel="noopener noreferrer" className="hover:text-[#e03c31] transition-colors">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">About</h4>
            <ul className="space-y-3 text-sm text-[#9CA3AF]">
              <li><a href="https://github.com/Rajat25022005/Nexus-chat/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-[#e03c31] transition-colors">MIT License</a></li>
              <li><a href="https://github.com/Rajat25022005" target="_blank" rel="noopener noreferrer" className="hover:text-[#e03c31] transition-colors">Creator</a></li>
              <li><button onClick={() => navigate("/signup")} className="hover:text-[#e03c31] transition-colors">Contact</button></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-8 border-t border-[#2a2a2a]/40 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF]">
          <p>© 2025 Nexus · MIT License</p>
          <p>Built with FastAPI + React</p>
        </div>
      </footer>

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
