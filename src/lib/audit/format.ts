export type AuditMetadata = Record<string, unknown>;
export type AuditChange = {
  key: string;
  before: unknown;
  after: unknown;
};

const externalApiKeyDetailFields = ['name', 'scopes', 'expires_at', 'is_active'] as const;

export const auditActionLabels: Record<string, string> = {
  'attendance_request.approved': '打刻修正申請を承認',
  'attendance_request.rejected': '打刻修正申請を却下',
  'external_api_key.issued': '外部連携APIキーを発行',
  'external_api_key.deactivated': '外部連携APIキーを無効化',
  'line_account.linked': 'LINEアカウントを連携',
  'line_account.revoked': 'LINEアカウント連携を解除',
};

export const auditFieldLabels: Record<string, string> = {
  status: '状態',
  name: 'キー名',
  scopes: '許可スコープ',
  clock_in_at: '出勤時刻',
  clock_out_at: '退勤時刻',
  break_minutes: '休憩時間（分）',
  total_work_minutes: '勤務時間（分）',
  is_manual: '手入力・修正',
  is_active: '有効状態',
  note: '補足',
  review_comment: '確認コメント',
  reviewed_at: '確認日時',
  reviewed_by_user_id: '確認者',
  attendance_record_id: '勤怠レコード',
  expires_at: '有効期限',
  staff_id: 'スタッフ',
  linked_at: 'LINE連携日時',
};

export function isAuditMetadata(value: unknown): value is AuditMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getAuditChanges(metadata: AuditMetadata): AuditChange[] {
  const before = isAuditMetadata(metadata.before) ? metadata.before : {};
  const after = isAuditMetadata(metadata.after) ? metadata.after : {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return keys
    .filter((key) => formatAuditValue(before[key]) !== formatAuditValue(after[key]))
    .map((key) => ({
      key,
      before: before[key],
      after: after[key],
    }));
}

export function getAuditDetailRows(action: string, metadata: AuditMetadata): AuditChange[] {
  if (!action.startsWith('external_api_key.')) return [];
  if (getAuditChanges(metadata).length > 0) return [];

  return externalApiKeyDetailFields
    .filter((field) => metadata[field] !== undefined)
    .map((field) => ({
      key: field,
      before: action === 'external_api_key.deactivated' && field === 'is_active' ? true : undefined,
      after: metadata[field],
    }));
}

export function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '未設定';
  if (Array.isArray(value)) {
    return value.length === 0
      ? '未設定'
      : value
          .map((item) => {
            if (item === null || item === undefined || item === '') return '未設定';
            if (typeof item === 'boolean') return item ? 'はい' : 'いいえ';
            if (typeof item === 'object') return JSON.stringify(item);
            return String(item);
          })
          .join(', ');
  }
  if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
