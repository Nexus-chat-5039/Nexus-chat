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
  userEmail: string
  username: string
  profileImage: string | null
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

const EMPTY_CHAT: Chat = { id: "", title: "", messages: [] }

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { token, userEmail, username } = useAuthStore()

  const [groups, setGroups] = useState<Group[]>([])
  const [activeGroupId, setActiveGroupId] = useState("")
  const [activeChatId, setActiveChatId] = useState("")
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

  // Fetch groups (no more dummy tenant/workspace IDs)
  useEffect(() => {
    if (!token) {
      setGroups([])
      setActiveGroupId("")
      setActiveChatId("")
      return
    }

    async function fetchGroups() {
      try {
        setIsLoading(true)
        const res = await apiClient.get("/api/groups")
        if (res.data.groups && res.data.groups.length > 0) {
          const loadedGroups: Group[] = res.data.groups.map((g: Group) => ({
            ...g,
            members: g.members || [],
            chats: g.chats ? g.chats.map((c: Chat) => ({ ...c, messages: [] })) : [],
          }))
          setGroups(loadedGroups)

          const currentGroup = loadedGroups.find((g) => g.id === activeGroupIdRef.current)
          if (!currentGroup) {
            setActiveGroupId(loadedGroups[0].id)
            if (loadedGroups[0].chats.length > 0) {
              setActiveChatId(loadedGroups[0].chats[0].id)
            }
          } else {
            const hasActiveChat = currentGroup.chats.some((c) => c.id === activeChatIdRef.current)
            if (!hasActiveChat && currentGroup.chats.length > 0) {
              setActiveChatId(currentGroup.chats[0].id)
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
  const { isConnected, connectionError } = useSocket(token)

  // Merge connection error into the general error state
  useEffect(() => {
    if (connectionError) setError(connectionError)
    else if (isConnected) setError(null)
  }, [connectionError, isConnected])

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
    userEmail,
    groups,
    setGroups,
    setActiveGroupId,
    setActiveChatId,
    setError,
  })

  // Messages (socket listeners, history, send/delete/edit)
  const {
    isTyping,
    sendMessage,
    deleteMessage,
    editMessage,
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
