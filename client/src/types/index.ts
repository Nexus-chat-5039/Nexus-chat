export type ReplyTo = {
  id: string
  sender: string
  content: string
}

export type Attachment = {
  id: string
  url: string
  type: "image" | "file"
  name: string
  size?: number
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
  reactions?: Record<string, string[]> // Object mapping emoji to user emails
  is_pinned?: boolean
  bookmarked_by?: string[]
  thread_id?: string
  reply_count?: number
  attachments?: Attachment[]
}

export type Chat = {
  id: string
  title: string
  messages: Message[]
}

export type Group = {
  id: string
  name: string
  user_id?: string
  members: string[]
  chats: Chat[]
}

export type User = {
  email: string
  username: string
  profileImage: string | null
  fullName?: string
  bio?: string
  isPrivate?: boolean
}
