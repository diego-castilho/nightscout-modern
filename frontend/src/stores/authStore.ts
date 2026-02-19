// ============================================================================
// authStore — Authentication state (Zustand, no persistence)
// The token itself lives in localStorage under 'authToken'.
// The store only tracks the derived boolean `isAuthenticated`.
// ============================================================================

import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initialise from localStorage so page reloads keep the session
  isAuthenticated: !!localStorage.getItem('authToken'),

  setAuthenticated: (value) => set({ isAuthenticated: value }),

  logout: () => {
    localStorage.removeItem('authToken');
    set({ isAuthenticated: false });
  },
}));
