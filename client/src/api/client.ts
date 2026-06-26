import axios from "axios"
import { API_URL } from "./config"

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Development Dummy IDs
// In staging: these will map to real test tenants.
// In production: the server extracts these from the authenticated user's session instead of relying on the client.
const DUMMY_TENANT_ID = "00000000-0000-0000-0000-000000000000"
const DUMMY_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001"

// Attach auth token to every request automatically
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("nexus_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Inject dummy identifiers for local development compatibility
  if (config.method?.toLowerCase() === 'get' || config.method?.toLowerCase() === 'delete') {
    config.params = {
      ...config.params,
      tenant_id: DUMMY_TENANT_ID,
      workspace_id: DUMMY_WORKSPACE_ID,
    }
  } else {
    // For POST/PUT/PATCH, inject into body if JSON
    if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
      config.data = {
        ...config.data,
        tenant_id: DUMMY_TENANT_ID,
        workspace_id: DUMMY_WORKSPACE_ID,
      }
    } else if (!config.data) {
      config.data = {
        tenant_id: DUMMY_TENANT_ID,
        workspace_id: DUMMY_WORKSPACE_ID,
      }
    }
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
