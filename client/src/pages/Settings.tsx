import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useWorkspace } from "../context/WorkspaceContext"
import { getProfile, updateProfile } from "../api/auth"
import { API_URL, getImageUrl } from "../api/config"
import {
  Search,
  Key,
  Lock,
  MessageSquare,
  Bell,
  Keyboard,
  HelpCircle,
  LogOut,
  ArrowLeft,
} from "lucide-react"

export default function Settings() {
  const { logout, token } = useAuth()
  const { username, userEmail } = useWorkspace()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [bio, setBio] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)

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

  const menuItems = [
    { icon: Key, label: "Account", subLabel: "Security notifications, account info" },
    { icon: Lock, label: "Privacy", subLabel: "Blocked contacts, disappearing messages" },
    { icon: MessageSquare, label: "Chats", subLabel: "Theme, wallpaper, chat settings" },
    { icon: Bell, label: "Notifications", subLabel: "Messages, groups, sounds" },
    { icon: Keyboard, label: "Keyboard shortcuts", subLabel: "Quick actions" },
    { icon: HelpCircle, label: "Help and feedback", subLabel: "Help centre, contact us, privacy policy" },
  ]

  const filteredItems = menuItems.filter(
    (item) =>
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subLabel.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex h-screen bg-nexus-bg text-nexus-text overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex flex-col border-r border-nexus-border/50 h-full bg-nexus-sidebar">
        {/* Header */}
        <div className="p-4 flex items-center gap-3 border-b border-nexus-border/50">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-nexus-card transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-nexus-muted" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
          {/* Search */}
          <div className="my-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexus-muted" />
            <input
              type="text"
              placeholder="Search settings"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-nexus-card text-sm text-nexus-text placeholder-nexus-muted pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-nexus-primary/20 border border-nexus-border transition-all"
            />
          </div>

          {/* Profile Section */}
          <div
            onClick={() => navigate("/profile")}
            className="mb-6 flex items-center gap-4 p-3 cursor-pointer hover:bg-nexus-card rounded-xl transition-all"
          >
            <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-nexus-primary/50 to-purple-600/50 flex items-center justify-center text-lg font-bold text-white shrink-0 border-2 border-nexus-border">
              {profileImage ? (
                <img src={getImageUrl(profileImage)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{username?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-base font-semibold truncate">{username || "User"}</h2>
              <p className="text-sm text-nexus-muted truncate">{bio || "Hey there! I'm using Nexus."}</p>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-0.5">
            {filteredItems.map((item, index) => (
              <div
                key={index}
                onClick={() => setActiveSection(item.label)}
                className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all group
                  ${activeSection === item.label
                    ? "bg-nexus-card border border-nexus-border shadow-sm"
                    : "hover:bg-nexus-card border border-transparent"
                  }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    activeSection === item.label
                      ? "text-nexus-primary"
                      : "text-nexus-muted group-hover:text-nexus-primary"
                  }`}
                />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-nexus-muted">{item.subLabel}</div>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="p-4 text-center text-nexus-muted text-sm">No settings found</div>
            )}
          </div>

          {/* Logout */}
          <div className="mt-8 border-t border-nexus-border/50 pt-3">
            <button
              onClick={() => {
                logout()
                navigate("/login")
              }}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-500/10 transition-all text-red-400 hover:text-red-500"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Log out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {activeSection === "Account" ? (
          <div className="p-8 max-w-2xl animate-fadeIn">
            <h2 className="text-2xl font-bold mb-6">Account Settings</h2>
            <div className="bg-nexus-card rounded-2xl border border-nexus-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-nexus-text">Private Account</h3>
                  <p className="text-sm text-nexus-muted mt-1">
                    When enabled, your name will be hidden in chats (shown as &quot;User-XXXX&quot;).
                    <br />Nexus AI will still know your name to assist you.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isPrivate}
                    onChange={(e) => handlePrivacyToggle(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-nexus-surface peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-nexus-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nexus-primary" />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 text-nexus-muted">
            <div className="text-center animate-fadeIn">
              <div className="mb-4 inline-block p-6 rounded-2xl bg-nexus-card/50">
                <Key className="w-12 h-12 opacity-20" />
              </div>
              <p className="text-sm">
                {activeSection ? `${activeSection} settings coming soon...` : "Select a setting to view details"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
