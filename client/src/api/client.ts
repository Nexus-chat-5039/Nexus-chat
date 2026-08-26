import axios from "axios"
import { API_URL } from "./config"
import { useAuthStore } from "../stores/authStore"

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Attach auth token to every request automatically
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("nexus_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ""
    const isAuthRoute = url.includes("/auth/login") || url.includes("/auth/register")

    if (error.response?.status === 401 && !isAuthRoute) {
      useAuthStore.getState().logout()
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
