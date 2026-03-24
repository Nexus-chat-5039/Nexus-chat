import { useEffect, useCallback, useState, type MutableRefObject } from "react"
import { fetchMessages } from "../api/query"
import { socket } from "../socket"
import type { Message, Group } from "../types"

type UseMessagesArgs = {
  activeGroupId: string
  activeChatId: string
  activeGroupIdRef: MutableRefObject<string>
  activeChatIdRef: MutableRefObject<string>
  userEmail: string
  profileImage: string | null
  isConnected: boolean
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>
  setError: (err: string | null) => void
}

/**
 * Message operations: load history, send, delete, edit messages.
 * Also manages socket event listeners for real-time message updates.
 */
export function useMessages({
  activeGroupId,
  activeChatId,
  activeGroupIdRef,
  activeChatIdRef,
  userEmail,
  profileImage,
  isConnected,
  setGroups,
  setError,
}: UseMessagesArgs) {
  const [isTyping, setIsTyping] = useState(false)

  // Socket event listeners for messages
  useEffect(() => {
    if (!isConnected) return

    function onNewMessage(msg: Partial<Message> & { id?: string; content: string; role: "user" | "assistant" }) {
      // If this is our own message echoed back, replace the temp ID with the real DB ID
      if (msg.role === "user" && msg.sender === userEmail) {
        if (msg.id) {
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
                              m.id.startsWith("temp_") && m.content === msg.content && m.sender === userEmail
                                ? { ...m, id: msg.id }
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
        return
      }

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
  }, [activeGroupId, activeChatId, isConnected, userEmail, activeGroupIdRef, activeChatIdRef, setGroups])

  // Load message history when active chat changes
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
  }, [activeGroupId, activeChatId, setGroups, setError])

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
                            id: "temp_" + crypto.randomUUID(),
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
    [userEmail, profileImage, activeGroupIdRef, activeChatIdRef, setGroups]
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
    [activeGroupIdRef, activeChatIdRef, setGroups]
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
    [activeGroupIdRef, activeChatIdRef, setGroups]
  )

  return {
    isTyping,
    sendMessage,
    deleteMessage,
    editMessage,
  }
}
