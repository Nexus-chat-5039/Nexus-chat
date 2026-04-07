import { memo } from "react"
import logo from "../assets/logo.svg"
import { Menu, Info, Pin, Bookmark, MessageSquare } from "lucide-react"

type Props = {
  title: string
  onToggleSidebar: () => void
  onOpenDetails: () => void
  viewMode?: "all" | "pinned" | "bookmarked"
  setViewMode?: (mode: "all" | "pinned" | "bookmarked") => void
}

const ChatHeader = memo(function ChatHeader({ title, onToggleSidebar, onOpenDetails, viewMode = "all", setViewMode }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-nexus-border/30 bg-nexus-bg/60 backdrop-blur-xl shadow-sm px-4 md:px-6 py-3 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 text-nexus-muted hover:text-white hover:bg-nexus-surface hover:scale-105 rounded-xl transition-all duration-200"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={logo}
              alt="Nexus"
              className="h-9 w-9 rounded-xl bg-nexus-primary p-1.5 shadow-sm shadow-nexus-primary/20"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-nexus-bg" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight max-w-[150px] sm:max-w-[300px] truncate">{title || "Chat"}</p>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <p className="text-[11px] text-nexus-muted">Online</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {setViewMode && (
          <>
            <button
              onClick={() => setViewMode(viewMode === "all" ? "all" : "all")}
              className={`p-2 rounded-xl transition-all duration-200 ${viewMode === "all" ? "text-nexus-primary bg-nexus-primary/10" : "text-nexus-muted hover:text-white hover:bg-nexus-surface"}`}
              title="All Messages"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode(viewMode === "pinned" ? "all" : "pinned")}
              className={`p-2 rounded-xl transition-all duration-200 ${viewMode === "pinned" ? "text-amber-500 bg-amber-500/10" : "text-nexus-muted hover:text-white hover:bg-nexus-surface"}`}
              title="Pinned Messages"
            >
              <Pin className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode(viewMode === "bookmarked" ? "all" : "bookmarked")}
              className={`p-2 rounded-xl transition-all duration-200 ${viewMode === "bookmarked" ? "text-blue-400 bg-blue-500/10" : "text-nexus-muted hover:text-white hover:bg-nexus-surface"}`}
              title="Bookmarked Messages"
            >
              <Bookmark className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-nexus-border/50 mx-1"></div>
          </>
        )}

        <button
          onClick={onOpenDetails}
          className="text-nexus-muted hover:text-white p-2 rounded-xl hover:bg-nexus-surface hover:scale-105 transition-all duration-200"
          title="Group Info"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
})

export default ChatHeader
