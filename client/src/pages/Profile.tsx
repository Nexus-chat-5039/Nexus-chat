import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useWorkspace } from "../context/WorkspaceContext"
import { updateProfile, getProfile, uploadAvatar } from "../api/auth"
import { ArrowLeft, Camera, User } from "lucide-react"
import { getImageUrl } from "../api/config"

export default function Profile() {
  const { token, login } = useAuth()
  const { userEmail, username: currentUsername } = useWorkspace()
  const navigate = useNavigate()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [bio, setBio] = useState("")
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    document.title = "Profile — Nexus Chat"
  }, [])

  useEffect(() => {
    if (currentUsername) setUsername(currentUsername)
    if (userEmail) setEmail(userEmail)

    const fetchMe = async () => {
      if (!token) return
      try {
        const data = await getProfile()
        setFullName(data.full_name || "")
        setBio(data.bio || "")
        setUsername(data.username || "")
        setEmail(data.email || "")
        if (data.profile_image) setProfileImage(data.profile_image)
      } catch (e) {
        console.error("Failed to fetch profile", e)
      }
    }
    fetchMe()
  }, [currentUsername, userEmail, token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      if (!token) throw new Error("Not authenticated")
      const data = await updateProfile(username, email, fullName, bio)
      login(data.access_token)
      setSuccess("Profile updated successfully")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setImageLoading(true)
    setError("")
    try {
      const data = await uploadAvatar(file)
      setProfileImage(`${data.profile_image}?t=${Date.now()}`)
    } catch (err) {
      console.error(err)
      setError("Failed to upload image")
    } finally {
      setImageLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-nexus-bg text-nexus-text p-4">
      <div className="w-full max-w-md p-8 bg-nexus-card rounded-2xl border border-nexus-border shadow-2xl shadow-black/30 animate-fadeIn">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate("/chat")}
            className="mr-4 p-2 rounded-xl hover:bg-nexus-bg transition-all text-nexus-muted hover:text-nexus-text"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Profile Settings</h1>
        </div>

        <div className="flex justify-center mb-8">
          <div className="relative group cursor-pointer">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-nexus-bg ring-2 ring-nexus-border bg-nexus-input flex items-center justify-center">
              {profileImage ? (
                <img src={getImageUrl(profileImage)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-nexus-muted" />
              )}
              {imageLoading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-nexus-primary p-2 rounded-full cursor-pointer hover:brightness-110 transition-all shadow-lg group-hover:scale-110">
              <Camera className="w-4 h-4 text-white" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={imageLoading}
              />
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nexus-muted mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl bg-nexus-input border border-nexus-border px-4 py-2.5 text-nexus-text focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nexus-muted mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-nexus-input border border-nexus-border px-4 py-2.5 text-nexus-text focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nexus-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-nexus-input border border-nexus-border px-4 py-2.5 text-nexus-text focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-nexus-muted mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl bg-nexus-input border border-nexus-border px-4 py-2.5 text-nexus-text focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20 outline-none h-24 resize-none transition-all text-sm"
              placeholder="Tell us about yourself..."
            />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">{error}</p>}
          {success && <p className="text-emerald-400 text-sm bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-2">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-nexus-primary hover:brightness-110 text-white font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  )
}
