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

// Read ?token= from URL before React renders, so ProtectedRoute sees it immediately
(function consumeUrlToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return;
  localStorage.setItem('authToken', token);
  // Remove token from URL to avoid leaking it in history/clipboard
  const clean = new URL(window.location.href);
  clean.searchParams.delete('token');
  window.history.replaceState({}, '', clean.toString());
})();

export const useAuthStore = create<AuthState>((set) => ({
  // Initialise from localStorage so page reloads keep the session
  isAuthenticated: !!localStorage.getItem('authToken'),

  setAuthenticated: (value) => set({ isAuthenticated: value }),

  logout: () => {
    localStorage.removeItem('authToken');
    set({ isAuthenticated: false });
  },
}));
