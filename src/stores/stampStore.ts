import { create } from 'zustand';
import type { AttendanceStatus } from '@/types';
import type { Coords } from '@/lib/utils/gpsUtils';

type GpsStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

type StampState = {
  selectedShopId: string | null;
  selectedStaffId: string | null;
  currentStatus: AttendanceStatus;
  lastStampTime: Date | null;
  gpsStatus: GpsStatus;
  gpsCoords: Coords | null;
  isLoading: boolean;
  errorMessage: string | null;

  setSelectedShop: (shopId: string) => void;
  setSelectedStaff: (staffId: string) => void;
  setGpsStatus: (status: GpsStatus, coords?: Coords) => void;
  setCurrentStatus: (status: AttendanceStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  resetSelection: () => void;
};

export const useStampStore = create<StampState>()((set) => ({
  selectedShopId: null,
  selectedStaffId: null,
  currentStatus: 'not_started',
  lastStampTime: null,
  gpsStatus: 'idle',
  gpsCoords: null,
  isLoading: false,
  errorMessage: null,

  setSelectedShop: (shopId) => set({ selectedShopId: shopId, selectedStaffId: null }),
  setSelectedStaff: (staffId) => set({ selectedStaffId: staffId }),
  setGpsStatus: (status, coords) => set({ gpsStatus: status, gpsCoords: coords ?? null }),
  setCurrentStatus: (status) => set({ currentStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (message) => set({ errorMessage: message }),
  resetSelection: () => set({
    selectedShopId: null,
    selectedStaffId: null,
    currentStatus: 'not_started',
    lastStampTime: null,
    gpsStatus: 'idle',
    gpsCoords: null,
    errorMessage: null,
  }),
}));
