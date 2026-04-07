import { useState, useCallback, useRef, useEffect } from "react"
import { Sparkles, Send, X, Paperclip, Loader2 } from "lucide-react"
import type { Message } from "../types"
import apiClient from "../api/client"

type Props = {
  onSend: (text: string, triggerAi?: boolean, attachments?: any[]) => void
  disabled?: boolean
  replyingTo?: Message | null
  onCancelReply?: () => void
}

export default function MessageInput({ onSend, disabled, replyingTo, onCancelReply }: Props) {
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    async (triggerAi: boolean) => {
      if ((!text.trim() && files.length === 0) || disabled || isUploading) return
      
      let uploadedAttachments: any[] = []
      
      if (files.length > 0) {
        setIsUploading(true)
        try {
          const uploadPromises = files.map(async (file) => {
            const formData = new FormData()
            formData.append("file", file)
            const res = await apiClient.post("/api/upload", formData, {
              headers: { "Content-Type": "multipart/form-data" }
            })
            return res.data
          })
          
          uploadedAttachments = await Promise.all(uploadPromises)
        } catch (err) {
          console.error("Failed to upload files", err)
          setIsUploading(false)
          return // abort send on fail? or send without? Let's abort for safety
        }
        setIsUploading(false)
      }

      onSend(text, triggerAi, uploadedAttachments)
      setText("")
      setFiles([])
    },
    [text, files, disabled, isUploading, onSend]
  )
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
       setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }, [])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div 
      className="border-t border-white/5 bg-nexus-bg/70 backdrop-blur-2xl p-2 pb-3 md:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] relative z-20"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input 
        type="file" 
        multiple 
        className="hidden" 
        ref={fileInputRef} 
        onChange={(e) => {
          if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)])
          }
        }} 
      />
      {/* File attachments preview */}
      {files.length > 0 && (
         <div className="flex gap-2 overflow-x-auto mb-2 pb-1 scrollbar-thin">
            {files.map((f, i) => (
               <div key={i} className="relative flex-shrink-0 w-16 h-16 bg-nexus-card border border-nexus-border rounded-lg flex items-center justify-center overflow-hidden">
                  {f.type.startsWith("image/") ? (
                     <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                     <Paperclip className="text-nexus-muted" />
                  )}
                  <button 
                    onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 bg-red-500 rounded-full text-white p-0.5"
                  ><X size={12} /></button>
               </div>
            ))}
         </div>
      )}
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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 md:p-3 text-nexus-muted hover:text-white transition-colors bg-nexus-card/50 hover:bg-nexus-card rounded-2xl flex-shrink-0 border border-white/5"
          disabled={disabled || isUploading}
        >
          <Paperclip size={20} />
        </button>
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
          disabled={disabled || (!text.trim() && files.length === 0) || isUploading}
          className="
            rounded-2xl bg-gradient-to-r from-nexus-primary to-rose-600 px-4 py-2.5 md:px-5 md:py-3
            text-sm font-medium text-white shadow-lg shadow-nexus-primary/20
            hover:shadow-nexus-primary/40 hover:brightness-110 active:scale-[0.98]
            transition-all duration-300
            disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center min-w-[50px]
          "
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
