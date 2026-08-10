import { useEffect, useRef } from "react"

export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let width = window.innerWidth
    let height = window.innerHeight
    
    const setSize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }
    setSize()
    window.addEventListener("resize", setSize)

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number

      constructor() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 0.5
        this.vy = (Math.random() - 0.5) * 0.5
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
        ctx.fillStyle = "rgba(224, 60, 49, 0.4)" // Nexus primary red, semi-transparent
        ctx.fill()
      }
    }

    // Number of particles depends on screen size (roughly 1 per 15000 pixels)
    const particleCount = Math.floor((width * height) / 15000)
    const particles = Array.from({ length: particleCount }, () => new Particle())

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            // Opacity based on distance (closer = more opaque)
            const opacity = (1 - distance / 150) * 0.15
            ctx.strokeStyle = `rgba(224, 60, 49, ${opacity})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      
      particles.forEach((p) => {
        p.update()
        p.draw()
      })
      
      drawLines()
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", setSize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Base */}
      <div className="absolute inset-0 bg-[#0d0d0d]" />

      {/* Particle Network Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen" />

      {/* Orb 1 - Top-left, red tint */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full opacity-40"
        style={{
          top: "-20%",
          left: "-10%",
          background: "radial-gradient(circle, rgba(224,60,49,0.08) 0%, transparent 70%)",
          animation: "orbFloat1 22s ease-in-out infinite",
        }}
      />

      {/* Orb 2 - Center-right, subtle warmth */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-30"
        style={{
          top: "40%",
          right: "-10%",
          background: "radial-gradient(circle, rgba(200,60,40,0.06) 0%, transparent 70%)",
          animation: "orbFloat2 18s ease-in-out infinite",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
          mixBlendMode: "overlay"
        }}
      />

      <style>{`
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, 30px) scale(1.05); }
          66% { transform: translate(-20px, 50px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, -40px) scale(1.08); }
          66% { transform: translate(20px, -20px) scale(0.92); }
        }
      `}</style>
    </div>
  )
}
