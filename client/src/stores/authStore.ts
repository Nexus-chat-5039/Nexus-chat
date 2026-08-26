import { create } from "zustand";
import { authService } from "../services/auth/authService";

export interface AuthUser {
  email: string;
  username: string;
}

interface AuthState {
  token: string | null;
  userEmail: string;
  username: string;
  isLoading: boolean;
  login: (token: string, email: string, username: string) => void;
  logout: () => void;
  getToken: () => string | null;
}



export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("nexus_token"),
  userEmail: "",
  username: "",
  isLoading: true,
  
  login: (token: string, email: string, username: string) => {
    localStorage.setItem("nexus_token", token);
    set({ token, userEmail: email, username });
  },
  
  logout: () => {
    localStorage.removeItem("nexus_token");
    set({ token: null, userEmail: "", username: "" });
  },
  
  getToken: () => get().token,
}));

export const initAuth = async () => {
  const token = localStorage.getItem("nexus_token");
  if (!token) {
    useAuthStore.setState({ isLoading: false });
    return;
  }

  try {
    const data = await authService.getMe();
    useAuthStore.getState().login(token, data.user.email, data.user.display_name);
  } catch (error) {
    console.error("Failed to authenticate session:", error);
    useAuthStore.getState().logout();
  } finally {
    useAuthStore.setState({ isLoading: false });
  }
};

// Start initialization immediately
initAuth();

// Cross-tab authentication synchronization
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "nexus_token") {
      if (!e.newValue) {
        useAuthStore.getState().logout();
      } else {
        initAuth();
      }
    }
  });
}
