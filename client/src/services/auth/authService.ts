import apiClient from "../../api/client";

export const authService = {
  /**
   * Send the Firebase ID token to the Go backend to establish a session.
   * Returns the backend access token.
   */
  async createSession(firebaseIdToken: string): Promise<{ access_token: string }> {
    const res = await apiClient.post("/auth/session", {
      id_token: firebaseIdToken,
    });
    return res.data;
  },

  /**
   * Get the current authenticated user's profile from the Go backend.
   */
  async getMe() {
    const res = await apiClient.get("/auth/me");
    return res.data;
  },
};
