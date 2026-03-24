import { useCallback, type MutableRefObject } from "react"
import apiClient from "../api/client"
import type { Chat, Group } from "../types"

type UseGroupsArgs = {
  activeGroupIdRef: MutableRefObject<string>
  activeChatIdRef: MutableRefObject<string>
  userEmail: string
  groups: Group[]
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>
  setActiveGroupId: (id: string) => void
  setActiveChatId: (id: string) => void
  setError: (err: string | null) => void
}

/**
 * Group CRUD operations: create, delete, join, leave, remove member, create/delete chats.
 */
export function useGroups({
  activeGroupIdRef,
  activeChatIdRef,
  userEmail,
  groups,
  setGroups,
  setActiveGroupId,
  setActiveChatId,
  setError,
}: UseGroupsArgs) {
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
  }, [setGroups, setActiveGroupId, setActiveChatId, setError])

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
  }, [activeGroupIdRef, setGroups, setActiveChatId, setError])

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
    [activeGroupIdRef, setGroups, setActiveGroupId, setActiveChatId, setError]
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
    [activeChatIdRef, groups, setGroups, setActiveChatId, setError]
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
  }, [userEmail, setGroups, setActiveGroupId, setActiveChatId, setError])

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
    [activeGroupIdRef, setGroups, setActiveGroupId, setActiveChatId, setError]
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
  }, [setGroups, setError])

  return {
    createGroup,
    createChat,
    deleteGroup,
    deleteChat,
    joinGroup,
    leaveGroup,
    removeMember,
  }
}
