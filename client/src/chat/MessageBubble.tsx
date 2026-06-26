import { memo, useState, useMemo, useCallback, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { getImageUrl } from "../api/config"
import { Reply, Pencil, Trash2, Check, X } from "lucide-react"
import type { Message } from "../types"

const COLORS = [
  "#e542a3", "#02a698", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5",
  "#2196f3", "#00bcd4", "#009688", "#4caf50", "#8bc34a", "#cddc39",
  "#ffeb3b", "#ffc107", "#ff9800", "#ff5722", "#795548", "#607d8b",
]

function getSenderColor(sender?: string) {
  if (!sender) return "#34b7f1"
  let hash = 0
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash % COLORS.length)]
}

const CodeBlockHeader = memo(function CodeBlockHeader({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="bg-[#1a1a2e] px-4 py-1.5 text-[11px] text-nexus-muted/60 border-b border-white/[0.04] flex justify-between items-center select-none rounded-t-lg">
      <span className="lowercase font-mono">{language}</span>
      <button
        onClick={handleCopy}
        className="hover:text-nexus-text transition-colors px-2 py-0.5 rounded hover:bg-white/5"
      >
        {copied ? <span className="text-emerald-400">Copied</span> : "Copy"}
      </button>
    </div>
  )
})

type Props = {
  message: Message
  currentUserId: string
  currentUserImage?: string | null
  onReply?: (message: Message) => void
  onDelete: (messageId: string, type: "everyone" | "me") => void
  onEdit?: (messageId: string, content: string) => void
}

