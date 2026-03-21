import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react"
import { useAuth } from "./AuthContext"
import { fetchMessages } from "../api/query"
import { getProfile } from "../api/auth"
import { socket } from "../socket"
import apiClient from "../api/client"
import type { Message, Chat, Group } from "../types"

type WorkspaceContextType = {
  groups: Group[]
  activeGroup: Group | undefined
  activeChat: Chat
  activeGroupId: string
  activeChatId: string
  setActiveGroupId: (id: string) => void
  setActiveChatId: (id: string) => void
  isTyping: boolean
  isConnected: boolean
  isLoading: boolean
  error: string | null
  sendMessage: (text: string, triggerAi?: boolean, replyTo?: Message["replyTo"]) => void
  createGroup: (name: string) => Promise<void>
  createChat: (title: string) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  deleteChat: (groupId: string, chatId: string) => Promise<void>
  joinGroup: (groupId: string) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
  removeMember: (groupId: string, email: string) => Promise<void>
  deleteMessage: (messageId: string, type: "everyone" | "me") => void
  editMessage: (messageId: string, content: string) => void
  userEmail: string
  username: string
  profileImage: string | null
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

const EMPTY_CHAT: Chat = { id: "null", title: "", messages: [] }

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { token, userEmail, username } = useAuth()

  const [groups, setGroups] = useState<Group[]>([])
  const [activeGroupId, setActiveGroupId] = useState("")
  const [activeChatId, setActiveChatId] = useState("general")
  const [isTyping, setIsTyping] = useState(false)
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [isLoading, setIsLoading] = useState(true)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeGroupIdRef = useRef(activeGroupId)
  const activeChatIdRef = useRef(activeChatId)

  useEffect(() => { activeGroupIdRef.current = activeGroupId }, [activeGroupId])
  useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) || groups[0],
    [groups, activeGroupId]
  )

  const activeChat = useMemo(
    () => activeGroup?.chats.find((c) => c.id === activeChatId) || activeGroup?.chats[0] || EMPTY_CHAT,
    [activeGroup, activeChatId]
  )

  // Fetch profile image
  useEffect(() => {
    if (!token) return
    getProfile()
      .then((data) => {
        if (data.profile_image) setProfileImage(data.profile_image)
      })
      .catch(console.error)
  }, [token])

  // Fetch groups
  useEffect(() => {
    if (!token) return

    async function fetchGroups() {
      try {
        setIsLoading(true)
        const res = await apiClient.get("/api/groups")
        if (res.data.length > 0) {
          const loadedGroups: Group[] = res.data.map((g: Group) => ({
            ...g,
            chats: g.chats.map((c: Chat) => ({ ...c, messages: [] })),
          }))
          setGroups(loadedGroups)

          if (!loadedGroups.find((g) => g.id === activeGroupIdRef.current)) {
            setActiveGroupId(loadedGroups[0].id)
            if (loadedGroups[0].chats.length > 0) {
              setActiveChatId(loadedGroups[0].chats[0].id)
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch groups", err)
        setError("Failed to load groups. Please refresh the page.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroups()
  }, [token])

  // Socket connection
  useEffect(() => {
    if (!token) return

    socket.auth = { token }
    socket.connect()

    const onConnect = () => {
      setIsConnected(true)
      setError(null)
    }
    const onDisconnect = () => setIsConnected(false)
    const onError = () => setError("Connection error. Retrying...")

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("connect_error", onError)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("connect_error", onError)
      socket.disconnect()
    }
  }, [token])

  // Socket event listeners
  useEffect(() => {
    if (!isConnected) return

    function onNewMessage(msg: Partial<Message> & { id?: string; content: string; role: "user" | "assistant" }) {
      if (msg.role === "user" && msg.sender === userEmail) return

      setGroups((prev) =>
        prev.map((group) =>
          group.id === activeGroupIdRef.current
            ? {
                ...group,
                chats: group.chats.map((chat) =>
                  chat.id === activeChatIdRef.current
                    ? {
                        ...chat,
                        messages: [
                          ...chat.messages,
                          {
                            id: msg.id || crypto.randomUUID(),
                            role: msg.role,
                            content: msg.content,
                            sender: msg.sender,
                            sender_name: msg.sender_name,
                            sender_image: msg.sender_image,
                            replyTo: msg.replyTo,
                            is_deleted: msg.is_deleted,
                          },
                        ],
                      }
                    : chat
                ),
              }
            : group
        )
      )
    }

    function onMessageDeleted(data: { id: string; type: "everyone" | "me" }) {
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          chats: group.chats.map((chat) => ({
            ...chat,
            messages:
              data.type === "everyone"
                ? chat.messages.map((m) =>
                    m.id === data.id || m.id.endsWith(data.id)
                      ? { ...m, content: "This message was deleted", is_deleted: true, replyTo: undefined }
                      : m
                  )
                : chat.messages.filter((m) => m.id !== data.id && !m.id.endsWith(data.id)),
          })),
        }))
      )
    }

    function onMessageUpdated(data: { id: string; content: string; chat_id: string; group_id: string }) {
      setGroups((prev) =>
        prev.map((group) =>
          group.id === data.group_id
            ? {
                ...group,
                chats: group.chats.map((chat) =>
                  chat.id === data.chat_id
                    ? {
                        ...chat,
                        messages: chat.messages.map((m) =>
                          m.id === data.id || m.id.endsWith(data.id)
                            ? { ...m, content: data.content, is_edited: true }
                            : m
                        ),
                      }
                    : chat
                ),
              }
            : group
        )
      )
    }

    function onTyping() {
      setIsTyping(true)
      setTimeout(() => setIsTyping(false), 1500)
    }

    socket.on("new_message", onNewMessage)
    socket.on("message_deleted", onMessageDeleted)
    socket.on("message_updated", onMessageUpdated)
    socket.on("typing", onTyping)

    socket.emit("join_room", {
      group_id: activeGroupId,
      chat_id: activeChatId,
    })

    return () => {
      socket.off("new_message", onNewMessage)
      socket.off("message_deleted", onMessageDeleted)
      socket.off("message_updated", onMessageUpdated)
      socket.off("typing", onTyping)
      socket.emit("leave_room", {
        group_id: activeGroupId,
        chat_id: activeChatId,
      })
    }
  }, [activeGroupId, activeChatId, isConnected, userEmail])

  // Load message history
  useEffect(() => {
    if (!activeGroupId || !activeChatId) return

    async function loadHistory() {
      try {
        const data = await fetchMessages(activeGroupId, activeChatId)
        setGroups((prev) =>
          prev.map((group) =>
            group.id === activeGroupId
              ? {
                  ...group,
                  chats: group.chats.map((chat) =>
                    chat.id === activeChatId
                      ? {
                          ...chat,
                          messages: data.map((m: Record<string, unknown>) => ({
                            id: (m._id as string) || (m.id as string) || crypto.randomUUID(),
                            role: m.role as "user" | "assistant",
                            content: m.content as string,
                            sender: (m.sender as string) || (m.user_id as string),
                            sender_name: m.sender_name as string | undefined,
                            sender_image: m.sender_image as string | undefined,
                            replyTo: m.replyTo as Message["replyTo"],
                            is_deleted: m.is_deleted as boolean | undefined,
                          })),
                        }
                      : chat
                  ),
                }
              : group
          )
        )
      } catch (err) {
        console.error("Failed to load history", err)
        setError("Failed to load message history")
      }
    }

    loadHistory()
  }, [activeGroupId, activeChatId])

  // Actions
  const sendMessage = useCallback(
    (text: string, triggerAi: boolean = false, replyTo?: Message["replyTo"]) => {
      if (!text.trim()) return

      setGroups((prev) =>
        prev.map((group) =>
          group.id === activeGroupIdRef.current
            ? {
                ...group,
                chats: group.chats.map((chat) =>
                  chat.id === activeChatIdRef.current
                    ? {
                        ...chat,
                        messages: [
                          ...chat.messages,
                          {
                            id: crypto.randomUUID(),
                            role: "user" as const,
                            content: text,
                            sender: userEmail,
                            sender_image: profileImage || undefined,
                            replyTo,
                          },
                        ],
                      }
                    : chat
                ),
              }
            : group
        )
      )

      socket.emit("send_message", {
        group_id: activeGroupIdRef.current,
        chat_id: activeChatIdRef.current,
        content: text,
        trigger_ai: triggerAi,
        replyTo,
      })
    },
    [userEmail, profileImage]
  )

  const deleteMessage = useCallback(
    (messageId: string, type: "everyone" | "me") => {
      socket.emit("delete_message", {
        message_id: messageId,
        delete_type: type,
        group_id: activeGroupIdRef.current,
        chat_id: activeChatIdRef.current,
      })

      setGroups((prev) =>
        prev.map((group) =>
          group.id === activeGroupIdRef.current
            ? {
                ...group,
                chats: group.chats.map((chat) =>
                  chat.id === activeChatIdRef.current
                    ? {
                        ...chat,
                        messages:
                          type === "everyone"
                            ? chat.messages.map((m) =>
                                m.id === messageId
                                  ? { ...m, content: "This message was deleted", is_deleted: true, replyTo: undefined }
                                  : m
                              )
                            : chat.messages.filter((m) => m.id !== messageId),
                      }
                    : chat
                ),
              }
            : group
        )
      )
    },
    []
  )

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      socket.emit("edit_message", {
        message_id: messageId,
        content,
        group_id: activeGroupIdRef.current,
        chat_id: activeChatIdRef.current,
      })

      setGroups((prev) =>
        prev.map((group) =>
          group.id === activeGroupIdRef.current
            ? {
                ...group,
                chats: group.chats.map((chat) =>
                  chat.id === activeChatIdRef.current
                    ? {
                        ...chat,
                        messages: chat.messages.map((m) =>
                          m.id === messageId ? { ...m, content, is_edited: true } : m
                        ),
                      }
                    : chat
                ),
              }
            : group
        )
      )
    },
    []
  )

  const createGroup = useCallback(async (name: string) => {
    if (!name) return
    try {
      const res = await apiClient.post("/api/groups", { name })
      const newGroup: Group = {
        ...res.data,
        members: res.data.members || [],
        chats: res.data.chats.map((c: Chat) => ({ ...c, messages: [] })),
      }
      setGroups((prev) => [...prev, newGroup])
      setActiveGroupId(newGroup.id)
      if (newGroup.chats.length > 0) setActiveChatId(newGroup.chats[0].id)
    } catch (err) {
      console.error("Failed to create group", err)
      setError("Failed to create group")
    }
  }, [])

  const createChat = useCallback(async (title: string) => {
    if (!title) return
    const currentGroupId = activeGroupIdRef.current
    try {
      const res = await apiClient.post(`/api/groups/${currentGroupId}/chats`, { title })
      const newChat: Chat = { ...res.data, messages: [] }
      setGroups((prev) =>
        prev.map((g) =>
          g.id === currentGroupId ? { ...g, chats: [...g.chats, newChat] } : g
        )
      )
      setActiveChatId(newChat.id)
    } catch (err) {
      console.error("Failed to create chat", err)
      setError("Failed to create chat")
    }
  }, [])

  const deleteGroup = useCallback(
    async (groupId: string) => {
      if (!confirm("Are you sure you want to delete this group?")) return
      try {
        await apiClient.delete(`/api/groups/${groupId}`)
        setGroups((prev) => {
          const newGroups = prev.filter((g) => g.id !== groupId)
          if (activeGroupIdRef.current === groupId && newGroups.length > 0) {
            setActiveGroupId(newGroups[0].id)
            setActiveChatId(newGroups[0].chats[0]?.id || "")
          } else if (newGroups.length === 0) {
            setActiveGroupId("")
            setActiveChatId("")
          }
          return newGroups
        })
      } catch (err) {
        console.error(err)
        setError("Failed to delete group. Ensure you are the owner.")
      }
    },
    []
  )

  const deleteChat = useCallback(
    async (groupId: string, chatId: string) => {
      if (!confirm("Delete this chat and all its messages?")) return
      try {
        await apiClient.delete(`/api/groups/${groupId}/chats/${chatId}`)
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id === groupId) {
              const updatedChats = g.chats.filter((c) => c.id !== chatId)
              return { ...g, chats: updatedChats }
            }
            return g
          })
        )
        if (activeChatIdRef.current === chatId) {
          const group = groups.find((g) => g.id === groupId)
          const otherChat = group?.chats.find((c) => c.id !== chatId)
          setActiveChatId(otherChat?.id || "")
        }
      } catch (err) {
        console.error(err)
        setError("Failed to delete chat.")
      }
    },
    [groups]
  )

  const joinGroup = useCallback(async (groupId: string) => {
    if (!groupId) return
    try {
      const res = await apiClient.post("/api/groups/join", { group_id: groupId })
      const newGroup: Group = {
        id: res.data.group_id,
        name: res.data.name,
        members: [userEmail],
        chats: [{ id: "general", title: "General", messages: [] }],
      }
      setGroups((prev) => [...prev, newGroup])
      setActiveGroupId(newGroup.id)
      setActiveChatId("general")
    } catch (err) {
      console.error(err)
      setError("Failed to join group. Check the ID.")
    }
  }, [userEmail])

  const leaveGroup = useCallback(
    async (groupId: string) => {
      if (!confirm("Are you sure you want to leave this group?")) return
      try {
        await apiClient.post(`/api/groups/${groupId}/leave`, {})
        setGroups((prev) => {
          const newGroups = prev.filter((g) => g.id !== groupId)
          if (activeGroupIdRef.current === groupId) {
            if (newGroups.length > 0) {
              setActiveGroupId(newGroups[0].id)
              if (newGroups[0].chats.length > 0) setActiveChatId(newGroups[0].chats[0].id)
            } else {
              setActiveGroupId("")
              setActiveChatId("")
            }
          }
          return newGroups
        })
      } catch (err) {
        console.error(err)
        setError("Failed to leave group.")
      }
    },
    []
  )

  const removeMember = useCallback(async (groupId: string, email: string) => {
    if (!confirm(`Remove ${email} from this group?`)) return
    try {
      await apiClient.delete(`/api/groups/${groupId}/members/${email}`)
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, members: g.members.filter((m) => m !== email) }
            : g
        )
      )
    } catch (err) {
      console.error(err)
      setError("Failed to remove member.")
    }
  }, [])

  const value = useMemo<WorkspaceContextType>(
    () => ({
      groups,
      activeGroup,
      activeChat,
      activeGroupId,
      activeChatId,
      setActiveGroupId,
      setActiveChatId,
      isTyping,
      isConnected,
      isLoading,
      error,
      sendMessage,
      createGroup,
      createChat,
      deleteGroup,
      deleteChat,
      joinGroup,
      leaveGroup,
      removeMember,
      deleteMessage,
      editMessage,
      userEmail,
      username,
      profileImage,
    }),
    [
      groups, activeGroup, activeChat, activeGroupId, activeChatId,
      isTyping, isConnected, isLoading, error,
      sendMessage, createGroup, createChat, deleteGroup, deleteChat,
      joinGroup, leaveGroup, removeMember, deleteMessage, editMessage,
      userEmail, username, profileImage,
    ]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider")
  return ctx
}
