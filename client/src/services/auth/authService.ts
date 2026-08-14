import apiClient from "../../api/client";

export interface AuthUserResponse {
  email: string;
  display_name: string;
  id?: string;
}

export const authService = {
  async login(email: string, password: string): Promise<{ user: AuthUserResponse; token: string }> {
    const res = await apiClient.post("/api/auth/login", { email, password });
    return res.data;
  },

  async register(email: string, password: string, display_name: string): Promise<{ user: AuthUserResponse; token: string }> {
    const res = await apiClient.post("/api/auth/register", { email, password, display_name });
    return res.data;
  },

  async getMe() {
    const res = await apiClient.get("/api/auth/me");
    return res.data;
  },
};
