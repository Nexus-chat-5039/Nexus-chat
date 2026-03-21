import logo from "../assets/logo.svg"

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: React.ReactNode
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-nexus-bg text-nexus-text p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-nexus-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md rounded-2xl bg-nexus-card/90 backdrop-blur-sm border border-nexus-border p-8 shadow-2xl shadow-black/30 relative z-10 animate-fadeIn">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-nexus-primary ring-1 ring-nexus-primary shadow-[0_0_20px_rgba(164,22,26,0.3)]">
            <img src={logo} alt="Nexus logo" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold">Nexus</h1>
          <p className="text-sm text-nexus-muted mt-1">{subtitle}</p>
        </div>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}
