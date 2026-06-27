import { create } from 'zustand';

interface User {
  user_id: string;
  username: string;
  role_name: string;
  institution_id: string;
  last_login?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string, refresh: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('access_token'),

  setAuth: (user, token, refresh) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },

  clearAuth: () => {
    localStorage.clear();
    set({ user: null, token: null });
  },

  isAuthenticated: () => !!get().token && !!get().user,
}));
