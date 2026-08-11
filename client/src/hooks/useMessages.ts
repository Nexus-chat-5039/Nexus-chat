import { useEffect, useCallback, useState, type MutableRefObject } from "react"
import { fetchMessages } from "../api/query"
import { socket } from "../socket"
import type { Message, Group } from "../types"

type UseMessagesArgs = {
  activeGroupId: string
  activeChatId: string
  activeGroupIdRef: MutableRefObject<string>
  activeChatIdRef: MutableRefObject<string>
  groups: Group[]
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
  groups,
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

    function onNewMessage(rawMsg: any) {
      console.log("RECEIVED SOCKET MESSAGE:", rawMsg)
      
      const senderEmail = rawMsg.userEmail || rawMsg.userName || "Unknown"
      console.log("DEDUPLICATION DEBUG:", { 
        socketSender: senderEmail, 
        localUserEmail: userEmail,
        isMatch: senderEmail === userEmail
      })
      const msg: Message = {
        id: rawMsg.id,
        role: rawMsg.role || "user",
        content: rawMsg.content,
        sender: senderEmail,
        sender_image: rawMsg.userAvatar || undefined,
        created_at: rawMsg.createdAt,
      }
      
      const incomingTempId = rawMsg.tempId

      const targetChatId = rawMsg.chatId

      // Unified deduplication: if the message exists by exact ID, or matches an optimistic temp message (via tempId or fallback heuristics), replace it. Otherwise append.
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          chats: group.chats.map((chat) =>
            chat.id === targetChatId
              ? {
                  ...chat,
                  messages: chat.messages.some((m) => m.id === msg.id || (incomingTempId && m.id === incomingTempId) || (m.id.startsWith("temp_") && m.content === msg.content && m.sender === msg.sender))
                    ? chat.messages.map((m) => (m.id === msg.id || (incomingTempId && m.id === incomingTempId) || (m.id.startsWith("temp_") && m.content === msg.content && m.sender === msg.sender) ? { ...msg, id: msg.id } : m))
                    : [...chat.messages, msg],
                }
              : chat
          ),
        }))
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

    function onTyping(data?: { isTyping: boolean, name?: string, userId?: string }) {
      setIsTyping(data ? data.isTyping : true)
      if (!data || !data.isTyping) {
        setTimeout(() => setIsTyping(false), 1500)
      }
    }

    function onAiStreamChunk(data: { chatId: string; delta: string; isFinal: boolean; messageId: string }) {
      if (data.chatId !== activeChatIdRef.current) return

      setGroups((prev) =>
        prev.map((group) =>
          group.id === activeGroupIdRef.current
            ? {
                ...group,
                chats: group.chats.map((chat) => {
                  if (chat.id !== data.chatId) return chat

                  const msgExists = chat.messages.some((m) => m.id === data.messageId)
                  let newMessages = chat.messages

                  if (!msgExists) {
                    newMessages = [
                      ...chat.messages,
                      {
                        id: data.messageId,
                        role: "assistant",
                        content: data.delta,
                        sender: "Nexus AI",
                        created_at: new Date().toISOString(),
                      },
                    ]
                  } else {
                    newMessages = chat.messages.map((m) =>
                      m.id === data.messageId ? { ...m, content: m.content + data.delta } : m
                    )
                  }

                  return { ...chat, messages: newMessages }
                }),
              }
            : group
        )
      )

      if (data.isFinal) {
        setIsTyping(false)
      }
    }

    socket.on("new_message", onNewMessage)
    socket.on("message_deleted", onMessageDeleted)
    socket.on("message_updated", onMessageUpdated)
    socket.on("typing", onTyping)
    socket.on("typing_indicator", onTyping)
    socket.on("ai_stream_chunk", onAiStreamChunk)

    socket.emit("join_chat", {
      groupId: activeGroupId,
      chatId: activeChatId,
    })

    return () => {
      socket.off("new_message", onNewMessage)
      socket.off("message_deleted", onMessageDeleted)
      socket.off("message_updated", onMessageUpdated)
      socket.off("typing", onTyping)
      socket.off("typing_indicator", onTyping)
      socket.off("ai_stream_chunk", onAiStreamChunk)
      socket.emit("leave_chat", {
        groupId: activeGroupId,
        chatId: activeChatId,
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
                      ? { ...chat, messages: data }
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

      const activeGroup = groups.find((g) => g.id === activeGroupIdRef.current)
      const tempId = "temp_" + crypto.randomUUID()

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
                            id: tempId,
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
        groupId: activeGroupIdRef.current,
        chatId: activeChatIdRef.current,
        tenantId: activeGroup?.tenant_id || "",
        workspaceId: activeGroup?.workspace_id || "",
        content: text,
        triggerAI: triggerAi,
        replyTo,
        tempId,
      }, (ack: any) => {
        if (ack?.error) {
          console.error("Message send failed:", ack.error)
        }
      })
    },
    [userEmail, profileImage, activeGroupIdRef, activeChatIdRef, groups, setGroups]
  )

  const deleteMessage = useCallback(
    (messageId: string, type: "everyone" | "me") => {
      socket.emit("delete_message", {
        messageId: messageId,
        deleteType: type,
        groupId: activeGroupIdRef.current,
        chatId: activeChatIdRef.current,
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
        messageId: messageId,
        content,
        groupId: activeGroupIdRef.current,
        chatId: activeChatIdRef.current,
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
