'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  isValidStaffPasswordSession,
  type StaffPasswordSession,
} from '@/lib/auth/staff-auth';

type Screen = 'checking' | 'ready' | 'invalid' | 'success';

export default function StaffPasswordPage() {
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [screen, setScreen] = useState<Screen>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;

    try {
      supabase = createSupabaseBrowserClient();
      supabaseRef.current = supabase;
    } catch {
      setScreen('invalid');
      return () => {
        active = false;
      };
    }

    const validateSession = async () => {
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 5000)),
        ]);
        if (!active) return;
        if (!sessionResult || sessionResult.error || !sessionResult.data.session) {
          setScreen('invalid');
          return;
        }

        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const session = (await response.json().catch(() => ({}))) as StaffPasswordSession;
        if (!active) return;

        if (
          !response.ok ||
          !isValidStaffPasswordSession(session)
        ) {
          await supabase.auth.signOut({ scope: 'local' });
          if (active) setScreen('invalid');
          return;
        }

        setScreen('ready');
      } catch {
        if (active) setScreen('invalid');
      }
    };

    void validateSession();
    return () => {
      active = false;
      if (supabaseRef.current === supabase) {
        supabaseRef.current = null;
      }
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

    const supabase = supabaseRef.current;
    if (!supabase) {
      setErrorMessage('セッションを確認できませんでした。新しいリンクでやり直してください。');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMessage('パスワードを更新できませんでした。新しいリンクでやり直してください。');
      setIsSubmitting(false);
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
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
            スタッフパスワード設定
          </CardTitle>
          <CardDescription>個人スマホで使うログインパスワードを設定します。</CardDescription>
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
                リンクが無効か、有効期限が切れています。オーナーに新しい再設定メールを依頼してください。
              </p>
              <Link
                href="/login"
                className={buttonVariants({ variant: 'outline', className: 'w-full' })}
              >
                ログイン画面へ
              </Link>
            </div>
          )}

          {screen === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-password">新しいパスワード</Label>
                <Input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password-confirmation">パスワードをもう一度入力</Label>
                <Input
                  id="staff-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                />
              </div>
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || password.length < 8 || confirmation.length < 8}
              >
                {isSubmitting ? '設定中...' : 'パスワードを設定'}
              </Button>
            </form>
          )}

          {screen === 'success' && (
            <div className="space-y-4">
              <p className="flex items-center gap-2 border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                パスワードを設定しました。新しいパスワードでログインしてください。
              </p>
              <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
                スタッフログインへ
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