const MessageBubble = memo(function MessageBubble({
  message,
  currentUserId,
  onReply,
  onDelete,
  onEdit,
}: Props) {
  const isMe = message.role === "user" && message.sender === currentUserId
  const isOtherUser = message.role === "user" && !isMe
  const isAI = message.role === "assistant"

  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [entranceDone, setEntranceDone] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const senderColor = useMemo(() => getSenderColor(message.sender), [message.sender])

  // Entrance animation
  useEffect(() => {
    if (entranceDone || !bubbleRef.current) return
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setEntranceDone(true)
      return
    }
    // Use CSS animation for entrance
    bubbleRef.current.style.animation = "msgEnter 0.25s ease-out forwards"
    const timer = setTimeout(() => setEntranceDone(true), 250)
    return () => clearTimeout(timer)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(message.id, editContent)
    }
    setIsEditing(false)
  }, [onEdit, editContent, message.content, message.id])

  if (message.is_deleted) {
    return (
      <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"} mb-2 px-1`}>
        <div className="rounded-2xl px-4 py-2 bg-nexus-card/40 border border-nexus-border/20 text-nexus-muted/50 text-xs italic">
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            This message was deleted
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={bubbleRef}
      className={`group relative flex w-full mb-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}
      id={"msg_" + message.id}
      style={{ opacity: entranceDone ? 1 : 0, transform: entranceDone ? "none" : "translateY(10px)" }}
    >
      <div className={`flex max-w-[88%] md:max-w-[75%] gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
        {/* Avatar */}
        {!isMe && (
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-nexus-surface overflow-hidden flex items-center justify-center border border-white/[0.04] mt-0.5 self-end">
            {message.sender_image ? (
              <img src={getImageUrl(message.sender_image)} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-[10px] text-nexus-muted/70 font-bold uppercase">
                {(message.sender_name || message.sender || "?")[0]}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`
            relative px-3.5 py-2 rounded-2xl shadow-sm
            ${isMe
              ? "bg-nexus-primary/90 text-white rounded-br-sm"
              : isAI
              ? "bg-gradient-to-br from-nexus-surface to-nexus-card/80 text-nexus-text rounded-bl-sm border border-nexus-primary/10"
              : "bg-nexus-surface text-nexus-text rounded-bl-sm border border-white/[0.04]"
            }
          `}
        >
          {/* Context menu */}
          <div className={`
            absolute top-0.5 ${isMe ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"}
            flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150
          `}>
            <button
              onClick={() => { setShowMenu(!showMenu); setShowDeleteOptions(false) }}
              className="p-1 text-nexus-muted/60 hover:text-nexus-text hover:bg-nexus-surface rounded-md transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute top-7 z-20 w-32 rounded-xl border border-nexus-border/50 bg-nexus-card/95 backdrop-blur-xl shadow-xl py-1 overflow-hidden"
                style={{ [isMe ? "right" : "left"]: 0 }}
              >
                {!showDeleteOptions ? (
                  <>
                    <button
                      onClick={() => { onReply?.(message); setShowMenu(false) }}
                      className="w-full text-left px-3 py-1.5 text-xs text-nexus-text/80 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Reply size={12} /> Reply
                    </button>
                    {isMe && (
                      <button
                        onClick={() => { setIsEditing(true); setShowMenu(false) }}
                        className="w-full text-left px-3 py-1.5 text-xs text-nexus-text/80 hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                    <div className="h-px bg-nexus-border/30 my-0.5" />
                    <button
                      onClick={() => setShowDeleteOptions(true)}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-1 text-[9px] text-nexus-muted uppercase font-bold tracking-wider">Delete?</div>
                    <button
                      onClick={() => { onDelete(message.id, "me"); setShowMenu(false); setShowDeleteOptions(false) }}
                      className="w-full text-left px-3 py-1.5 text-xs text-nexus-text/80 hover:bg-white/5 transition-colors"
                    >
                      For Me
                    </button>
                    {isMe && (
                      <button
                        onClick={() => { onDelete(message.id, "everyone"); setShowMenu(false); setShowDeleteOptions(false) }}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 transition-colors"
                      >
                        For Everyone
                      </button>
                    )}
                    <div className="h-px bg-nexus-border/30 my-0.5" />
                    <button
                      onClick={() => setShowDeleteOptions(false)}
                      className="w-full text-left px-3 py-1 text-[10px] text-nexus-muted hover:text-nexus-text transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sender name */}
          {isOtherUser && message.sender_name && (
            <p className="text-[11px] font-semibold mb-0.5" style={{ color: senderColor }}>
              {message.sender_name}
            </p>
          )}

          {/* Reply reference */}
          {message.replyTo && (
            <div
              className="mb-1.5 pl-2 border-l-2 border-nexus-primary/40 bg-black/10 rounded-r-md py-1 pr-2 cursor-pointer hover:bg-black/15 transition-colors"
              onClick={() => document.getElementById("msg_" + message.replyTo?.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <p className="text-[10px] font-semibold text-nexus-primary/80">{message.replyTo.sender}</p>
              <p className="text-[11px] text-nexus-muted truncate">{message.replyTo.content}</p>
            </div>
          )}

          {/* Content */}
          <div className="text-[14px] leading-relaxed whitespace-pre-wrap">
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[200px]">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="bg-black/20 text-white rounded-lg p-2 text-sm w-full outline-none border border-white/10 resize-none min-h-[60px] focus:border-nexus-primary/50"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="text-[11px] text-nexus-muted hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1">
                    <X size={10} /> Cancel
                  </button>
                  <button onClick={handleSaveEdit} className="text-[11px] bg-emerald-600/80 text-white px-3 py-1 rounded-md font-medium hover:bg-emerald-500 transition-colors flex items-center gap-1">
                    <Check size={10} /> Save
                  </button>
                </div>
              </div>
            ) : isAI ? (
              <div className="prose prose-invert prose-sm max-w-none [&_pre]:m-0 [&_pre]:bg-transparent [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:mb-1.5 [&_ol]:mb-1.5 [&_li]:mb-0.5 [&_code]:text-emerald-300 [&_code]:bg-white/5 [&_code]:px-1 [&_code]:rounded [&_code]:text-[13px]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "")
                      const codeString = String(children).replace(/\n$/, "")
                      return match ? (
                        <div className="rounded-lg overflow-hidden my-2 border border-white/[0.06]">
                          <CodeBlockHeader language={match[1]} code={codeString} />
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: 0, fontSize: "12px", padding: "12px 16px" }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              message.content
            )}
          </div>

          {/* Edited indicator */}
          {message.is_edited && (
            <span className="text-[9px] text-nexus-muted/40 italic mt-0.5 block">edited</span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes msgEnter {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
})

export default MessageBubble
