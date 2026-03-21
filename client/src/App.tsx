import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context/AuthContext"

const Login = lazy(() => import("./pages/Login"))
const Signup = lazy(() => import("./pages/Signup"))
const Chat = lazy(() => import("./pages/Chat"))
const Profile = lazy(() => import("./pages/Profile"))
const Landing = lazy(() => import("./pages/Landing"))
const Onboarding = lazy(() => import("./pages/Onboarding"))
const Settings = lazy(() => import("./pages/Settings"))
const AuthCallback = lazy(() => import("./pages/AuthCallback"))

function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-nexus-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-nexus-primary border-t-transparent" />
        <p className="text-nexus-muted text-sm animate-pulse">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  const { token } = useAuth()

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/chat" /> : <Landing />} />
        <Route path="/login" element={token ? <Navigate to="/chat" /> : <Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={token ? <Onboarding /> : <Navigate to="/" />} />
        <Route path="/chat" element={token ? <Chat /> : <Navigate to="/" />} />
        <Route path="/profile" element={token ? <Profile /> : <Navigate to="/" />} />
        <Route path="/settings" element={token ? <Settings /> : <Navigate to="/" />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  )
}
