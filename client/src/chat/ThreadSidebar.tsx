import { useEffect, useState, useRef, useCallback } from "react"
import { X } from "lucide-react"
import MessageBubble from "./MessageBubble"
import MessageInput from "./MessageInput"
import type { Message } from "../types"
import apiClient from "../api/client"
import { useWorkspace } from "../context/WorkspaceContext"
import { socket } from "../socket"

type Props = {
  parentMessage: Message
  groupId: string
  chatId: string
  onClose: () => void
}

export default function ThreadSidebar({ parentMessage, groupId, chatId, onClose }: Props) {
  const [replies, setReplies] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { userEmail, profileImage, deleteMessage, editMessage, sendMessage } = useWorkspace()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchThread() {
      try {
        const res = await apiClient.get(`/api/messages/${groupId}/${chatId}/thread/${parentMessage.id}`)
        setReplies(res.data.replies || [])
      } catch (err) {
        console.error("Failed to load thread", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchThread()
  }, [groupId, chatId, parentMessage.id])

  // Listen for new messages in this thread
  useEffect(() => {
    const handleNewMessage = (msg: any) => {
       if (msg.thread_id === parentMessage.id) {
          // Check if we sent this temp message already, our global useMessages handles temp->real, 
          // but here we just manage a local copy for simplicity
          setReplies(prev => {
             // Avoid duplicates
             if (prev.find(m => m.id === msg.id || (m.id.startsWith("temp_") && m.content === msg.content))) {
                return prev.map(m => (m.id.startsWith("temp_") && m.content === msg.content) ? { ...m, id: msg.id } : m)
             }
             return [...prev, {
                id: msg.id || crypto.randomUUID(),
                role: msg.role,
                content: msg.content,
                sender: msg.sender,
                sender_name: msg.sender_name,
                sender_image: msg.sender_image,
                replyTo: msg.replyTo,
                is_deleted: msg.is_deleted,
                reactions: msg.reactions || {},
                is_pinned: msg.is_pinned || false,
                bookmarked_by: msg.bookmarked_by || [],
                thread_id: msg.thread_id,
                attachments: msg.attachments || []
             } as Message]
          })
       }
    }

    const handleMessageDeleted = (data: any) => {
       setReplies(prev => prev.map(m => m.id === data.id ? { ...m, content: "This message was deleted", is_deleted: true } : m))
    }

    socket.on("new_message", handleNewMessage)
    socket.on("message_deleted", handleMessageDeleted)

    return () => {
       socket.off("new_message", handleNewMessage)
       socket.off("message_deleted", handleMessageDeleted)
    }
  }, [parentMessage.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [replies])

  const handleSend = useCallback((text: string, triggerAi: boolean, replyTo?: any, attachments?: any[]) => {
      // Optimistic update locally
      setReplies(prev => [...prev, {
          id: "temp_" + crypto.randomUUID(),
          role: "user",
          content: text,
          sender: userEmail,
          sender_image: profileImage || undefined,
          thread_id: parentMessage.id,
          attachments: attachments || []
      } as Message])
      
      sendMessage(text, triggerAi, replyTo, attachments, parentMessage.id)
  }, [sendMessage, parentMessage.id, userEmail, profileImage])

  return (
    <div className="w-[350px] border-l border-nexus-border/40 bg-nexus-sidebar/95 backdrop-blur-xl flex flex-col h-full z-40 shadow-2xl">
      <div className="px-4 py-3 border-b border-nexus-border/40 flex justify-between items-center bg-nexus-card">
        <h3 className="font-semibold text-sm">Thread</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <MessageBubble
          message={parentMessage}
          currentUserId={userEmail}
          currentUserImage={profileImage}
          onDelete={deleteMessage}
          onEdit={editMessage}
        />
        
        <div className="flex items-center gap-2 my-4">
           <div className="h-px bg-nexus-border/60 flex-1" />
           <span className="text-xs text-nexus-muted font-medium">{replies.length} Replies</span>
           <div className="h-px bg-nexus-border/60 flex-1" />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-nexus-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {replies.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                currentUserId={userEmail}
                currentUserImage={profileImage}
                onDelete={deleteMessage}
                onEdit={editMessage}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="p-3 border-t border-nexus-border/40 bg-nexus-bg/50">
        <MessageInput onSend={handleSend} disabled={false} />
      </div>
    </div>
  )
}
