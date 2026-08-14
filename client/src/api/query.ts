import apiClient from "./client"
import type { Message } from "../types"

export async function queryAI({
  query,
  group_id,
  chat_id,
}: {
  query: string
  group_id: string
  chat_id: string
}) {
  const res = await apiClient.post("/api/query", {
    query,
    group_id,
    chat_id,
  })
  return res.data
}

export async function fetchMessages(_groupId: string, chatId: string): Promise<Message[]> {
  const res = await apiClient.get(`/api/chats/${chatId}/messages`)
  const rawMessages = res.data.messages || []
  return rawMessages.map((m: {
    id?: string
    ID?: string
    role?: "user" | "assistant"
    Role?: "user" | "assistant"
    content?: string
    Content?: string
    user_email?: { String?: string } | string
    user_id?: string
    UserID?: string
    display_name?: { String?: string } | string
    avatar_url?: { String?: string } | string
    is_deleted?: boolean
    IsDeleted?: boolean
    is_edited?: boolean
    IsEdited?: boolean
    created_at?: string
    CreatedAt?: string
    reply_to?: { id: string; sender: string; content: string }
    ReplyTo?: { id: string; sender: string; content: string }
    reactions?: Record<string, string[]>
    Reactions?: Record<string, string[]>
    thread_count?: number
    ThreadCount?: number
    thread_last_reply_at?: string
    ThreadLastReplyAt?: string
  }) => {
    const senderEmail = (typeof m.user_email === "object" ? m.user_email?.String : m.user_email) || m.user_id || m.UserID || "Unknown"
    const senderName = (typeof m.display_name === "object" ? m.display_name?.String : m.display_name) || undefined
    const avatarUrl = (typeof m.avatar_url === "object" ? m.avatar_url?.String : m.avatar_url) || undefined
    const reactions = m.reactions || m.Reactions || {}
    const threadCount = m.thread_count !== undefined ? m.thread_count : (m.ThreadCount !== undefined ? m.ThreadCount : 0)
    const threadLastReplyAt = m.thread_last_reply_at || m.ThreadLastReplyAt || undefined

    return {
      id: m.id || m.ID || "",
      role: (m.role || m.Role || "user") as "user" | "assistant",
      content: m.content || m.Content || "",
      sender: senderEmail,
      sender_name: senderName,
      sender_image: avatarUrl,
      is_deleted: m.is_deleted || m.IsDeleted || false,
      is_edited: m.is_edited || m.IsEdited || false,
      created_at: m.created_at || m.CreatedAt,
      replyTo: m.reply_to || m.ReplyTo || undefined,
      reactions,
      thread_count: threadCount,
      thread_last_reply_at: threadLastReplyAt,
      thread_messages: [],
    }
  })
}

export async function fetchThreadMessages(messageId: string): Promise<Message[]> {
  const res = await apiClient.get(`/api/messages/${messageId}/thread`)
  const rawReplies = res.data.replies || []
  return rawReplies.map((r: {
    id: string
    content: string
    user_email?: string
    user_name?: string
    user_avatar?: string
    created_at?: string
  }) => ({
    id: r.id,
    role: "user" as const,
    content: r.content,
    sender: r.user_email || r.user_name || "Unknown",
    sender_name: r.user_name,
    sender_image: r.user_avatar || undefined,
    created_at: r.created_at,
  }))
}
