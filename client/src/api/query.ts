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
  const res = await apiClient.get(`/api/messages/${groupId}/${chatId}`)
  return res.data
}
