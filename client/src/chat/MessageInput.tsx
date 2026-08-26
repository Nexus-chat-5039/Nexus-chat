import { useState, useCallback, useRef, useEffect } from "react"
import { Sparkles, Send, X } from "lucide-react"
import SlashCommandMenu, { getFilteredCommands, type SlashCommand } from "./SlashCommandMenu"
import type { Message } from "../types"

type Props = {
  onSend: (text: string, triggerAi?: boolean) => void
  disabled?: boolean
  replyingTo?: Message | null
  onCancelReply?: () => void
}

export default function MessageInput({ onSend, disabled, replyingTo, onCancelReply }: Props) {
  const [text, setText] = useState("")
  const [slashIndex, setSlashIndex] = useState(0)
  const [helpVisible, setHelpVisible] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Derived slash command state
  const isSlashCommand = text.startsWith("/") && text.indexOf(" ") === -1
  const slashFilter = isSlashCommand ? text.slice(1) : ""
  const slashActive = isSlashCommand

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
      if (!text.trim()) return
      if (triggerAi && disabled) return
      onSend(text, triggerAi)
      setText("")
      setHelpVisible(false)
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    },
    [text, disabled, onSend]
  )

  const handleSlashSelect = useCallback(
    (command: SlashCommand) => {
      if (command.action === "local") {
        // /help — show inline help card
        setHelpVisible(true)
        setText("")
        return
      }

      if (command.template) {
        if (command.template.includes("{input}")) {
          // Commands that need user input (explain, code, translate, goal)
          // Set the command prefix so user can continue typing
          setText((command.command.startsWith("/") ? command.command : "/" + command.command) + " ")
          textareaRef.current?.focus()
        } else {
          // Commands that fire immediately (summarize)
          onSend(command.template, true)
          setText("")
        }
      }
    },
    [onSend]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashActive) {
        const filtered = getFilteredCommands(slashFilter)
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSlashIndex((prev) => Math.min(prev + 1, filtered.length - 1))
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setSlashIndex((prev) => Math.max(prev - 1, 0))
          return
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault()
          if (filtered[slashIndex]) {
            handleSlashSelect(filtered[slashIndex])
          }
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          setText("")
          return
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        // If text starts with a slash command that needs input, send as AI
        if (text.startsWith("/")) {
          const parts = text.split(" ")
          const rawCmd = parts[0].toLowerCase()
          const cmdWithSlash = rawCmd.startsWith("/") ? rawCmd : "/" + rawCmd
          const cmdWithoutSlash = rawCmd.startsWith("/") ? rawCmd.slice(1) : rawCmd
          const userInput = parts.slice(1).join(" ").trim()
          const allCommands = getFilteredCommands("")
          const matched = allCommands.find((c) => c.command.toLowerCase() === cmdWithSlash || c.command.toLowerCase() === cmdWithoutSlash)

          if (matched && matched.action === "ai" && matched.template && userInput) {
            const prompt = matched.template.replace("{input}", userInput)
            onSend(prompt, true)
            setText("")
            if (textareaRef.current) textareaRef.current.style.height = "auto"
            return
          }
        }
        handleSend(false)
      }
    },
    [slashActive, slashFilter, slashIndex, handleSlashSelect, text, onSend, handleSend]
  )

  return (
    <div className="shrink-0 border-t border-nexus-border bg-nexus-header/90 backdrop-blur-2xl p-3 md:p-4 z-20">
      {/* Help card */}
      {helpVisible && (
        <div className="mb-3 rounded-xl bg-nexus-card backdrop-blur-xl border border-nexus-border p-4 shadow-md animate-[slideDown_0.2s_ease-out]">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold text-nexus-text/90 uppercase tracking-wider">Available Commands</h4>
            <button
              type="button"
              onClick={() => setHelpVisible(false)}
              aria-label="Close help"
              className="p-1 hover:bg-nexus-hover rounded-full text-nexus-muted hover:text-nexus-text transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {getFilteredCommands("").filter((c) => c.action === "ai").map((cmd) => (
              <div key={cmd.command} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-nexus-surface/50">
                <span className="text-nexus-primary/70">{cmd.icon}</span>
                <div>
                  <span className="text-xs font-mono font-semibold text-nexus-text/80">{cmd.command.startsWith("/") ? cmd.command : "/" + cmd.command}</span>
                  <span className="text-[10px] text-nexus-muted/60 ml-1.5">{cmd.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-nexus-card border border-nexus-primary/20 p-2 pl-3 relative overflow-hidden shadow-sm animate-[slideDown_0.2s_ease-out]">
          <div className="w-0.5 absolute left-0 top-0 bottom-0 bg-nexus-primary/60 rounded-full" />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-nexus-primary">
              Replying to {replyingTo.sender_name || replyingTo.sender}
            </span>
            <span className="text-[11px] text-nexus-muted truncate">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-nexus-hover rounded-full text-nexus-muted hover:text-nexus-text transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* Slash command menu */}
        <SlashCommandMenu
          filter={slashFilter}
          activeIndex={slashIndex}
          onSelect={handleSlashSelect}
          onClose={() => setText("")}
          visible={slashActive}
        />

        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          aria-label="Type a message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (/ for commands)"
          className="
            flex-1 resize-none rounded-xl px-4 py-2.5 text-sm
            bg-nexus-card text-nexus-text
            placeholder:text-nexus-muted/60
            outline-none border border-nexus-border
            focus:border-nexus-primary/50 focus:ring-[3px] focus:ring-nexus-primary/10
            shadow-sm
            transition-all duration-200
            leading-5
          "
        />

        {/* AI Button */}
        <button
          type="button"
          onClick={() => handleSend(true)}
          disabled={disabled || !text.trim()}
          aria-label="Ask AI assistant"
          className="
            flex items-center justify-center gap-1.5 rounded-xl border border-nexus-primary/25
            bg-nexus-primary/8 min-h-[44px] px-3 py-2.5
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
          type="button"
          onClick={() => handleSend(false)}
          disabled={!text.trim()}
          aria-label="Send message"
          className="
            rounded-xl bg-nexus-primary min-h-[44px] min-w-[44px] flex items-center justify-center px-3.5 py-2.5
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
    </div>
  )
}
