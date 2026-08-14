const REST_API_URL_ENV = import.meta.env.VITE_REST_API_URL
const SOCKET_URL_ENV = import.meta.env.VITE_SOCKET_URL

const DEFAULT_REST_URL = "http://localhost:8080"
const DEFAULT_SOCKET_URL = "http://localhost:3000"


if (!REST_API_URL_ENV) {
    console.info(`VITE_REST_API_URL not set. Using default backend: ${DEFAULT_REST_URL}`)
}
if (!SOCKET_URL_ENV) {
    console.info(`VITE_SOCKET_URL not set. Using default socket: ${DEFAULT_SOCKET_URL}`)
}

export const REST_API_URL = REST_API_URL_ENV || DEFAULT_REST_URL
export const SOCKET_URL = SOCKET_URL_ENV || DEFAULT_SOCKET_URL

// Alias API_URL to REST_API_URL to maintain compatibility with existing code
export const API_URL = REST_API_URL

export const getImageUrl = (path: string | undefined | null) => {
    if (!path) return undefined
    if (path.startsWith("http") || path.startsWith("data:")) return path
    return `${API_URL}${path}`
}
