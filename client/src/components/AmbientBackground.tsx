/**
 * Living gradient mesh background for Landing, Login, Signup pages.
 * Three slowly drifting radial gradient orbs with noise texture overlay.
 */
export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Base */}
      <div className="absolute inset-0 bg-nexus-bg" />

      {/* Orb 1 - Top-left, red tint */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-60"
        style={{
          top: "-10%",
          left: "-5%",
          background: "radial-gradient(circle, rgba(164,22,26,0.10) 0%, transparent 70%)",
          animation: "orbFloat1 22s ease-in-out infinite",
        }}
      />

      {/* Orb 2 - Center-right, warmer tint */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-50"
        style={{
          top: "30%",
          right: "-10%",
          background: "radial-gradient(circle, rgba(200,60,40,0.07) 0%, transparent 70%)",
          animation: "orbFloat2 18s ease-in-out infinite",
        }}
      />

      {/* Orb 3 - Bottom-center, subtle purple tint */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full opacity-40"
        style={{
          bottom: "-5%",
          left: "30%",
          background: "radial-gradient(circle, rgba(100,50,120,0.06) 0%, transparent 70%)",
          animation: "orbFloat3 25s ease-in-out infinite",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
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
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(50px, -30px) scale(0.95); }
          66% { transform: translate(-30px, 20px) scale(1.05); }
        }
      `}</style>
    </div>
  )
}
