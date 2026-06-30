import { create } from 'zustand';

interface User {
  user_id:        string;
  person_id:      string;
  username:       string;
  role_name:      string;
  permissions:    string[];
  institution_id: string;
  branch_id?:     string;
  last_login?:    string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string, refresh: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:  JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('access_token'),

  setAuth: (user, token, refresh) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },

  clearAuth: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
}));
