import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Settings, Plus, ChevronDown, ChevronRight, Hash, LogOut, User } from "lucide-react"
import { useAuthStore } from "../stores/authStore"
import Modal from "../components/Modal"
import type { Group } from "../types"

type Props = {
  groups: Group[]
  activeGroupId: string
  activeChatId: string
  onSelectGroup: (id: string) => void
  onSelectChat: (id: string) => void
  onNewGroup: (name: string) => void
  onNewChat: (title: string) => void
  onJoinGroup: (groupId: string) => void
  onDeleteGroup: (id: string) => void
  onDeleteChat: (groupId: string, chatId: string) => void
  userEmail: string
}

export default function Sidebar({
  groups,
  activeGroupId,
  activeChatId,
  onSelectGroup,
  onSelectChat,
  onNewGroup,
  onNewChat,
  onJoinGroup,
  onDeleteGroup,
  onDeleteChat,
  userEmail,
}: Props) {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [modalType, setModalType] = useState<"group" | "chat" | "join" | null>(null)
  const [inputValue, setInputValue] = useState("")

  const openModal = useCallback((type: "group" | "chat" | "join") => {
    setModalType(type)
    setInputValue("")
    setShowCreateMenu(false)
  }, [])

  const handleModalSubmit = useCallback(() => {
    if (!inputValue.trim()) return
    if (modalType === "group") onNewGroup(inputValue)
    else if (modalType === "chat") onNewChat(inputValue)
    else if (modalType === "join") onJoinGroup(inputValue)
    setModalType(null)
  }, [inputValue, modalType, onNewGroup, onNewChat, onJoinGroup])

  return (
    <div className="flex h-full w-[280px] md:w-[260px] flex-col border-r border-nexus-border/30 bg-nexus-sidebar/80 backdrop-blur-xl relative z-40">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-nexus-border/30 shrink-0">
        <h1 className="text-sm font-bold tracking-tight text-nexus-text/90">Workspaces</h1>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 scrollbar-thin">
        {groups.length === 0 && (
          <div className="text-center py-8 px-4">
            <p className="text-xs text-nexus-muted">No workspaces yet</p>
            <p className="text-[10px] text-nexus-muted/60 mt-1">Create one to get started</p>
          </div>
        )}

        {groups.map((group) => {
          const isPersonal = group.id.startsWith("personal_")
          const isOwner = group.user_id === userEmail
          const isActive = group.id === activeGroupId

          return (
            <div key={group.id} className="mb-0.5">
              {/* Group row */}
              <div
                className={`
                  flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer
                  transition-all duration-150 group
                  ${isActive ? "bg-nexus-primary/10" : "hover:bg-nexus-hover"}
                `}
                onClick={() => onSelectGroup(group.id)}
              >
                {/* Expand/collapse chevron */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isActive) onSelectGroup("") // collapse
                  }}
                  className="text-nexus-muted/50 hover:text-nexus-muted transition-colors"
                >
                  {isActive ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Group avatar */}
                <div
                  className={`
                    w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0
                    ${isActive ? "bg-nexus-primary/20 text-nexus-primary" : "bg-nexus-surface text-nexus-muted"}
                  `}
                >
                  {isPersonal ? <User className="w-3.5 h-3.5" /> : group.name.charAt(0).toUpperCase()}
                </div>

                {/* Group name */}
                <span className={`text-[13px] font-medium truncate flex-1 ${isActive ? "text-nexus-primary" : "text-nexus-text/80"}`}>
                  {group.name}
                </span>

                {/* Delete button */}
                {isOwner && !isPersonal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteGroup(group.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 p-1 rounded transition-all"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Chat list (expanded) */}
              {isActive && (
                <div className="ml-6 border-l border-nexus-border/30 pl-2 mt-0.5 space-y-0.5">
                  {group.chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => onSelectChat(chat.id)}
                      className={`
                        flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] cursor-pointer
                        transition-all duration-150 group/chat
                        ${chat.id === activeChatId
                          ? "bg-nexus-surface text-nexus-text font-medium"
                          : "text-nexus-muted/70 hover:bg-nexus-hover/50 hover:text-nexus-text/80"
                        }
                      `}
                    >
                      <Hash className="w-3 h-3 opacity-40" />
                      <span className="truncate flex-1">{chat.title}</span>
                      {(isOwner || isPersonal) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteChat(group.id, chat.id)
                          }}
                          className="opacity-0 group-hover/chat:opacity-100 text-red-400/60 hover:text-red-400 p-0.5 rounded transition-all"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* New button */}
        <div className="relative mt-3 px-1">
          <button
            onClick={() => setShowCreateMenu((p) => !p)}
            className="
              flex w-full items-center justify-center gap-2
              rounded-lg bg-nexus-primary/90 py-2 text-xs font-semibold text-white
              hover:bg-nexus-primary hover:shadow-[0_0_15px_rgba(164,22,26,0.25)]
              active:scale-[0.98] transition-all duration-200
            "
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>

          {showCreateMenu && (
            <div className="
              absolute left-0 right-0 top-full z-10 mt-1.5
              rounded-xl border border-nexus-border/50
              bg-nexus-card/95 backdrop-blur-xl shadow-xl overflow-hidden
            ">
              {[
                { type: "chat" as const, icon: "💬", label: "New Chat" },
                { type: "group" as const, icon: "👥", label: "New Group" },
                { type: "join" as const, icon: "🔗", label: "Join Group" },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => openModal(item.type)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-nexus-text/80 hover:bg-nexus-primary/10 hover:text-nexus-primary transition-colors"
                >
                  <span>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Invite Code (share) */}
        {activeGroupId && !activeGroupId.startsWith("personal") && (() => {
          const group = groups.find((g) => g.id === activeGroupId)
          const inviteCode = group?.invite_code
          if (!inviteCode) return null
          return (
            <div className="mt-4 mx-1 p-2.5 rounded-lg bg-nexus-card/40 border border-nexus-border/30">
              <p className="text-[9px] uppercase tracking-wider text-nexus-muted/60 font-semibold mb-1">
                Invite Code (click to copy)
              </p>
              <p
                className="text-sm font-mono font-bold text-nexus-primary/80 hover:text-nexus-primary transition-colors cursor-pointer select-all tracking-widest"
                onClick={() => navigator.clipboard.writeText(inviteCode)}
              >
                {inviteCode}
              </p>
            </div>
          )
        })()}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-2.5 border-t border-nexus-border/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/settings")}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs text-nexus-muted hover:bg-nexus-hover hover:text-nexus-text transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
          <button
            onClick={() => { logout(); navigate("/login") }}
            className="flex items-center justify-center p-2 rounded-lg text-nexus-muted hover:bg-red-500/10 hover:text-red-400 transition-all"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={!!modalType}
        onClose={() => setModalType(null)}
        title={
          modalType === "group" ? "Create New Group" :
          modalType === "chat" ? "Create New Chat" :
          modalType === "join" ? "Join Group" : ""
        }
      >
        <div className="flex flex-col gap-4">
          {modalType === "join" && (
            <p className="text-sm text-nexus-muted">Enter the invite code shared by the group admin (e.g. NX7K-Q2R9).</p>
          )}
          <input
            autoFocus
            type="text"
            className="w-full rounded-xl bg-nexus-bg border border-nexus-border px-4 py-3 text-nexus-text text-sm focus:border-nexus-primary/50 focus:outline-none focus:ring-[3px] focus:ring-nexus-primary/10 transition-all"
            placeholder={
              modalType === "group" ? "Group Name..." :
              modalType === "chat" ? "Chat Title..." : "Invite Code (e.g. NX7K-Q2R9)"
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleModalSubmit()}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setModalType(null)}
              className="px-4 py-2 rounded-xl text-sm text-nexus-muted hover:bg-nexus-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleModalSubmit}
              className="px-4 py-2 rounded-xl text-sm bg-nexus-primary text-white hover:brightness-110 transition-all font-medium"
            >
              {modalType === "join" ? "Join" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
