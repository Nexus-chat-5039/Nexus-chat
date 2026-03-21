import { useEffect, useRef, memo } from "react"
import MessageBubble from "./MessageBubble"
import type { Message } from "../types"

type Props = {
  messages: Message[]
  isTyping: boolean
  userEmail: string
  userImage: string | null
  onReply: (message: Message) => void
  onDelete: (messageId: string, type: "everyone" | "me") => void
  onEdit: (messageId: string, content: string) => void
}

function MessageSkeleton() {
  return (
    <div className="flex gap-2 px-4 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-nexus-surface shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1 max-w-[60%]">
        <div className="h-3 w-20 bg-nexus-surface rounded" />
        <div className="h-4 w-full bg-nexus-surface rounded-lg" />
        <div className="h-4 w-3/4 bg-nexus-surface rounded-lg" />
      </div>
    </div>
  )
}

const MessageList = memo(function MessageList({
  messages,
  isTyping,
  userEmail,
  userImage,
  onReply,
  onDelete,
  onEdit,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 scrollbar-thin">
      <div className="flex flex-col gap-1">
        {messages.length === 0 && !isTyping && (
          <div className="mt-20 flex flex-col items-center gap-5 text-center animate-fadeIn">
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-nexus-primary/20 to-transparent flex items-center justify-center border border-white/5 shadow-2xl">
              <div className="absolute inset-0 bg-nexus-primary/10 blur-xl rounded-full" />
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-nexus-primary relative z-10 drop-shadow-md">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-white to-nexus-muted bg-clip-text text-transparent">No messages yet</h3>
              <p className="text-nexus-muted text-sm max-w-[250px] leading-relaxed">Start the conversation or ask Nexus AI anything…</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            currentUserId={userEmail}
            currentUserImage={userImage}
            onReply={onReply}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}

        {isTyping && (
          <div className="flex items-center gap-3 pl-10 py-2 animate-fadeIn">
            <div className="flex items-center gap-2 bg-nexus-card/80 backdrop-blur-md px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5 shadow-sm">
              <span className="w-2 h-2 bg-nexus-primary/80 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-nexus-primary/80 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-nexus-primary/80 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
})

export { MessageSkeleton }
export default MessageList
