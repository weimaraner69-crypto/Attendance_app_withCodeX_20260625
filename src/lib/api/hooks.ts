import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MOCK_SHOPS, MOCK_STAFF, MOCK_ATTENDANCES, MOCK_CORRECTION_REQUESTS, MOCK_SHIFTS } from './mockData';
import type { Shop, Staff, AttendanceRecord, Shift, CorrectionRequest } from '@/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============ Shops ============

export function useShops() {
  return useQuery({
    queryKey: ['shops'],
    queryFn: async (): Promise<Shop[]> => {
      await delay(300);
      return MOCK_SHOPS;
    },
  });
}

export function useShop(shopId: string | null) {
  return useQuery({
    queryKey: ['shops', shopId],
    queryFn: async (): Promise<Shop | null> => {
      await delay(200);
      return MOCK_SHOPS.find(s => s.id === shopId) ?? null;
    },
    enabled: !!shopId,
  });
}

// ============ Staff ============

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async (): Promise<Staff[]> => {
      await delay(300);
      return MOCK_STAFF;
    },
  });
}

export function useShopStaff(shopId: string | null) {
  return useQuery({
    queryKey: ['staff', 'shop', shopId],
    queryFn: async (): Promise<Staff[]> => {
      await delay(300);
      return MOCK_STAFF;
    },
    enabled: !!shopId,
  });
}

// ============ Attendance ============

export function useTodayAttendances(shopId: string | null) {
  return useQuery({
    queryKey: ['attendances', 'today', shopId],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      await delay(400);
      return MOCK_ATTENDANCES.filter(a => !shopId || a.shopId === shopId);
    },
    enabled: !!shopId,
    refetchInterval: 30000,
  });
}

export function useAttendancesByDate(shopId: string | null, date: string) {
  return useQuery({
    queryKey: ['attendances', 'date', shopId, date],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      await delay(300);
      return MOCK_ATTENDANCES.filter(a => a.date === date && (!shopId || a.shopId === shopId));
    },
    enabled: !!shopId && !!date,
  });
}

export function useAttendancesByMonth(shopId: string | null, yearMonth: string) {
  return useQuery({
    queryKey: ['attendances', 'month', shopId, yearMonth],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      await delay(400);
      return MOCK_ATTENDANCES.filter(a => a.date.startsWith(yearMonth) && (!shopId || a.shopId === shopId));
    },
    enabled: !!shopId && !!yearMonth,
  });
}

export function useStamp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      staffId: string;
      shopId: string;
      stampType: 'clock_in' | 'clock_out';
      timestamp?: Date;
    }) => {
      await delay(500);
      return { success: true, timestamp: new Date() };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['attendances', 'today', variables.shopId],
      });
    },
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      staffId: string;
      shopId: string;
      date: string;
      clockIn: Date;
      clockOut?: Date;
    }) => {
      await delay(400);
      return { success: true, attendanceId: `att-${Date.now()}` };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['attendances', 'date', variables.shopId, variables.date],
      });
    },
  });
}

// ============ Correction Requests ============

export function useCorrectionRequests(shopId: string | null) {
  return useQuery({
    queryKey: ['correctionRequests', shopId],
    queryFn: async (): Promise<CorrectionRequest[]> => {
      await delay(300);
      return MOCK_CORRECTION_REQUESTS.filter(r => !shopId || r.staffId);
    },
    enabled: !!shopId,
  });
}

export function useCreateCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      attendanceId: string;
      requestedStampType: 'clock_in' | 'clock_out';
      requestedTime: string;
      reason: string;
    }) => {
      await delay(400);
      return { success: true, requestId: `req-${Date.now()}` };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['correctionRequests'],
      });
    },
  });
}

export function useApproveCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      requestId: string;
    }) => {
      await delay(400);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['correctionRequests'],
      });
      queryClient.invalidateQueries({
        queryKey: ['attendances'],
      });
    },
  });
}

export function useRejectCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      requestId: string;
      rejectionReason: string;
    }) => {
      await delay(400);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['correctionRequests'],
      });
    },
  });
}

// ============ Shifts ============

export function useShifts(shopId: string | null, yearMonth: string) {
  return useQuery({
    queryKey: ['shifts', shopId, yearMonth],
    queryFn: async (): Promise<Shift[]> => {
      await delay(300);
      return MOCK_SHIFTS.filter(s => !shopId || s.shopId === shopId);
    },
    enabled: !!shopId && !!yearMonth,
  });
}

export function useShiftsByDate(shopId: string | null, date: string) {
  return useQuery({
    queryKey: ['shifts', 'date', shopId, date],
    queryFn: async (): Promise<Shift[]> => {
      await delay(200);
      return MOCK_SHIFTS.filter(s => s.date === date && (!shopId || s.shopId === shopId));
    },
    enabled: !!shopId && !!date,
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      shopId: string;
      staffId: string;
      date: string;
      startTime: string;
      endTime: string;
      breakMinutes?: number;
    }) => {
      await delay(400);
      return { success: true, shiftId: `shift-${Date.now()}` };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['shifts', 'date', variables.shopId, variables.date],
      });
      queryClient.invalidateQueries({
        queryKey: ['shifts', variables.shopId],
      });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      shiftId: string;
      shopId: string;
      date: string;
      startTime?: string;
      endTime?: string;
      breakMinutes?: number;
    }) => {
      await delay(400);
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['shifts', 'date', variables.shopId, variables.date],
      });
      queryClient.invalidateQueries({
        queryKey: ['shifts', variables.shopId],
      });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_: {
      shiftId: string;
      shopId: string;
      date: string;
    }) => {
      await delay(300);
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['shifts', 'date', variables.shopId, variables.date],
      });
      queryClient.invalidateQueries({
        queryKey: ['shifts', variables.shopId],
      });
    },
  });
}
