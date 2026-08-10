import { lazy, Suspense, useRef, useEffect } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useAuthStore } from "./stores/authStore"
import { useToast } from "./hooks/useToast"
import NexusToast from "./components/ui/NexusToast"
import gsap from "gsap"

const Login = lazy(() => import("./pages/Login"))
const Signup = lazy(() => import("./pages/Signup"))
const Chat = lazy(() => import("./pages/Chat"))
const Profile = lazy(() => import("./pages/Profile"))
const Landing = lazy(() => import("./pages/Landing"))
const Onboarding = lazy(() => import("./pages/Onboarding"))
const Settings = lazy(() => import("./pages/Settings"))


function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-nexus-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-nexus-primary border-t-transparent" />
        <p className="text-nexus-muted text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  )
}

// Page transition wrapper
function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    gsap.fromTo(
      el,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }
    )
  }, [location.pathname])

  return <div ref={ref}>{children}</div>
}

export default function App() {
  const { token } = useAuthStore()
  const { toasts, dismissToast } = useToast()

  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              <PageTransition>
                {token ? <Navigate to="/chat" /> : <Landing />}
              </PageTransition>
            }
          />
          <Route
            path="/login"
            element={
              <PageTransition>
                {token ? <Navigate to="/chat" /> : <Login />}
              </PageTransition>
            }
          />
          <Route
            path="/signup"
            element={
              <PageTransition>
                <Signup />
              </PageTransition>
            }
          />
          <Route
            path="/onboarding"
            element={
              <PageTransition>
                {token ? <Onboarding /> : <Navigate to="/" />}
              </PageTransition>
            }
          />
          <Route
            path="/chat"
            element={
              <PageTransition>
                {token ? <Chat /> : <Navigate to="/" />}
              </PageTransition>
            }
          />
          <Route
            path="/profile"
            element={
              <PageTransition>
                {token ? <Profile /> : <Navigate to="/" />}
              </PageTransition>
            }
          />
          <Route
            path="/settings"
            element={
              <PageTransition>
                {token ? <Settings /> : <Navigate to="/" />}
              </PageTransition>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <NexusToast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </>
  )
}
