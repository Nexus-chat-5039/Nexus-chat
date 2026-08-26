import { useEffect, useRef } from "react"

export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mediaQuery.matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number | null = null
    let isRunning = true
    let width = window.innerWidth
    let height = window.innerHeight
    
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const setSize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }
    setSize()

    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(setSize, 150)
    }
    window.addEventListener("resize", onResize)

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number

      constructor() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 0.4
        this.vy = (Math.random() - 0.5) * 0.4
        this.radius = Math.random() * 1.5 + 0.5
      }

      update() {
        this.x += this.vx
        this.y += this.vy

        if (this.x < 0 || this.x > width) this.vx *= -1
        if (this.y < 0 || this.y > height) this.vy *= -1
      }

      draw() {
        if (!ctx) return
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(224, 60, 49, 0.4)"
        ctx.fill()
      }
    }

    // Number of particles depends on screen size (capped for high performance)
    const particleCount = Math.min(Math.floor((width * height) / 18000), 60)
    const particles = Array.from({ length: particleCount }, () => new Particle())

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 140) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            const opacity = (1 - distance / 140) * 0.15
            ctx.strokeStyle = `rgba(224, 60, 49, ${opacity})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      if (!isRunning) return
      ctx.clearRect(0, 0, width, height)
      
      particles.forEach((p) => {
        p.update()
        p.draw()
      })
      
      drawLines()
      animationFrameId = requestAnimationFrame(animate)
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
      } else {
        if (!isRunning) {
          isRunning = true
          animationFrameId = requestAnimationFrame(animate)
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    animationFrameId = requestAnimationFrame(animate)

    return () => {
      isRunning = false
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (resizeTimer) clearTimeout(resizeTimer)
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Base */}
      <div className="absolute inset-0 bg-nexus-bg transition-colors duration-300" />

      {/* Particle Network Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-25 dark:opacity-60 mix-blend-multiply dark:mix-blend-screen" />

      {/* Orb 1 - Top-left, red tint */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-5 dark:opacity-40 transition-opacity duration-300"
        style={{
          top: "-20%",
          left: "-10%",
          background: "radial-gradient(circle, rgba(224,60,49,0.12) 0%, transparent 70%)",
          animation: "orbFloat1 22s ease-in-out infinite",
        }}
      />

      {/* Orb 2 - Center-right, subtle warmth */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-5 dark:opacity-30 transition-opacity duration-300"
        style={{
          top: "40%",
          right: "-10%",
          background: "radial-gradient(circle, rgba(200,60,40,0.1) 0%, transparent 70%)",
          animation: "orbFloat2 18s ease-in-out infinite",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.01] dark:opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
          mixBlendMode: "overlay"
        }}
      />
    </div>
  )
}
