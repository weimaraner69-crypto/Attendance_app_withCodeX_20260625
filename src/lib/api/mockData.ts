import type { Shop, Staff, AttendanceRecord, Shift, CorrectionRequest } from '@/types';

export const MOCK_SHOPS: Shop[] = [
  {
    id: 'shop-1',
    name: '店舗A',
    address: '東京都千代田区丸の内1-1',
    latitude: 35.6812,
    longitude: 139.7671,
    gpsRadiusMeters: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'shop-2',
    name: '店舗B',
    address: '東京都渋谷区道玄坂1-1',
    latitude: 35.6895,
    longitude: 139.6917,
    gpsRadiusMeters: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'shop-3',
    name: '店舗C',
    address: '東京都港区六本木1-1',
    latitude: 35.6586,
    longitude: 139.7454,
    gpsRadiusMeters: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const MOCK_STAFF: Staff[] = [
  { id: 'staff-1', name: '田中 太郎', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'staff-2', name: '佐藤 花子', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'staff-3', name: '山田 次郎', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'staff-4', name: '鈴木 三郎', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 'staff-5', name: '高橋 四郎', isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

const now = new Date();
const attendanceDate = now.toISOString().split('T')[0];

export const MOCK_ATTENDANCES: AttendanceRecord[] = [
  {
    id: 'att-1',
    staffId: 'staff-1',
    staffName: '田中 太郎',
    shopId: 'shop-1',
    shopName: '店舗A',
    date: attendanceDate,
    clockIn: new Date(now.getTime() - 3 * 3600000),
    clockOut: null,
    status: 'working',
    nightShiftMinutes: 0,
    totalWorkMinutes: 180,
    isManual: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'att-2',
    staffId: 'staff-2',
    staffName: '佐藤 花子',
    shopId: 'shop-1',
    shopName: '店舗A',
    date: attendanceDate,
    clockIn: new Date(now.getTime() - 2 * 3600000),
    clockOut: null,
    status: 'working',
    nightShiftMinutes: 0,
    totalWorkMinutes: 120,
    isManual: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const MOCK_CORRECTION_REQUESTS: CorrectionRequest[] = [
  {
    id: 'req-1',
    attendanceId: 'att-1',
    staffId: 'staff-1',
    staffName: '田中 太郎',
    targetDate: attendanceDate,
    requestedStampType: 'clock_in',
    requestedTime: '09:05',
    reason: '打刻し忘れました',
    status: 'pending',
    createdAt: new Date(),
  },
];

export const MOCK_SHIFTS: Shift[] = [
  {
    id: 'shift-1',
    shopId: 'shop-1',
    staffId: 'staff-1',
    staffName: '田中 太郎',
    date: attendanceDate,
    startTime: '09:00',
    endTime: '17:00',
    isOvernight: false,
    breakMinutes: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'shift-2',
    shopId: 'shop-1',
    staffId: 'staff-2',
    staffName: '佐藤 花子',
    date: attendanceDate,
    startTime: '10:00',
    endTime: '18:00',
    isOvernight: false,
    breakMinutes: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
