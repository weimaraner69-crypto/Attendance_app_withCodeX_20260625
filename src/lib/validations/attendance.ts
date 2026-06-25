import { calculateWorkMinutes } from '@/lib/utils/dateUtils';

export function validateStampTime(
  startTime: Date,
  currentTime: Date = new Date()
): {
  isValid: boolean;
  message: string;
} {
  const timeDiff = Math.abs(currentTime.getTime() - startTime.getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    return {
      isValid: false,
      message: '24時間以上の時差があります。修正申請をしてください。',
    };
  }

  return {
    isValid: true,
    message: '',
  };
}

export function validateWorkTime(
  startTime: Date,
  endTime: Date,
  breakMinutes: number = 0
): {
  isValid: boolean;
  message: string;
  workMinutes: number;
} {
  if (startTime >= endTime) {
    return {
      isValid: false,
      message: '開始時刻が終了時刻より後になっています',
      workMinutes: 0,
    };
  }

  const workMinutes = calculateWorkMinutes(startTime, endTime, breakMinutes);

  if (workMinutes < 15) {
    return {
      isValid: false,
      message: '勤務時間が短すぎます（最小15分）',
      workMinutes,
    };
  }

  return {
    isValid: true,
    message: '',
    workMinutes,
  };
}

export function validateCorrectionRequest(
  requestedTime: string,
  reason: string
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!requestedTime || !/^\d{2}:\d{2}$/.test(requestedTime)) {
    errors.push('時刻の形式が正しくありません（HH:MM）');
  }

  if (!reason.trim()) {
    errors.push('修正理由を入力してください');
  }

  if (reason.trim().length < 5) {
    errors.push('修正理由は5文字以上で入力してください');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
