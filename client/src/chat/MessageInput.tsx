import { useState, useCallback, useRef, useEffect } from "react"
import { Sparkles, Send, X } from "lucide-react"
import type { Message } from "../types"

type Props = {
  onSend: (text: string, triggerAi?: boolean) => void
  disabled?: boolean
  replyingTo?: Message | null
  onCancelReply?: () => void
}

export default function MessageInput({ onSend, disabled, replyingTo, onCancelReply }: Props) {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 150) + "px"
    }
  }, [text])

  // Focus when replying
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus()
  }, [replyingTo])

  const handleSend = useCallback(
    (triggerAi: boolean) => {
      if (!text.trim() || disabled) return
      onSend(text, triggerAi)
      setText("")
    },
    [text, disabled, onSend]
  )

  return (
    <div className="border-t border-white/5 bg-nexus-bg/70 backdrop-blur-2xl p-2 pb-3 md:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] relative z-20">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-nexus-card border border-nexus-primary/20 p-2.5 pl-3.5 relative overflow-hidden animate-slideDown">
          <div className="w-0.5 absolute left-0 top-0 bottom-0 bg-nexus-primary rounded-full" />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-xs font-bold text-nexus-primary">
              Replying to {replyingTo.sender_name || replyingTo.sender}
            </span>
            <span className="text-xs text-nexus-muted truncate">
              {replyingTo.content}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 p-1 hover:bg-white/5 rounded-full text-nexus-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          disabled={disabled}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend(false)
            }
          }}
          placeholder={disabled ? "Nexus AI is replying…" : "Type a message..."}
          className="
            flex-1 resize-none rounded-2xl px-3 py-2.5 md:px-4 md:py-3 text-[15px] sm:text-sm
            bg-nexus-card/80 backdrop-blur-sm text-white
            placeholder:text-nexus-muted
            outline-none border border-white/10 shadow-inner
            focus:border-nexus-primary/60 focus:ring-2 focus:ring-nexus-primary/20 focus:bg-nexus-card
            disabled:opacity-50
            transition-all duration-300
            scrollbar-thin
          "
        />

        {/* AI Button */}
        <button
          onClick={() => handleSend(true)}
          disabled={disabled || !text.trim()}
          className="
            flex items-center gap-2 rounded-2xl border border-nexus-primary/30 bg-nexus-primary/10 px-3 py-2.5 md:px-4 md:py-3
            text-sm font-medium text-nexus-primary
            hover:bg-nexus-primary/20 hover:border-nexus-primary/50
            active:scale-95 transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
          "
          title="Send and ask AI"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        {/* Send Button */}
        <button
          onClick={() => handleSend(false)}
          disabled={disabled || !text.trim()}
          className="
            rounded-2xl bg-gradient-to-r from-nexus-primary to-rose-600 px-4 py-2.5 md:px-5 md:py-3
            text-sm font-medium text-white shadow-lg shadow-nexus-primary/20
            hover:shadow-nexus-primary/40 hover:brightness-110 active:scale-[0.98]
            transition-all duration-300
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
