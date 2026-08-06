'use client';

import Link from 'next/link';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OwnerPasswordRecoveryPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    await fetch('/api/auth/owner-password-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setEmail('');
    setRequested(true);
    setIsSubmitting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden="true" />
            オーナーパスワード再設定
          </CardTitle>
          <CardDescription>オーナーアカウントのメールアドレスを入力してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requested ? (
            <p role="status" className="border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              該当するオーナーアカウントがある場合、再設定メールを送信しました。
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="owner-recovery-email">メールアドレス</Label>
                <Input
                  id="owner-recovery-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? '送信中...' : '再設定メールを送信'}
              </Button>
            </form>
          )}
          <Link
            href="/login"
            className={buttonVariants({ variant: 'outline', className: 'w-full' })}
          >
            ログイン画面へ戻る
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
