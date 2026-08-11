export type ReplyTo = {
  id: string
  sender: string
  content: string
}

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  sender?: string
  sender_name?: string
  sender_image?: string
  replyTo?: ReplyTo
  is_deleted?: boolean
  is_edited?: boolean
  created_at?: string
}

export type Chat = {
  id: string
  title: string
  messages: Message[]
}

export type Group = {
  id: string
  name: string
  owner_id?: string
  invite_code?: string
  visibility?: string
  join_policy?: string
  members: string[]
  chats: Chat[]
  tenant_id?: string
  workspace_id?: string
}

export type User = {
  email: string
  username: string
  profileImage: string | null
  fullName?: string
  bio?: string
  isPrivate?: boolean
}
