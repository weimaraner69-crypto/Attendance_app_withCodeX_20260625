'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Screen = 'checking' | 'ready' | 'invalid' | 'success';

export default function OwnerPasswordPage() {
  const [screen, setScreen] = useState<Screen>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.race([
      fetch('/api/auth/owner-password', { cache: 'no-store' }),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 5000)),
    ])
      .then((response) => {
        if (active) setScreen(response?.ok ? 'ready' : 'invalid');
      })
      .catch(() => {
        if (active) setScreen('invalid');
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (password.length < 8) {
      setErrorMessage('パスワードは8文字以上で入力してください。');
      return;
    }
    if (password !== confirmation) {
      setErrorMessage('確認用パスワードが一致しません。');
      return;
    }

    setIsSubmitting(true);
    const response = await fetch('/api/auth/owner-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => null) as { retryable?: boolean } | null;
      setErrorMessage(result?.retryable
        ? '更新サービスが一時的に利用できません。この画面のまま、しばらくしてから再度お試しください。'
        : 'パスワードを更新できませんでした。新しいリンクでやり直してください。');
      setIsSubmitting(false);
      return;
    }
    setPassword('');
    setConfirmation('');
    setIsSubmitting(false);
    setScreen('success');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden="true" />
            オーナーパスワード設定
          </CardTitle>
          <CardDescription>管理画面へログインする新しいパスワードを設定します。</CardDescription>
        </CardHeader>
        <CardContent>
          {screen === 'checking' && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              リンクを確認しています...
            </div>
          )}
          {screen === 'invalid' && (
            <div className="space-y-4">
              <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                リンクが無効か、有効期限が切れています。新しい再設定メールを申請してください。
              </p>
              <Link
                href="/owner/password-recovery"
                className={buttonVariants({ variant: 'outline', className: 'w-full' })}
              >
                再設定メールを申請
              </Link>
            </div>
          )}
          {screen === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="owner-password">新しいパスワード</Label>
                <Input
                  id="owner-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-password-confirmation">パスワードをもう一度入力</Label>
                <Input
                  id="owner-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                />
              </div>
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? '設定中...' : 'パスワードを設定'}
              </Button>
            </form>
          )}
          {screen === 'success' && (
            <div className="space-y-4">
              <p role="status" className="flex items-center gap-2 border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                パスワードを設定しました。新しいパスワードでログインしてください。
              </p>
              <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
                オーナーログインへ
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
