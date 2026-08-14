import { useEffect, useRef, memo } from "react"
import MessageBubble from "./MessageBubble"
import { MessageSquare, Sparkles } from "lucide-react"
import type { Message } from "../types"

type Props = {
  messages: Message[]
  isTyping: boolean
  streamingMessageId: string | null
  userEmail: string
  userImage: string | null
  onReply: (message: Message) => void
  onDelete: (messageId: string, type: "everyone" | "me") => void
  onEdit: (messageId: string, content: string) => void
  onReact: (messageId: string, emoji: string) => void
  onOpenThread: (message: Message) => void
}

function MessageSkeleton() {
  return (
    <div className="flex gap-3 px-5 py-2">
      <div className="w-8 h-8 rounded-full bg-nexus-surface shrink-0 animate-pulse" />
      <div className="flex flex-col gap-1.5 flex-1 max-w-[55%]">
        <div className="h-3 w-16 bg-nexus-surface rounded animate-pulse" />
        <div className="h-9 w-full bg-nexus-surface rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

const MessageList = memo(function MessageList({
  messages,
  isTyping,
  streamingMessageId,
  userEmail,
  userImage,
  onReply,
  onDelete,
  onEdit,
  onReact,
  onOpenThread,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  return (
    <div
      ref={scrollContainerRef}
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
      className="flex-1 overflow-y-auto px-3 md:px-5 py-4 scrollbar-thin scroll-smooth"
    >
      <div className="flex flex-col gap-0.5 min-h-0">
        {messages.length === 0 && !isTyping && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-nexus-surface/60 flex items-center justify-center border border-nexus-border/30">
              <MessageSquare className="w-7 h-7 text-nexus-muted/50" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-nexus-muted/60 mb-1">No messages yet</h3>
              <p className="text-sm text-nexus-muted/40 max-w-[240px]">
                Start the conversation or ask the AI assistant anything...
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            currentUserId={userEmail}
            currentUserImage={userImage}
            isStreaming={msg.id === streamingMessageId}
            onReply={onReply}
            onDelete={onDelete}
            onEdit={onEdit}
            onReact={(emoji) => onReact(msg.id, emoji)}
            onOpenThread={() => onOpenThread(msg)}
          />
        ))}

        {isTyping && !streamingMessageId && (
          <div className="flex items-center gap-3 pl-12 py-2">
            <div className="flex items-center gap-2 bg-nexus-card/70 backdrop-blur-md px-4 py-2.5 rounded-2xl rounded-tl-sm border border-nexus-border/20">
              <Sparkles className="w-3.5 h-3.5 text-nexus-primary/70 animate-pulse" />
              <span className="text-xs text-nexus-muted/70">Nexus AI is thinking</span>
              <span className="flex items-center gap-1">
                <span
                  className="w-1 h-1 bg-nexus-primary/60 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1 h-1 bg-nexus-primary/60 rounded-full animate-bounce"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="w-1 h-1 bg-nexus-primary/60 rounded-full animate-bounce"
                  style={{ animationDelay: "240ms" }}
                />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  )
})

export { MessageSkeleton }
export default MessageList
