import { create } from 'zustand';

type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
};

type UiState = {
  isGlobalLoading: boolean;
  toasts: Toast[];
  isSidebarOpen: boolean;

  setGlobalLoading: (loading: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
};

export const useUiStore = create<UiState>()((set) => ({
  isGlobalLoading: false,
  toasts: [],
  isSidebarOpen: false,

  setGlobalLoading: (loading) => set({ isGlobalLoading: loading }),
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `${Date.now()}-${Math.random()}` },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
