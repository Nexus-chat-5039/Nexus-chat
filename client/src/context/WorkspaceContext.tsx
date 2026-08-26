import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react"
import { useAuthStore } from "../stores/authStore"
import { getProfile } from "../api/auth"
import apiClient from "../api/client"
import { useSocket } from "../hooks/useSocket"
import { useGroups } from "../hooks/useGroups"
import { useMessages } from "../hooks/useMessages"
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
  streamingMessageId: string | null
  sendMessage: (text: string, triggerAi?: boolean, replyTo?: Message["replyTo"]) => void
  createGroup: (name: string) => Promise<void>
  createChat: (title: string) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  deleteChat: (groupId: string, chatId: string) => Promise<void>
  joinGroup: (code: string) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
  removeMember: (groupId: string, email: string) => Promise<void>
  deleteMessage: (messageId: string, type: "everyone" | "me") => void
  editMessage: (messageId: string, content: string) => void
  reactToMessage: (messageId: string, emoji: string) => void
  sendThreadReply: (parentMessageId: string, content: string) => void
  loadThreadMessages: (parentMessageId: string) => Promise<Message[]>
  userEmail: string
  username: string
  profileImage: string | null
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

const EMPTY_CHAT: Chat = { id: "", title: "", messages: [] }

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { token, userEmail, username } = useAuthStore()

  const [groups, setGroups] = useState<Group[]>([])
  const [activeGroupId, setActiveGroupIdState] = useState<string>(() => localStorage.getItem("nexus_active_group_id") || "")
  const [activeChatId, setActiveChatIdState] = useState<string>(() => localStorage.getItem("nexus_active_chat_id") || "")
  const [isLoading, setIsLoading] = useState(true)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeGroupIdRef = useRef(activeGroupId)
  const activeChatIdRef = useRef(activeChatId)

  const setActiveGroupId = (id: string) => {
    setActiveGroupIdState(id)
    activeGroupIdRef.current = id
    if (id) localStorage.setItem("nexus_active_group_id", id)
  }

  const setActiveChatId = (id: string) => {
    setActiveChatIdState(id)
    activeChatIdRef.current = id
    if (id) localStorage.setItem("nexus_active_chat_id", id)
  }

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

  const prevTokenRef = useRef(token)

  // Reset state on logout
  useEffect(() => {
    if (prevTokenRef.current && !token) {
      setTimeout(() => {
        setGroups([])
        setActiveGroupIdState("")
        setActiveChatIdState("")
        setProfileImage(null)
        setError(null)
        setIsLoading(false)
        localStorage.removeItem("nexus_active_group_id")
        localStorage.removeItem("nexus_active_chat_id")
      }, 0)
    }
    prevTokenRef.current = token
  }, [token])

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
    let isMounted = true
    if (!token) return

    async function fetchGroups() {
      try {
        setIsLoading(true)
        const res = await apiClient.get("/api/groups")
        if (!isMounted) return
        if (res.data.groups && res.data.groups.length > 0) {
          const rawGroups = res.data.groups
          setGroups((prevGroups) => {
            return rawGroups.map((g: Group) => {
              const prevGroup = prevGroups.find((pg) => pg.id === g.id)
              return {
                ...g,
                members: g.members || [],
                chats: g.chats ? g.chats.map((c: Chat) => {
                  const prevChat = prevGroup?.chats.find((pc) => pc.id === c.id)
                  return {
                    ...c,
                    messages: prevChat?.messages || [],
                  }
                }) : [],
              }
            })
          })

          const savedGroupId = localStorage.getItem("nexus_active_group_id")
          const savedChatId = localStorage.getItem("nexus_active_chat_id")

          const currentGroup = rawGroups.find((g: Group) => g.id === (activeGroupIdRef.current || savedGroupId)) || rawGroups[0]
          setActiveGroupId(currentGroup.id)

          const currentChat = currentGroup.chats?.find((c: Chat) => c.id === (activeChatIdRef.current || savedChatId)) || currentGroup.chats?.[0]
          if (currentChat) {
            setActiveChatId(currentChat.id)
          }
        }

      } catch (err) {

        console.error("Failed to fetch groups", err)
        if (isMounted) setError("Failed to load groups. Please refresh the page.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchGroups()
    return () => { isMounted = false }
  }, [token])

  // Socket connection
  const { isConnected, connectionError } = useSocket(token)
  const combinedError = connectionError || error

  // Group CRUD
  const {
    createGroup,
    createChat,
    deleteGroup,
    deleteChat,
    joinGroup,
    leaveGroup,
    removeMember,
  } = useGroups({
    activeGroupIdRef,
    activeChatIdRef,
    groups,
    setGroups,
    setActiveGroupId,
    setActiveChatId,
    setError,
  })

  // Messages (socket listeners, history, send/delete/edit)
  const {
    isTyping,
    streamingMessageId,
    sendMessage,
    deleteMessage,
    editMessage,
    reactToMessage,
    sendThreadReply,
    loadThreadMessages,
  } = useMessages({
    activeGroupId,
    activeChatId,
    activeGroupIdRef,
    activeChatIdRef,
    groups,
    userEmail,
    profileImage,
    isConnected,
    setGroups,
    setError,
  })

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
      error: combinedError,
      streamingMessageId,
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
      reactToMessage,
      sendThreadReply,
      loadThreadMessages,
      userEmail,
      username,
      profileImage,
    }),
    [
      groups, activeGroup, activeChat, activeGroupId, activeChatId,
      isTyping, isConnected, isLoading, combinedError, streamingMessageId,
      sendMessage, createGroup, createChat, deleteGroup, deleteChat,
      joinGroup, leaveGroup, removeMember, deleteMessage, editMessage,
      reactToMessage, sendThreadReply, loadThreadMessages,
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
