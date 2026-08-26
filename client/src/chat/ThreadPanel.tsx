import { memo, useState, useRef, useEffect, useCallback } from "react"
import { X, Send } from "lucide-react"
import { cn } from "../lib/utils"
import { getImageUrl } from "../api/config"
import type { Message } from "../types"

export type ThreadPanelProps = {
  parentMessage: Message
  threadMessages: Message[]
  currentUserEmail: string
  currentUserImage?: string | null
  onSendReply: (content: string) => void
  onClose: () => void
  isLoading?: boolean
}

export const ThreadPanel = memo(
  ({
    parentMessage,
    threadMessages,
    currentUserEmail,
    onSendReply,
    onClose,
    isLoading = false,
  }: ThreadPanelProps) => {
    const [replyText, setReplyText] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const scrollToBottom = useCallback(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, [])

    useEffect(() => {
      scrollToBottom()
    }, [threadMessages, isLoading, scrollToBottom])

    const handleSend = useCallback(() => {
      if (!replyText.trim()) return
      onSendReply(replyText.trim())
      setReplyText("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }, [replyText, onSendReply])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          handleSend()
        }
      },
      [handleSend]
    )

    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setReplyText(e.target.value)
      e.target.style.height = "auto"
      e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`
    }, [])

    const formatTime = (isoString?: string) => {
      if (!isoString) return ""
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }

    const parentSenderName = parentMessage.sender === currentUserEmail
      ? "You"
      : parentMessage.sender_name || parentMessage.sender || "User"

    return (
      <div
        className="flex flex-col h-full w-full md:w-80 bg-nexus-sidebar/80 backdrop-blur-xl"
        style={{ animation: "slideInRight 0.2s ease-out forwards" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-nexus-border/30 shrink-0">
          <h2 className="text-sm font-bold text-nexus-text">Thread</h2>
          <button
            type="button"
            aria-label="Close thread panel"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Parent Message Preview */}
        <div className="px-4 py-3 bg-nexus-surface/30 border-b border-nexus-border/30 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-nexus-text">
              {parentSenderName}
            </span>
            <span className="text-[10px] text-nexus-muted">
              {formatTime(parentMessage.created_at)}
            </span>
          </div>
          <p className="text-xs text-nexus-text/80 line-clamp-3">
            {parentMessage.content}
          </p>
        </div>

        {/* Thread Messages */}
        <div
          ref={scrollRef}
          role="log"
          aria-label="Thread messages"
          className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3"
        >
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-nexus-surface/60 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-nexus-surface/60 rounded w-1/3" />
                    <div className="h-4 bg-nexus-surface/60 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-nexus-muted text-center">
                No replies yet. Start the conversation!
              </p>
            </div>
          ) : (
            threadMessages.map((msg) => {
              const isMe = msg.sender === currentUserEmail
              const displayName = isMe ? "You" : msg.sender_name || msg.sender || "User"
              const initial = displayName.charAt(0).toUpperCase()

              return (
                <div key={msg.id} className="flex gap-2 group">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-nexus-surface flex items-center justify-center overflow-hidden shrink-0 border border-white/[0.04]">
                    {msg.sender_image ? (
                      <img
                        src={getImageUrl(msg.sender_image)}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold text-nexus-muted">
                        {initial}
                      </span>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span
                        className={cn(
                          "text-xs font-medium truncate",
                          isMe ? "text-nexus-primary/80" : "text-nexus-text"
                        )}
                      >
                        {displayName}
                      </span>
                      <span className="text-[10px] text-nexus-muted shrink-0">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <div className="text-xs text-nexus-text/90 break-words leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Reply Input */}
        <div className="shrink-0 border-t border-nexus-border/30 p-3 bg-nexus-sidebar">
          <div className="flex items-end gap-2 bg-nexus-surface rounded-xl border border-nexus-border/50 p-2 focus-within:border-nexus-primary/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Reply in thread..."
              aria-label="Reply in thread"
              className="flex-1 max-h-[80px] bg-transparent text-xs text-nexus-text placeholder:text-nexus-muted/50 resize-none focus:outline-none scrollbar-thin py-1"
              rows={1}
            />
            <button
              type="button"
              aria-label="Send thread reply"
              onClick={handleSend}
              disabled={!replyText.trim()}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-nexus-primary text-white hover:bg-nexus-primary-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 mb-0.5"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }
)

ThreadPanel.displayName = "ThreadPanel"

export default ThreadPanel
