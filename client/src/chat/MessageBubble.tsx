import { memo, useState, useMemo, useCallback } from "react"
import logo from "../assets/logo.svg"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getImageUrl } from "../api/config"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { motion, useAnimation, type PanInfo } from "framer-motion"
import { Reply } from "lucide-react"
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
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [code])

  return (
    <div className="bg-[#1e1e1e] px-4 py-2 text-xs text-gray-400 border-b border-white/5 flex justify-between items-center select-none rounded-t-lg">
      <span className="lowercase font-mono">{language}</span>
      <button
        onClick={handleCopy}
        className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5"
        aria-label="Copy code to clipboard"
      >
        {isCopied ? (
          <span className="text-emerald-400 font-medium">✓ Copied</span>
        ) : (
          <span>Copy</span>
        )}
      </button>
    </div>
  )
})

const Avatar = memo(function Avatar({ name, image }: { name?: string; image?: string }) {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-nexus-surface overflow-hidden flex items-center justify-center shadow-sm border border-white/5 mt-1 select-none">
      {image ? (
        <img src={image} alt={name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="text-xs text-gray-300 font-bold uppercase">
          {(name || "?")[0]}
        </div>
      )}
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
  currentUserImage,
  onReply,
  onDelete,
  onEdit,
}: Props) {
  const isMe = message.role === "user" && message.sender === currentUserId
  const isOtherUser = message.role === "user" && !isMe
  const isAI = message.role === "assistant"

  const [showDeleteMenu, setShowDeleteMenu] = useState(false)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const senderColor = useMemo(() => getSenderColor(message.sender), [message.sender])

  const handleSaveEdit = useCallback(() => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(message.id, editContent)
    }
    setIsEditing(false)
  }, [onEdit, editContent, message.content, message.id])

  const controls = useAnimation()

  const handleDragEnd = useCallback(
    async (_: unknown, info: PanInfo) => {
      if (info.offset.x > 50 && onReply) {
        onReply(message)
      }
      await controls.start({ x: 0 })
    },
    [controls, onReply, message]
  )

  if (message.is_deleted) {
    return (
      <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"} mb-3 px-4`}>
        <div className="rounded-2xl px-4 py-2.5 bg-nexus-card/50 border border-nexus-border/30 text-nexus-muted text-sm italic backdrop-blur-sm">
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            This message was deleted
          </span>
        </div>
      </div>
    )
  }

  const bubbleClass = isMe
    ? "bg-gradient-to-br from-[#006e59] to-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm border border-white/5 shadow-md shadow-black/20"
    : isOtherUser
    ? "bg-gradient-to-br from-[#2a3942] to-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-sm border border-white/5 shadow-md shadow-black/20"
    : "bg-gradient-to-br from-[#132c28] to-[#0e1f1d] text-[#e9edef] rounded-2xl rounded-tl-sm border border-nexus-primary/20 shadow-lg shadow-black/30"

  return (
    <motion.div
      className={`group relative flex w-full mb-1.5 ${isMe ? "items-end" : "items-start"}`}
      id={"msg_" + message.id}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        onDragEnd={handleDragEnd}
        animate={controls}
        className={`flex w-full ${isMe ? "justify-end" : "justify-start"} gap-2 px-2`}
      >
        {!isMe && (
          <Avatar
            name={isAI ? "AI" : message.sender_name}
            image={isAI ? logo : getImageUrl(message.sender_image)}
          />
        )}

        <div className={`${bubbleClass} px-3 py-2 shadow-sm max-w-[92%] md:max-w-[85%] relative group/bubble`}>
          {/* Context Menu Button */}
          <div className={`absolute top-1 ${isMe ? "left-[-28px]" : "right-[-28px]"} opacity-0 group-hover/bubble:opacity-100 transition-opacity hidden md:flex`}>
            <button
              onClick={() => { setShowDeleteMenu(!showDeleteMenu); setShowDeleteOptions(false) }}
              className="p-1.5 text-gray-400 hover:text-white bg-nexus-card/80 backdrop-blur-sm rounded-full border border-nexus-border/30 shadow-lg transition-all hover:scale-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            </button>

            {showDeleteMenu && (
              <div
                className="absolute top-9 z-20 w-36 rounded-xl border border-nexus-border bg-nexus-card shadow-2xl shadow-black/40 py-1 overflow-hidden animate-fadeIn"
                style={{ [isMe ? "right" : "left"]: 0 }}
              >
                {!showDeleteOptions ? (
                  <>
                    <button
                      onClick={() => { onReply?.(message); setShowDeleteMenu(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-nexus-text hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Reply size={14} /> Reply
                    </button>
                    {isMe && (
                      <button
                        onClick={() => { setIsEditing(true); setShowDeleteMenu(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-nexus-text hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                        Edit
                      </button>
                    )}
                    <div className="h-px bg-nexus-border/50 my-0.5" />
                    <button
                      onClick={() => setShowDeleteOptions(true)}
                      className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-1.5 text-[10px] text-nexus-muted uppercase font-bold tracking-wider">Delete?</div>
                    <button
                      onClick={() => { onDelete(message.id, "me"); setShowDeleteMenu(false); setShowDeleteOptions(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-nexus-text hover:bg-white/5 transition-colors"
                    >
                      For Me
                    </button>
                    {isMe && (
                      <button
                        onClick={() => { onDelete(message.id, "everyone"); setShowDeleteMenu(false); setShowDeleteOptions(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        For Everyone
                      </button>
                    )}
                    <div className="h-px bg-nexus-border/50 my-0.5" />
                    <button
                      onClick={() => setShowDeleteOptions(false)}
                      className="w-full text-left px-3 py-1.5 text-xs text-nexus-muted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sender name for other users */}
          {isOtherUser && message.sender_name && (
            <p className="text-xs font-semibold mb-0.5" style={{ color: senderColor }}>
              {message.sender_name}
            </p>
          )}

          {/* Reply reference */}
          {message.replyTo && (
            <div
              className="mb-1.5 pl-2 border-l-2 border-nexus-primary/50 bg-black/10 rounded-r-md py-1 pr-2 cursor-pointer"
              onClick={() => document.getElementById("msg_" + message.replyTo?.id)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <p className="text-[11px] font-semibold text-nexus-primary">{message.replyTo.sender}</p>
              <p className="text-xs text-nexus-muted truncate">{message.replyTo.content}</p>
            </div>
          )}

          {/* Content */}
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed relative min-w-[60px]">
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[200px]">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="bg-black/20 text-white rounded-lg p-2 text-sm w-full outline-none border border-white/10 resize-none min-h-[60px] focus:border-nexus-primary/50"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="text-xs text-nexus-muted hover:text-white px-2 py-1 rounded transition-colors">Cancel</button>
                  <button onClick={handleSaveEdit} className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-md font-medium hover:bg-emerald-500 transition-colors">Save</button>
                </div>
              </div>
            ) : isAI ? (
              <div className="prose prose-invert prose-sm max-w-none [&_pre]:m-0 [&_pre]:bg-transparent [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_code]:text-emerald-300 [&_code]:bg-white/5 [&_code]:px-1 [&_code]:rounded [&_code]:text-[13px]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "")
                      const codeString = String(children).replace(/\n$/, "")
                      return match ? (
                        <div className="rounded-lg overflow-hidden my-2 border border-white/5">
                          <CodeBlockHeader language={match[1]} code={codeString} />
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: 0, fontSize: "13px" }}
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
            <span className="text-[10px] text-nexus-muted/60 italic mt-0.5 block">edited</span>
          )}
        </div>

        {isMe && (
          <Avatar
            name="Me"
            image={getImageUrl(message.sender_image || currentUserImage)}
          />
        )}
      </motion.div>
    </motion.div>
  )
})

export default MessageBubble