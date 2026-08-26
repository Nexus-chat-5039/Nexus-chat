import { useEffect, useCallback, useState, type MutableRefObject } from "react"
import { fetchMessages, fetchThreadMessages } from "../api/query"

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
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  // Socket event listeners for messages
  useEffect(() => {
    if (!isConnected) return

    function onNewMessage(rawMsg: {
      id: string
      role?: "user" | "assistant"
      content: string
      userEmail?: string
      userName?: string
      userAvatar?: string
      createdAt?: string
      tempId?: string
      chatId: string
    }) {
      const senderEmail = rawMsg.userEmail || rawMsg.userName || "Unknown"
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
      if (data.chatId === activeChatIdRef.current) {
        setStreamingMessageId(data.messageId)
      }

      setGroups((prev) =>
        prev.map((group) => ({
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
        }))
      )

      if (data.isFinal) {
        setIsTyping(false)
        if (data.chatId === activeChatIdRef.current) {
          setStreamingMessageId(null)
        }
      }
    }

    function onMessageReacted(data: { messageId: string; emoji: string; userId: string; action: "add" | "remove" }) {
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          chats: group.chats.map((chat) => ({
            ...chat,
            messages: chat.messages.map((m) => {
              if (m.id !== data.messageId) return m
              const reactions = { ...(m.reactions || {}) }
              const users = reactions[data.emoji] ? [...reactions[data.emoji]] : []
              if (data.action === "add" && !users.includes(data.userId)) {
                users.push(data.userId)
              } else if (data.action === "remove") {
                const idx = users.indexOf(data.userId)
                if (idx >= 0) users.splice(idx, 1)
              }
              if (users.length > 0) {
                reactions[data.emoji] = users
              } else {
                delete reactions[data.emoji]
              }
              return { ...m, reactions }
            }),
          })),
        }))
      )
    }

    function onThreadReply(data: { parentMessageId: string; reply: { id: string; tempId?: string; content: string; userEmail?: string; userName?: string; userAvatar?: string; createdAt?: string } }) {
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          chats: group.chats.map((chat) => ({
            ...chat,
            messages: chat.messages.map((m) => {
              if (m.id !== data.parentMessageId) return m
              const incomingReplyId = data.reply.id
              const incomingTempId = data.reply.tempId
              const threadMsg: Message = {
                id: incomingReplyId,
                role: "user",
                content: data.reply.content,
                sender: data.reply.userEmail || data.reply.userName || "Unknown",
                sender_name: data.reply.userName,
                sender_image: data.reply.userAvatar,
                created_at: data.reply.createdAt,
              }

              const existingReplies = m.thread_messages || []
              const hasMatching = existingReplies.some(
                (r) =>
                  r.id === incomingReplyId ||
                  (incomingTempId && r.id === incomingTempId) ||
                  (r.id.startsWith("thread_temp_") && r.content === threadMsg.content && r.sender === threadMsg.sender)
              )

              const updatedReplies = hasMatching
                ? existingReplies.map((r) =>
                    r.id === incomingReplyId ||
                    (incomingTempId && r.id === incomingTempId) ||
                    (r.id.startsWith("thread_temp_") && r.content === threadMsg.content && r.sender === threadMsg.sender)
                      ? threadMsg
                      : r
                  )
                : [...existingReplies, threadMsg]

              return {
                ...m,
                thread_count: hasMatching ? (m.thread_count || updatedReplies.length) : (m.thread_count || 0) + 1,
                thread_last_reply_at: data.reply.createdAt || new Date().toISOString(),
                thread_messages: updatedReplies,
              }
            }),
          })),
        }))
      )
    }


    const onSocketConnect = () => {
      if (activeGroupId && activeChatId) {
        socket.emit("join_chat", {
          groupId: activeGroupId,
          chatId: activeChatId,
        })
      }
    }

    socket.on("connect", onSocketConnect)
    socket.on("new_message", onNewMessage)
    socket.on("message_deleted", onMessageDeleted)
    socket.on("message_updated", onMessageUpdated)
    socket.on("typing", onTyping)
    socket.on("typing_indicator", onTyping)
    socket.on("ai_stream_chunk", onAiStreamChunk)
    socket.on("message_reacted", onMessageReacted)
    socket.on("thread_reply", onThreadReply)

    if (socket.connected && activeGroupId && activeChatId) {
      socket.emit("join_chat", {
        groupId: activeGroupId,
        chatId: activeChatId,
      })
    }

    return () => {
      socket.off("connect", onSocketConnect)
      socket.off("new_message", onNewMessage)
      socket.off("message_deleted", onMessageDeleted)
      socket.off("message_updated", onMessageUpdated)
      socket.off("typing", onTyping)
      socket.off("typing_indicator", onTyping)
      socket.off("ai_stream_chunk", onAiStreamChunk)
      socket.off("message_reacted", onMessageReacted)
      socket.off("thread_reply", onThreadReply)
      if (socket.connected && activeGroupId && activeChatId) {
        socket.emit("leave_chat", {
          groupId: activeGroupId,
          chatId: activeChatId,
        })
      }
    }
  }, [activeGroupId, activeChatId, isConnected, userEmail, activeGroupIdRef, activeChatIdRef, setGroups])


  // Load message history when active chat changes or groups are loaded
  const hasGroup = groups.some((g) => g.id === activeGroupId)

  useEffect(() => {
    if (!activeGroupId || !activeChatId || !hasGroup) return

    let isMounted = true

    async function loadHistory() {
      try {
        const data = await fetchMessages(activeGroupId, activeChatId)
        if (!isMounted) return
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
        if (isMounted) setError("Failed to load message history")
      }
    }

    loadHistory()
    return () => { isMounted = false }
  }, [activeGroupId, activeChatId, hasGroup, setGroups, setError])


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
      }, (ack?: { error?: string }) => {
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

  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          chats: group.chats.map((chat) => ({
            ...chat,
            messages: chat.messages.map((m) => {
              if (m.id !== messageId) return m
              const reactions = { ...(m.reactions || {}) }
              const users = reactions[emoji] ? [...reactions[emoji]] : []
              const userIdx = users.indexOf(userEmail)
              if (userIdx >= 0) {
                users.splice(userIdx, 1)
                if (users.length === 0) delete reactions[emoji]
                else reactions[emoji] = users
              } else {
                users.push(userEmail)
                reactions[emoji] = users
              }
              return { ...m, reactions }
            }),
          })),
        }))
      )

      socket.emit("react_message", {
        messageId,
        emoji,
        groupId: activeGroupIdRef.current,
        chatId: activeChatIdRef.current,
      })
    },
    [userEmail, activeGroupIdRef, activeChatIdRef, setGroups]
  )

  const sendThreadReply = useCallback(
    (parentMessageId: string, content: string) => {
      if (!content.trim()) return

      const tempId = "thread_temp_" + crypto.randomUUID()
      const threadMsg: Message = {
        id: tempId,
        role: "user",
        content,
        sender: userEmail,
        sender_image: profileImage || undefined,
        created_at: new Date().toISOString(),
      }

      // Optimistic update
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          chats: group.chats.map((chat) => ({
            ...chat,
            messages: chat.messages.map((m) => {
              if (m.id !== parentMessageId) return m
              return {
                ...m,
                thread_count: (m.thread_count || 0) + 1,
                thread_last_reply_at: new Date().toISOString(),
                thread_messages: [...(m.thread_messages || []), threadMsg],
              }
            }),
          })),
        }))
      )

      socket.emit("send_thread_reply", {
        parentMessageId,
        content,
        groupId: activeGroupIdRef.current,
        chatId: activeChatIdRef.current,
        tempId,
      })
    },
    [userEmail, profileImage, activeGroupIdRef, activeChatIdRef, setGroups]
  )

  const loadThreadMessages = useCallback(
    async (parentMessageId: string) => {
      try {
        const replies = await fetchThreadMessages(parentMessageId)
        setGroups((prev) =>
          prev.map((group) => ({
            ...group,
            chats: group.chats.map((chat) => ({
              ...chat,
              messages: chat.messages.map((m) => {
                if (m.id !== parentMessageId) return m
                return {
                  ...m,
                  thread_messages: replies,
                  thread_count: replies.length > 0 ? replies.length : m.thread_count,
                }
              }),
            })),
          }))
        )
        return replies
      } catch (err) {
        console.error("Failed to load thread messages", err)
        return []
      }
    },
    [setGroups]
  )

  return {
    isTyping,
    streamingMessageId,
    sendMessage,
    deleteMessage,
    editMessage,
    reactToMessage,
    sendThreadReply,
    loadThreadMessages,
  }
}

