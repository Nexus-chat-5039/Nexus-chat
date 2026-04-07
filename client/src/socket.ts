import { io } from "socket.io-client"

import { API_URL } from "./api/config"

// Create socket with auth factory — token is read fresh on each connect attempt
export const socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  auth: () => {
    const token = localStorage.getItem("nexus_token")
    return token ? { token } : {}
  },
})

socket.on("connect", () => {
  console.log("Socket connected:", socket.id)
})

socket.on("connect_error", (error: Error) => {
  console.error("Socket connection error:", error)
})

socket.on("disconnect", (reason: string) => {
  console.log("Socket disconnected:", reason)
})

// Helper to update auth token
export function updateSocketAuth(token: string | null) {
  if (token) {
    // Auth factory above will pick this up on next connect
    if (!socket.connected) {
      socket.connect()
    }
  } else {
    socket.disconnect()
  }
}
