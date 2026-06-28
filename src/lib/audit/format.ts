export type AuditMetadata = Record<string, unknown>;

export const auditActionLabels: Record<string, string> = {
  'attendance_request.approved': '打刻修正申請を承認',
  'attendance_request.rejected': '打刻修正申請を却下',
};

export const auditFieldLabels: Record<string, string> = {
  status: '状態',
  clock_in_at: '出勤時刻',
  clock_out_at: '退勤時刻',
  break_minutes: '休憩時間（分）',
  total_work_minutes: '勤務時間（分）',
  is_manual: '手入力・修正',
  note: '補足',
  review_comment: '確認コメント',
  reviewed_at: '確認日時',
  reviewed_by_user_id: '確認者',
  attendance_record_id: '勤怠レコード',
};

export function isAuditMetadata(value: unknown): value is AuditMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '未設定';
  if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
