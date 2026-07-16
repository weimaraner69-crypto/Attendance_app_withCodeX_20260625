import Link from 'next/link';
import { KeyRound } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  searchParams: { token_hash?: string; type?: string };
};

export default function StaffAuthConfirmPage({ searchParams }: Props) {
  const tokenHash = searchParams.token_hash?.trim() ?? '';
  const type = searchParams.type === 'invite' || searchParams.type === 'recovery'
    ? searchParams.type
    : '';
  const valid = Boolean(tokenHash && type);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden="true" />
            スタッフ認証
          </CardTitle>
          <CardDescription>本人確認後、パスワード設定へ進みます。</CardDescription>
        </CardHeader>
        <CardContent>
          {valid ? (
            <form action="/auth/confirm/complete" method="post">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <Button type="submit" className="w-full">本人確認を続ける</Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                リンクが無効です。オーナーに新しいメールを依頼してください。
              </p>
              <Link href="/login" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
                ログイン画面へ
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
