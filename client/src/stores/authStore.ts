import { create } from "zustand";
import { auth } from "../firebase/config";
import { onAuthStateChanged } from "firebase/auth";
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

const parseUsername = (email: string) => {
  return email.split("@")[0];
};

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

if (auth) {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        // 1. Get Firebase ID token
        const idToken = await firebaseUser.getIdToken();
        
        // 2. Call our backend to get the session token
        const { access_token } = await authService.createSession(idToken);
        
        // 3. Set token in store
        const email = firebaseUser.email || "";
        const username = firebaseUser.displayName || parseUsername(email);
        useAuthStore.getState().login(access_token, email, username);
      } catch (error) {
        console.error("Failed to establish session with backend:", error);
        useAuthStore.getState().logout();
      }
    } else {
      // User signed out of Firebase
      useAuthStore.getState().logout();
    }
    
    // Finish loading
    useAuthStore.setState({ isLoading: false });
  });
} else {
  // If no auth, we can't be logged in via Firebase. Finish loading.
  useAuthStore.setState({ isLoading: false });
}
