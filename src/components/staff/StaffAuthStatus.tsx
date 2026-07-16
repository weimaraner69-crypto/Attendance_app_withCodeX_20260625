import { createElement, type HTMLAttributes } from 'react';

export type StaffAuthStatusKind = 'success' | 'error' | 'partial-success';
export type StaffAuthAction = 'invite' | 'reset';

type StaffAuthStatusProps = Omit<HTMLAttributes<HTMLParagraphElement>, 'role'> & {
  kind: StaffAuthStatusKind;
  message: string;
};

const statusClasses: Record<StaffAuthStatusKind, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  'partial-success': 'border-amber-200 bg-amber-50 text-amber-800',
};

export function StaffAuthStatus({ kind, message, className, ...props }: StaffAuthStatusProps) {
  const classes = ['border p-3 text-sm', statusClasses[kind], className]
    .filter(Boolean)
    .join(' ');

  return createElement(
    'p',
    {
      ...props,
      className: classes,
      role: kind === 'success' ? 'status' : 'alert',
      'aria-atomic': 'true',
    },
    message
  );
}

export function getStaffAuthActionLabel(action: StaffAuthAction, staffName: string) {
  const name = staffName.trim() || '対象スタッフ';
  return action === 'invite'
    ? `${name}に招待メールを送信`
    : `${name}に再設定メールを送信`;
}
