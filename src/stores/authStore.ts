import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser, ManagerSession } from '@/types';

type AuthState = {
  user: AuthUser | null;
  managerSession: ManagerSession | null;
  setUser: (user: AuthUser | null) => void;
  setManagerSession: (session: ManagerSession | null) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      managerSession: null,
      setUser: (user) => set({ user }),
      setManagerSession: (managerSession) => set({ managerSession }),
      clearAuth: () => set({ user: null, managerSession: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
