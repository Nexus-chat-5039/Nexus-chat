import apiClient from "./client"

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

export async function fetchMessages(groupId: string, chatId: string) {
  const res = await apiClient.get(`/api/chats/${chatId}/messages`)
  const rawMessages = res.data.messages || []
  return rawMessages.map((m: any) => ({
    id: m.id || m.ID,
    role: "user",
    content: m.content || m.Content,
    sender: m.user_email?.String || m.user_email || m.user_id || m.UserID || "Unknown",
    sender_image: m.avatar_url?.String || undefined,
    is_deleted: m.is_deleted || m.IsDeleted || false,
    created_at: m.created_at || m.CreatedAt,
    replyTo: m.reply_to || m.ReplyTo || undefined,
  }))
}
