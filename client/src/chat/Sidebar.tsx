import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
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
    <div className="flex h-full w-[85vw] max-w-[320px] md:w-72 flex-col border-r border-nexus-border/40 bg-nexus-sidebar/90 backdrop-blur-xl shadow-2xl relative z-40">
      {/* Header */}
      <div className="px-5 py-6 border-b border-nexus-border/40 bg-gradient-to-b from-white/[0.02] to-transparent">
        <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white/90 to-nexus-muted bg-clip-text text-transparent drop-shadow-sm">Workspaces</h1>
      </div>

      {/* Groups & Chats */}
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-widest text-nexus-muted">
          Groups
        </h2>

        {groups.map((group) => {
          const isPersonal = group.id.startsWith("personal_")
          const isOwner = group.user_id === userEmail

          return (
            <div key={group.id} className="mb-2">
              {/* Group name */}
              <div
                className={`
                  flex items-center justify-between group/item rounded-xl p-2.5 mb-0.5 cursor-pointer
                  transition-all duration-300 ease-out hover:-translate-y-[1px]
                  ${group.id === activeGroupId
                    ? "bg-nexus-primary/10 border border-nexus-primary/30 shadow-sm shadow-nexus-primary/10"
                    : "hover:bg-nexus-card hover:shadow-sm border border-transparent"
                  }
                `}
                onClick={() => onSelectGroup(group.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                    ${group.id === activeGroupId
                      ? "bg-nexus-primary/20 text-nexus-primary"
                      : "bg-nexus-surface text-nexus-muted"
                    }
                  `}>
                    {isPersonal ? "👤" : group.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`text-sm font-medium truncate transition-colors
                    ${group.id === activeGroupId ? "text-nexus-primary" : "text-nexus-text"}
                  `}>
                    {group.name}
                  </span>
                </div>
                {isOwner && !isPersonal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteGroup(group.id)
                    }}
                    className="opacity-0 group-hover/item:opacity-100 text-red-400 hover:text-red-500 p-1 rounded-md hover:bg-red-500/10 transition-all"
                    title="Delete Group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Chats inside active group */}
              {group.id === activeGroupId && (
                <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-nexus-border/50 pl-3">
                  {group.chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => onSelectChat(chat.id)}
                      className={`
                        flex items-center justify-between cursor-pointer rounded-lg px-3 py-2 text-sm
                        transition-all duration-150 group/chat
                        ${chat.id === activeChatId
                          ? "bg-nexus-card border border-nexus-border text-white shadow-sm"
                          : "text-nexus-muted hover:bg-nexus-card/50 hover:text-nexus-text border border-transparent"
                        }
                      `}
                    >
                      <span className="truncate font-medium flex items-center gap-2">
                        <span className="text-xs opacity-50">#</span>
                        {chat.title}
                      </span>
                      {(isOwner || isPersonal) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteChat(group.id, chat.id)
                          }}
                          className="opacity-0 group-hover/chat:opacity-100 text-xs text-red-400 hover:text-red-500 px-1 transition-all"
                          title="Delete Chat"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* + New (Chat / Group / Join) */}
        <div className="relative mt-4">
          <button
            onClick={() => setShowCreateMenu((prev) => !prev)}
            className="
              flex w-full items-center justify-center gap-2
              rounded-xl bg-gradient-to-r from-nexus-primary/90 to-nexus-primary
              py-2.5 text-sm font-medium text-white shadow-lg shadow-nexus-primary/20
              hover:shadow-nexus-primary/30 hover:brightness-110 active:scale-[0.98]
              transition-all duration-200 border border-white/10
            "
          >
            <span className="text-lg leading-none">+</span>
            New
          </button>

          {showCreateMenu && (
            <div className="
              absolute left-0 right-0 top-full z-10 mt-2
              rounded-xl border border-white/10
              bg-nexus-card/80 backdrop-blur-2xl shadow-2xl shadow-black/50
              overflow-hidden animate-slideDown ring-1 ring-white/5
            ">
              {[
                { type: "chat" as const, icon: "💬", label: "New Chat" },
                { type: "group" as const, icon: "👥", label: "New Group" },
                { type: "join" as const, icon: "🔗", label: "Join Group" },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => openModal(item.type)}
                  className="
                    flex w-full items-center gap-3 px-4 py-3 text-sm text-nexus-text
                    hover:bg-nexus-primary/10 hover:text-nexus-primary transition-colors
                  "
                >
                  <span>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Group ID Display */}
        {activeGroupId && !activeGroupId.startsWith("personal") && (
          <div className="mt-4 p-3 rounded-xl bg-nexus-card/50 border border-nexus-border/50">
            <p className="text-[10px] uppercase tracking-wider text-nexus-muted font-semibold mb-1">
              Group ID (Share to invite)
            </p>
            <p
              className="text-xs font-mono select-all cursor-pointer text-nexus-text/70 hover:text-nexus-primary transition-colors truncate"
              onClick={() => navigator.clipboard.writeText(activeGroupId)}
              title="Click to copy"
            >
              {activeGroupId}
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-nexus-border/50">
        <button
          onClick={() => navigate("/settings")}
          className="
            w-full rounded-xl py-2.5 text-sm text-nexus-muted
            hover:bg-nexus-card hover:text-nexus-text
            transition-all duration-200
            flex items-center justify-center gap-2
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Settings
        </button>
      </div>

      {/* MODAL */}
      <Modal
        isOpen={!!modalType}
        onClose={() => setModalType(null)}
        title={
          modalType === "group"
            ? "Create New Group"
            : modalType === "chat"
            ? "Create New Chat"
            : modalType === "join"
            ? "Join Group"
            : ""
        }
      >
        <div className="flex flex-col gap-4">
          {modalType === "join" && (
            <p className="text-sm text-nexus-muted">
              Enter the unique Group ID shared by the admin.
            </p>
          )}

          <input
            autoFocus
            type="text"
            className="w-full rounded-xl bg-nexus-bg border border-nexus-border px-4 py-3 text-nexus-text text-sm focus:border-nexus-primary focus:outline-none focus:ring-1 focus:ring-nexus-primary/20 transition-all"
            placeholder={
              modalType === "group"
                ? "Group Name..."
                : modalType === "chat"
                ? "Chat Title..."
                : "Group ID..."
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
