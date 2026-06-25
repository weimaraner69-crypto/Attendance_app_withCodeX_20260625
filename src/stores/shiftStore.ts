import { create } from 'zustand';
import type { Shift } from '@/types';

type ViewMode = 'week' | 'month';

type ShiftState = {
  viewMode: ViewMode;
  currentDate: Date;
  editingShift: Shift | null;
  isFormOpen: boolean;

  setViewMode: (mode: ViewMode) => void;
  setCurrentDate: (date: Date) => void;
  setEditingShift: (shift: Shift | null) => void;
  setFormOpen: (open: boolean) => void;
};

export const useShiftStore = create<ShiftState>()((set) => ({
  viewMode: 'week',
  currentDate: new Date(),
  editingShift: null,
  isFormOpen: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentDate: (date) => set({ currentDate: date }),
  setEditingShift: (shift) => set({ editingShift: shift, isFormOpen: shift !== null }),
  setFormOpen: (open) => set({ isFormOpen: open }),
}));
