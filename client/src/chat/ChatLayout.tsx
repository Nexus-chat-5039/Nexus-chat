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
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : true)
  const [showGroupDetails, setShowGroupDetails] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
      } else {
        setIsSidebarOpen(true)
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
  const openDetails = useCallback(() => setShowGroupDetails(true), [])
  const closeDetails = useCallback(() => setShowGroupDetails(false), [])

  return (
    <ErrorBoundary>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-nexus-bg text-nexus-text relative isolate">
        {/* Subtle ambient background */}
        <div className="absolute pointer-events-none inset-0 w-full h-full bg-gradient-to-br from-nexus-primary/[0.03] via-transparent to-black/20 z-0" />

        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={toggleSidebar}
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
        <div className="flex flex-1 flex-col min-w-0">
          <ChatHeader
            title={activeChat.title}
            onToggleSidebar={toggleSidebar}
            onOpenDetails={openDetails}
          />

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-nexus-primary border-t-transparent" />
                <p className="text-nexus-muted text-sm">Loading messages…</p>
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
