import Link from 'next/link';
import { KeyRound } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  searchParams: { token_hash?: string; type?: string };
};

export default function OwnerAuthConfirmPage({ searchParams }: Props) {
  const tokenHash = searchParams.token_hash?.trim() ?? '';
  const valid = Boolean(tokenHash && searchParams.type === 'recovery');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" aria-hidden="true" />
            オーナー本人確認
          </CardTitle>
          <CardDescription>本人確認後、新しいパスワードの設定へ進みます。</CardDescription>
        </CardHeader>
        <CardContent>
          {valid ? (
            <form action="/auth/owner-confirm/complete" method="post">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="recovery" />
              <Button type="submit" className="w-full">本人確認を続ける</Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                リンクが無効です。新しい再設定メールを申請してください。
              </p>
              <Link
                href="/owner/password-recovery"
                className={buttonVariants({ variant: 'outline', className: 'w-full' })}
              >
                再設定メールを申請
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
