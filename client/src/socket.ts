import { io } from "socket.io-client"


import { SOCKET_URL } from "./api/config"

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  auth: (cb) => {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("nexus_token") : null
    cb({ token })
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
    socket.auth = { token }
    if (!socket.connected) {
      socket.connect()
    }
  } else {
    socket.disconnect()
  }
}
