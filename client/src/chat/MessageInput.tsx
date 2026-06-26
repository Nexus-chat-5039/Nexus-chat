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
      el.style.height = Math.min(el.scrollHeight, 120) + "px"
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
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    },
    [text, disabled, onSend]
  )

  return (
    <div className="shrink-0 border-t border-nexus-border/20 bg-nexus-bg/80 backdrop-blur-2xl p-3 md:p-4 z-20">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-nexus-card/70 border border-nexus-primary/15 p-2 pl-3 relative overflow-hidden animate-[slideDown_0.2s_ease-out]">
          <div className="w-0.5 absolute left-0 top-0 bottom-0 bg-nexus-primary/40 rounded-full" />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-nexus-primary/80">
              Replying to {replyingTo.sender_name || replyingTo.sender}
            </span>
            <span className="text-[11px] text-nexus-muted truncate">{replyingTo.content}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 p-1 hover:bg-white/5 rounded-full text-nexus-muted hover:text-nexus-text transition-colors"
          >
            <X size={14} />
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
          placeholder={disabled ? "AI is thinking..." : "Type a message..."}
          className="
            flex-1 resize-none rounded-xl px-4 py-2.5 text-sm
            bg-nexus-card/70 text-nexus-text
            placeholder:text-nexus-muted/50
            outline-none border border-nexus-border/40
            focus:border-nexus-primary/40 focus:ring-[3px] focus:ring-nexus-primary/8
            focus:bg-nexus-card
            disabled:opacity-40
            transition-all duration-200
            leading-5
          "
        />

        {/* AI Button */}
        <button
          onClick={() => handleSend(true)}
          disabled={disabled || !text.trim()}
          className="
            flex items-center gap-1.5 rounded-xl border border-nexus-primary/25
            bg-nexus-primary/8 px-3 py-2.5
            text-xs font-medium text-nexus-primary/80
            hover:bg-nexus-primary/15 hover:border-nexus-primary/40
            active:scale-95 transition-all duration-150
            disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100
          "
          title="Ask AI"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI</span>
        </button>

        {/* Send Button */}
        <button
          onClick={() => handleSend(false)}
          disabled={disabled || !text.trim()}
          className="
            rounded-xl bg-nexus-primary px-3.5 py-2.5
            text-white shadow-md shadow-nexus-primary/15
            hover:shadow-lg hover:shadow-nexus-primary/25 hover:brightness-110
            active:scale-[0.95] active:duration-100
            transition-all duration-200
            disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100
            disabled:shadow-none
          "
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
