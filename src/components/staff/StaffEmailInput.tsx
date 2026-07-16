import * as React from 'react';

import { Input } from '@/components/ui/input';

type StaffEmailInputProps = {
  authUserId: string | null;
  email: string | null;
  staffId: string;
  staffName: string;
};

export function StaffEmailInput({
  authUserId,
  email,
  staffId,
  staffName,
}: StaffEmailInputProps) {
  const linked = Boolean(authUserId);
  const hintId = `staff-email-${staffId}-hint`;

  return (
    <>
      <Input
        name="email"
        type="email"
        defaultValue={email ?? ''}
        placeholder="メール"
        aria-label={`${staffName} メール`}
        aria-describedby={linked ? hintId : undefined}
        readOnly={linked}
      />
      {linked && (
        <p id={hintId} className="text-xs text-gray-500">
          スマホログイン設定済みのため、メールアドレスは変更できません。
        </p>
      )}
    </>
  );
}
