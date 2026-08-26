import apiClient from "./client"

export async function updateProfile(
  username?: string,
  email?: string,
  full_name?: string,
  bio?: string,
  is_private?: boolean
) {
  const res = await apiClient.put("/api/auth/profile", {
    username,
    email,
    full_name,
    bio,
    is_private,
  })
  return res.data
}

export async function getProfile() {
  const res = await apiClient.get("/api/auth/me")
  return res.data
}

export async function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append("file", file)

  const res = await apiClient.post("/api/auth/profile/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return res.data
}

export async function deleteAccount() {
  const res = await apiClient.delete("/api/auth/profile")
  return res.data
}
