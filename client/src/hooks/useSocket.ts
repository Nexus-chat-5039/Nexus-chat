import { useEffect, useState } from "react"
import { socket } from "../socket"

/**
 * Manages Socket.IO connection lifecycle.
 * Handles connect/disconnect/error and exposes connection state.
 */
export function useSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    socket.auth = { token }
    socket.connect()

    const onConnect = () => {
      setIsConnected(true)
      setConnectionError(null)
    }
    const onDisconnect = () => setIsConnected(false)
    const onError = () => setConnectionError("Connection error. Retrying...")

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

  return { isConnected, connectionError }
}
