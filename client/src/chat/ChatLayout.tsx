import { useState, useCallback, useEffect } from "react"
import Sidebar from "./Sidebar"
import ChatHeader from "./ChatHeader"
import MessageList from "./MessageList"
import MessageInput from "./MessageInput"
import { useWorkspace } from "../context/WorkspaceContext"
import { ErrorBoundary } from "../components/ErrorBoundary"
import GroupDetailsModal from "../components/GroupDetailsModal"
import type { Message } from "../types"

export default function ChatLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 768 : true
  )
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [showGroupDetails, setShowGroupDetails] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
        setIsInfoOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleMobileAction = useCallback(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }, [])

  const {
    groups,
    activeChat,
    activeGroup,
    activeGroupId,
    activeChatId,
    setActiveGroupId,
    setActiveChatId,
    isTyping,
    isLoading,
    sendMessage,
    createGroup,
    createChat,
    joinGroup,
    userEmail,
    deleteGroup,
    deleteChat,
    leaveGroup,
    removeMember,
    profileImage,
    deleteMessage,
    editMessage,
  } = useWorkspace()

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message)
  }, [])

  const cancelReply = useCallback(() => {
    setReplyingTo(null)
  }, [])

  const handleSend = useCallback(
    (text: string, triggerAi: boolean) => {
      sendMessage(
        text,
        triggerAi,
        replyingTo
          ? {
              id: replyingTo.id,
              sender: replyingTo.sender_name || replyingTo.sender || "",
              content: replyingTo.content,
            }
          : undefined
      )
      setReplyingTo(null)
    },
    [sendMessage, replyingTo]
  )

  const toggleSidebar = useCallback(() => setIsSidebarOpen((p) => !p), [])
  const toggleInfo = useCallback(() => setIsInfoOpen((p) => !p), [])
  const openDetails = useCallback(() => setShowGroupDetails(true), [])
  const closeDetails = useCallback(() => setShowGroupDetails(false), [])

  return (
    <ErrorBoundary>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-nexus-bg text-nexus-text relative isolate">
        {/* Ambient gradient */}
        <div className="absolute pointer-events-none inset-0 w-full h-full bg-gradient-to-br from-nexus-primary/[0.02] via-transparent to-black/20 z-0" />

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300"
            onClick={toggleSidebar}
          />
        )}

        {/* Mobile info overlay */}
        {isInfoOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300"
            onClick={toggleInfo}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
            fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-out
            md:relative md:translate-x-0
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <Sidebar
            groups={groups}
            activeGroupId={activeGroupId}
            activeChatId={activeChatId}
            onSelectGroup={(id) => { setActiveGroupId(id); handleMobileAction() }}
            onSelectChat={(id) => { setActiveChatId(id); handleMobileAction() }}
            onNewGroup={(name) => { createGroup(name); handleMobileAction() }}
            onNewChat={(title) => { createChat(title); handleMobileAction() }}
            onJoinGroup={(id) => { joinGroup(id); handleMobileAction() }}
            onDeleteGroup={deleteGroup}
            onDeleteChat={deleteChat}
            userEmail={userEmail}
          />
        </div>

        {/* Main chat area */}
        <div className="flex flex-1 flex-col min-w-0 relative z-10">
          <ChatHeader
            title={activeChat.title}
            groupName={activeGroup?.name || ""}
            onToggleSidebar={toggleSidebar}
            onToggleInfo={toggleInfo}
            onOpenDetails={openDetails}
          />

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-nexus-primary border-t-transparent" />
                <p className="text-nexus-muted text-sm">Loading messages...</p>
              </div>
            </div>
          ) : (
            <MessageList
              messages={activeChat.messages}
              isTyping={isTyping}
              userEmail={userEmail}
              userImage={profileImage}
              onReply={handleReply}
              onDelete={deleteMessage}
              onEdit={editMessage}
            />
          )}

          <MessageInput
            onSend={handleSend}
            disabled={isTyping}
            replyingTo={replyingTo}
            onCancelReply={cancelReply}
          />
        </div>

        {/* Info Panel (right sidebar) - desktop */}
        <div
          className={`
            hidden md:block border-l border-nexus-border/30 bg-nexus-sidebar/60 backdrop-blur-xl
            transition-all duration-300 ease-out overflow-hidden
            ${isInfoOpen ? "w-72 opacity-100" : "w-0 opacity-0"}
          `}
        >
          {isInfoOpen && activeGroup && (
            <div className="w-72 h-full p-5">
              <h3 className="font-semibold text-sm mb-4">{activeGroup.name}</h3>
              <p className="text-xs text-nexus-muted mb-4">
                {activeGroup.members.length} member{activeGroup.members.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-nexus-muted">Members</p>
                {activeGroup.members.map((m) => (
                  <div key={m} className="flex items-center gap-2.5 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nexus-primary/30 to-purple-500/20 flex items-center justify-center text-[10px] font-bold text-nexus-text/70">
                      {m.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm text-nexus-text/80 truncate">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Panel - mobile bottom sheet */}
        <div
          className={`
            md:hidden fixed bottom-0 left-0 right-0 z-40 bg-nexus-card/95 backdrop-blur-xl
            rounded-t-2xl border-t border-nexus-border/50 shadow-2xl
            transition-transform duration-300 ease-out max-h-[70vh] overflow-y-auto
            ${isInfoOpen ? "translate-y-0" : "translate-y-full"}
          `}
        >
          <div className="w-10 h-1 bg-nexus-border rounded-full mx-auto my-3" />
          {activeGroup && (
            <div className="px-5 pb-6">
              <h3 className="font-semibold mb-1">{activeGroup.name}</h3>
              <p className="text-xs text-nexus-muted mb-4">
                {activeGroup.members.length} member{activeGroup.members.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {activeGroup.members.map((m) => (
                  <div key={m} className="flex items-center gap-2.5 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-primary/30 to-purple-500/20 flex items-center justify-center text-xs font-bold text-nexus-text/70">
                      {m.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm text-nexus-text/80 truncate">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Group Details Modal */}
        {activeGroup && (
          <GroupDetailsModal
            isOpen={showGroupDetails}
            onClose={closeDetails}
            group={activeGroup}
            currentUserEmail={userEmail}
            onLeave={leaveGroup}
            onRemoveMember={removeMember}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
