import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useWorkspace } from "../context/WorkspaceContext"
import { getProfile, updateProfile } from "../api/auth"
import { API_URL, getImageUrl } from "../api/config"
import {
  ArrowLeft, Key, Lock, Bell, Palette, Shield, LogOut,
  ChevronRight, Moon, Sun, Monitor
} from "lucide-react"
import GlassCard from "../components/ui/GlassCard"
import NexusAvatar from "../components/ui/NexusAvatar"
import NexusButton from "../components/ui/NexusButton"

type Section = "account" | "privacy" | "notifications" | "appearance"

export default function Settings() {
  const { logout, token } = useAuth()
  const { username, userEmail } = useWorkspace()
  const navigate = useNavigate()

  const [activeSection, setActiveSection] = useState<Section>("account")
  const [bio, setBio] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark")

  useEffect(() => {
    document.title = "Settings — Nexus Chat"
  }, [])

  useEffect(() => {
    if (token) {
      getProfile()
        .then((data) => {
          if (data.bio) setBio(data.bio)
          if (data.is_private !== undefined) setIsPrivate(data.is_private)
          if (data.profile_image) setProfileImage(data.profile_image)
        })
        .catch(console.error)
    }
  }, [token])

  const handlePrivacyToggle = async (checked: boolean) => {
    setIsPrivate(checked)
    try {
      await updateProfile(undefined, undefined, undefined, undefined, checked)
    } catch (err) {
      console.error("Failed to update privacy", err)
      setIsPrivate(!checked)
    }
  }

  const menuItems: { id: Section; icon: typeof Key; label: string; desc: string }[] = [
    { id: "account", icon: Key, label: "Account", desc: "Security, profile info" },
    { id: "privacy", icon: Lock, label: "Privacy", desc: "Visibility, data controls" },
    { id: "notifications", icon: Bell, label: "Notifications", desc: "Messages, alerts" },
    { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme, display" },
  ]

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text flex flex-col md:flex-row overflow-hidden">
      {/* Left sidebar */}
      <div className="w-full md:w-72 lg:w-80 flex flex-col border-r border-nexus-border/30 bg-nexus-sidebar/40 shrink-0">
        {/* Header */}
        <div className="h-14 flex items-center px-4 border-b border-nexus-border/30 shrink-0 gap-3">
          <button
            onClick={() => navigate("/chat")}
            className="p-1.5 rounded-lg hover:bg-nexus-hover transition-colors text-nexus-muted hover:text-nexus-text"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold">Settings</h1>
        </div>

        {/* Profile card */}
        <div
          onClick={() => navigate("/profile")}
          className="mx-3 mt-3 p-3 rounded-xl bg-nexus-card/40 border border-nexus-border/30 cursor-pointer hover:bg-nexus-card/60 hover:border-nexus-border/50 transition-all flex items-center gap-3"
        >
          <NexusAvatar src={profileImage ? getImageUrl(profileImage) : null} name={username || "U"} size="md" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{username || "User"}</h2>
            <p className="text-xs text-nexus-muted truncate">{bio || "Hey there! I'm using Nexus."}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-nexus-muted ml-auto shrink-0" />
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-nexus-card/60 border border-nexus-border/40 shadow-sm"
                    : "border border-transparent hover:bg-nexus-card/30"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-nexus-primary" : "text-nexus-muted"}`} />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[11px] text-nexus-muted">{item.desc}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-nexus-border/30 shrink-0">
          <button
            onClick={() => { logout(); navigate("/login") }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 transition-all text-red-400/80 hover:text-red-400 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
        {activeSection === "account" && (
          <div className="max-w-lg animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-6">Account</h2>

            <div className="space-y-4">
              <GlassCard className="p-5">
                <h3 className="font-semibold text-sm mb-1">Private Account</h3>
                <p className="text-xs text-nexus-muted mb-4 leading-relaxed">
                  When enabled, your name will be hidden in chats (shown as "User-XXXX").
                  Nexus AI will still know your name to assist you.
                </p>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isPrivate}
                    onChange={(e) => handlePrivacyToggle(e.target.checked)}
                  />
                  <div className="w-10 h-5.5 bg-nexus-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-nexus-primary" />
                </label>
              </GlassCard>

              <GlassCard className="p-5">
                <h3 className="font-semibold text-sm mb-1 text-red-400">Delete Account</h3>
                <p className="text-xs text-nexus-muted mb-4 leading-relaxed">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <NexusButton variant="danger" size="sm">
                  Delete Account
                </NexusButton>
              </GlassCard>
            </div>
          </div>
        )}

        {activeSection === "privacy" && (
          <div className="max-w-lg animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-6">Privacy</h2>
            <GlassCard className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-nexus-primary" />
                <div>
                  <h3 className="font-semibold text-sm">End-to-End Encryption</h3>
                  <p className="text-xs text-nexus-muted">Your messages are encrypted in transit and at rest.</p>
                </div>
              </div>
              <div className="h-px bg-nexus-border/30 my-4" />
              <p className="text-xs text-nexus-muted leading-relaxed">
                Nexus Chat uses industry-standard encryption to protect your data.
                All messages are stored securely with strict access controls.
              </p>
            </GlassCard>
          </div>
        )}

        {activeSection === "notifications" && (
          <div className="max-w-lg animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-6">Notifications</h2>
            <div className="space-y-3">
              {["Mentions", "Direct Messages", "Group Invites"].map((item) => (
                <GlassCard key={item} className="p-4 flex items-center justify-between" hover={false}>
                  <span className="text-sm">{item}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-nexus-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-nexus-primary" />
                  </label>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {activeSection === "appearance" && (
          <div className="max-w-lg animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-6">Appearance</h2>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { id: "dark" as const, icon: Moon, label: "Dark" },
                { id: "light" as const, icon: Sun, label: "Light" },
                { id: "system" as const, icon: Monitor, label: "System" },
              ].map((t) => {
                const Icon = t.icon
                const isActive = theme === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      isActive
                        ? "border-nexus-primary/50 bg-nexus-primary/8 shadow-[0_0_15px_rgba(164,22,26,0.1)]"
                        : "border-nexus-border/40 bg-nexus-card/30 hover:border-nexus-border/60"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? "text-nexus-primary" : "text-nexus-muted"}`} />
                    <span className={`text-xs font-medium ${isActive ? "text-nexus-text" : "text-nexus-muted"}`}>
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
