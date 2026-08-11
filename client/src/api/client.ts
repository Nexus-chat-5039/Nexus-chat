import axios from "axios"
import { API_URL } from "./config"

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
    if (error.response?.status === 401) {
      localStorage.removeItem("nexus_token")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export default apiClient
