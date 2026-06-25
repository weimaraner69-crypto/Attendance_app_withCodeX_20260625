// User & Auth
export type UserRole = 'owner' | 'manager' | 'sr' | 'staff';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  shopId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ManagerSession = {
  managerId: string;
  managerName: string;
  selectedShopId: string | null;
  shopName: string | null;
  loginTime: Date;
};

// Shop & Location
export type Shop = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  gpsRadiusMeters: number;
  createdAt: Date;
  updatedAt: Date;
};

// Staff
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary' | 'other';

export type Staff = {
  id: string;
  authUserId?: string | null;
  employeeCode?: string | null;
  name: string;
  nameKana?: string | null;
  employmentType?: EmploymentType | null;
  hourlyWage?: number | null;
  defaultShopId?: string | null;
  hasPin?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Attendance
export type AttendanceStatus = 'not_started' | 'working' | 'on_break' | 'finished';
export type AttendanceEventType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out';
export type AttendanceSource = 'kiosk' | 'mobile_web' | 'line' | 'admin_manual' | 'system';

export type AttendanceRecord = {
  id: string;
  staffId: string;
  staffName: string;
  shopId: string;
  shopName: string;
  date: string; // YYYY-MM-DD
  clockIn: Date | null;
  clockOut: Date | null;
  status: AttendanceStatus;
  nightShiftMinutes: number;
  breakMinutes?: number;
  totalWorkMinutes: number;
  isManual: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceEvent = {
  id: string;
  attendanceId?: string | null;
  staffId: string;
  shopId: string;
  eventType: AttendanceEventType;
  occurredAt: Date;
  source: AttendanceSource;
  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyMeters?: number | null;
  distanceFromShopMeters?: number | null;
  gpsVerified?: boolean | null;
  createdAt: Date;
};

// Shift
export type Shift = {
  id: string;
  shopId: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isOvernight: boolean;
  breakMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

// Correction Request
export type CorrectionRequestStatus = 'pending' | 'approved' | 'rejected';

export type CorrectionRequest = {
  id: string;
  attendanceId: string;
  staffId: string;
  staffName: string;
  targetDate: string; // YYYY-MM-DD
  requestedStampType: 'clock_in' | 'clock_out';
  requestedTime: string; // HH:MM
  reason: string;
  status: CorrectionRequestStatus;
  createdAt: Date;
  approvedAt?: Date;
  rejectionReason?: string;
};

// GPS
export type GpsValidation = {
  isValid: boolean;
  distance: number;
  message: string;
};

// API Response
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
