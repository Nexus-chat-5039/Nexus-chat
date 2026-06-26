import { memo } from "react"
import { Menu, Info, Search, Users } from "lucide-react"

type Props = {
  title: string
  groupName: string
  onToggleSidebar: () => void
  onToggleInfo: () => void
  onOpenDetails: () => void
}

const ChatHeader = memo(function ChatHeader({
  title,
  groupName,
  onToggleSidebar,
  onToggleInfo,
  onOpenDetails,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b border-nexus-border/30 bg-nexus-bg/70 backdrop-blur-xl px-4 md:px-5 h-14 shrink-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-surface rounded-xl transition-all duration-200 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate max-w-[200px] sm:max-w-[300px]">
            {title || "Chat"}
          </p>
          {groupName && (
            <p className="text-[11px] text-nexus-muted truncate">{groupName}</p>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <button
          className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-surface rounded-xl transition-all duration-200"
          title="Search"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onOpenDetails}
          className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-surface rounded-xl transition-all duration-200"
          title="Members"
        >
          <Users className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onToggleInfo}
          className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-surface rounded-xl transition-all duration-200 hidden md:block"
          title="Info"
        >
          <Info className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  )
})

export default ChatHeader
