import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "../stores/authStore"
import { useThemeStore } from "../stores/themeStore"
import { useWorkspace } from "../context/WorkspaceContext"
import { getProfile, updateProfile, deleteAccount } from "../api/auth"
import { getImageUrl } from "../api/config"
import {
  ArrowLeft, Key, Lock, Bell, Palette, Shield, LogOut,
  ChevronRight, Moon, Sun, Monitor, Eye, EyeOff, Check,
  AlertTriangle
} from "lucide-react"
import GlassCard from "../components/ui/GlassCard"
import NexusAvatar from "../components/ui/NexusAvatar"
import NexusButton from "../components/ui/NexusButton"
import Modal from "../components/Modal"

type Section = "account" | "privacy" | "notifications" | "appearance"

function ToggleSwitch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  id?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      id={id}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-primary focus-visible:ring-offset-2 focus-visible:ring-offset-nexus-bg ${
        checked
          ? "border-nexus-primary bg-nexus-primary shadow-[0_0_12px_rgba(224,60,49,0.35)]"
          : "border-slate-300 dark:border-nexus-border bg-slate-200 dark:bg-nexus-surface/90 hover:border-slate-400 dark:hover:border-nexus-border/80"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export default function Settings() {
  const { logout, token } = useAuthStore()
  const { username } = useWorkspace()
  const { theme, setTheme } = useThemeStore()
  const navigate = useNavigate()

  const [activeSection, setActiveSection] = useState<Section>("account")
  const [bio, setBio] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [privacyUpdatedMessage, setPrivacyUpdatedMessage] = useState(false)

  // Notification toggles state
  const [notifications, setNotifications] = useState({
    mentions: true,
    directMessages: true,
    groupInvites: true,
  })

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
    setSavingPrivacy(true)
    try {
      await updateProfile(undefined, undefined, undefined, undefined, checked)
      setPrivacyUpdatedMessage(true)
      setTimeout(() => setPrivacyUpdatedMessage(false), 3000)
    } catch (err) {
      console.error("Failed to update privacy", err)
      setIsPrivate(!checked)
    } finally {
      setSavingPrivacy(false)
    }
  }

  const menuItems: { id: Section; icon: typeof Key; label: string; desc: string }[] = [
    { id: "account", icon: Key, label: "Account", desc: "Security, profile info" },
    { id: "privacy", icon: Lock, label: "Privacy", desc: "Visibility, data controls" },
    { id: "notifications", icon: Bell, label: "Notifications", desc: "Messages, alerts" },
    { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme, display" },
  ]

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text flex flex-col md:flex-row overflow-hidden transition-colors duration-200">
      {/* Left sidebar */}
      <div className="w-full md:w-72 lg:w-80 flex flex-col border-r border-nexus-border/40 bg-nexus-sidebar/80 md:bg-nexus-sidebar/40 shrink-0">
        {/* Header */}
        <div className="h-14 flex items-center px-4 border-b border-nexus-border/40 shrink-0 gap-3">
          <button
            onClick={() => navigate("/chat")}
            className="p-1.5 rounded-lg hover:bg-nexus-hover transition-colors text-nexus-muted hover:text-nexus-text"
            aria-label="Back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold">Settings</h1>
        </div>

        {/* Profile card */}
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="mx-3 mt-3 p-3 rounded-xl bg-nexus-card border border-nexus-border/50 cursor-pointer hover:bg-nexus-card/90 hover:border-nexus-border shadow-sm transition-all flex items-center gap-3 text-left w-[calc(100%-1.5rem)]"
        >
          <NexusAvatar src={profileImage ? getImageUrl(profileImage) : null} name={username || "U"} size="md" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold truncate text-nexus-text">{username || "User"}</h2>
            <p className="text-xs text-nexus-muted truncate">{bio || "Hey there! I'm using Nexus."}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-nexus-muted shrink-0" />
        </button>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-nexus-card border border-nexus-border shadow-sm font-semibold"
                    : "border border-transparent hover:bg-nexus-card/50 text-nexus-muted hover:text-nexus-text"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-nexus-primary" : "text-nexus-muted"}`} />
                <div>
                  <div className={`text-sm ${isActive ? "text-nexus-text" : "text-nexus-text/80"}`}>{item.label}</div>
                  <div className="text-[11px] text-nexus-muted">{item.desc}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-nexus-border/40 shrink-0">
          <button
            onClick={() => { logout(); navigate("/login") }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 transition-all text-red-500 hover:text-red-600 dark:text-red-400/80 dark:hover:text-red-400 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
        {activeSection === "account" && (
          <div className="max-w-xl animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-6">Account Settings</h2>

            <div className="space-y-5">
              {/* Private Account Card */}
              <GlassCard className="p-6 border-nexus-border/60 bg-nexus-card/90 shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 transition-colors ${
                      isPrivate
                        ? "bg-nexus-primary/10 text-nexus-primary border border-nexus-primary/20"
                        : "bg-nexus-surface text-nexus-muted border border-nexus-border/40"
                    }`}>
                      {isPrivate ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base text-nexus-text">Private Account</h3>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                          isPrivate
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-nexus-surface text-nexus-muted border-nexus-border/60"
                        }`}>
                          {isPrivate ? "Hidden Mode Active" : "Public Mode"}
                        </span>
                      </div>
                      <p className="text-xs text-nexus-muted mt-1.5 leading-relaxed">
                        When enabled, your username will be hidden in chats (displayed as <span className="font-mono font-semibold text-nexus-primary/90">User-XXXX</span> to other members). Nexus AI will still know your identity to provide personalized context.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="shrink-0 pt-1">
                    <ToggleSwitch
                      checked={isPrivate}
                      onChange={handlePrivacyToggle}
                      label="Toggle Private Account mode"
                    />
                  </div>
                </div>

                {/* Status Message Feedback */}
                {privacyUpdatedMessage && (
                  <div className="mt-4 pt-3 border-t border-nexus-border/40 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 animate-[fadeIn_0.2s_ease-out]">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Privacy preferences saved successfully.</span>
                  </div>
                )}
                {savingPrivacy && (
                  <div className="mt-3 text-xs text-nexus-muted animate-pulse">
                    Updating privacy settings...
                  </div>
                )}
              </GlassCard>

              {/* Danger Zone: Delete Account */}
              <GlassCard className="p-6 border-red-500/20 bg-nexus-card/90 shadow-md">
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-red-500 dark:text-red-400">Delete Account</h3>
                    <p className="text-xs text-nexus-muted mt-1 leading-relaxed">
                      Permanently delete your account and all associated workspace data, messages, and memories. This action is irreversible.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <NexusButton
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Delete Account
                  </NexusButton>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {activeSection === "privacy" && (
          <div className="max-w-xl animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-6">Privacy & Security</h2>
            <GlassCard className="p-6 border-nexus-border/60 bg-nexus-card/90 shadow-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-nexus-primary/10 text-nexus-primary border border-nexus-primary/20 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">End-to-End Encrypted Transport</h3>
                  <p className="text-xs text-nexus-muted">All messages and streaming tokens are encrypted in transit via TLS 1.3.</p>
                </div>
              </div>
              <div className="h-px bg-nexus-border/40 my-3" />
              <p className="text-xs text-nexus-muted leading-relaxed">
                Nexus Chat uses strict tenant-isolated vector memory and PostgreSQL Row-Level security to ensure your personal workspace data remains strictly private to authorized members.
              </p>
            </GlassCard>
          </div>
        )}

        {activeSection === "notifications" && (
          <div className="max-w-xl animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-6">Notification Preferences</h2>
            <div className="space-y-3">
              {[
                { key: "mentions" as const, label: "Mentions & Replies", desc: "Notify when someone mentions your name or replies to your thread" },
                { key: "directMessages" as const, label: "Direct Messages", desc: "Instant notifications for 1-on-1 private messages" },
                { key: "groupInvites" as const, label: "Group Invites", desc: "Alerts when you are invited or added to a new team group" },
              ].map((item) => (
                <GlassCard key={item.key} className="p-4 flex items-center justify-between border-nexus-border/60 bg-nexus-card/90 shadow-sm" hover={false}>
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-nexus-text">{item.label}</span>
                    <p className="text-xs text-nexus-muted mt-0.5">{item.desc}</p>
                  </div>
                  <ToggleSwitch
                    checked={notifications[item.key]}
                    onChange={(val) => setNotifications((prev) => ({ ...prev, [item.key]: val }))}
                    label={`Toggle ${item.label}`}
                  />
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {activeSection === "appearance" && (
          <div className="max-w-xl animate-[fadeIn_0.3s_ease-out]">
            <h2 className="text-xl font-bold mb-2">Appearance</h2>
            <p className="text-xs text-nexus-muted mb-6">
              Customize how Nexus Chat looks on your device. Changes apply instantly.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
              {[
                { id: "dark" as const, icon: Moon, label: "Dark Mode", desc: "Sleek obsidian theme" },
                { id: "light" as const, icon: Sun, label: "Light Mode", desc: "Crisp modern light theme" },
                { id: "system" as const, icon: Monitor, label: "System Sync", desc: "Follows OS settings" },
              ].map((t) => {
                const Icon = t.icon
                const isActive = theme === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center text-center p-5 rounded-2xl border transition-all duration-200 ${
                      isActive
                        ? "border-nexus-primary bg-nexus-primary/10 shadow-[0_0_20px_rgba(224,60,49,0.15)] ring-2 ring-nexus-primary/20"
                        : "border-nexus-border/60 bg-nexus-card hover:border-nexus-border hover:bg-nexus-hover/50 shadow-sm"
                    }`}
                  >
                    <div className={`p-3 rounded-xl mb-3 transition-colors ${
                      isActive ? "bg-nexus-primary text-white" : "bg-nexus-surface text-nexus-muted"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-sm font-semibold mb-1 ${isActive ? "text-nexus-primary" : "text-nexus-text"}`}>
                      {t.label}
                    </span>
                    <span className="text-[11px] text-nexus-muted">
                      {t.desc}
                    </span>
                  </button>
                )
              })}
            </div>

            <GlassCard className="p-4 border-nexus-border/60 bg-nexus-card/90 text-xs text-nexus-muted flex items-center gap-3">
              <Palette className="w-4 h-4 text-nexus-primary shrink-0" />
              <span>Theme preference is saved to your browser and synchronized across all pages.</span>
            </GlassCard>
          </div>
        )}

        {/* Delete Account Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Account"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-nexus-muted leading-relaxed">
              Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.
            </p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-nexus-muted hover:bg-nexus-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteAccount()
                  } catch (err) {
                    console.error("Failed to delete account from backend", err)
                  } finally {
                    setShowDeleteModal(false)
                    logout()
                    navigate("/login")
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
