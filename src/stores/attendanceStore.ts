import { create } from 'zustand';

type AttendanceState = {
  selectedYearMonth: string;
  selectedShopId: string | null;
  setSelectedYearMonth: (yearMonth: string) => void;
  setSelectedShopId: (shopId: string | null) => void;
};

export const useAttendanceStore = create<AttendanceState>()((set) => ({
  selectedYearMonth: new Date().toISOString().slice(0, 7),
  selectedShopId: null,
  setSelectedYearMonth: (yearMonth) => set({ selectedYearMonth: yearMonth }),
  setSelectedShopId: (shopId) => set({ selectedShopId: shopId }),
}));
