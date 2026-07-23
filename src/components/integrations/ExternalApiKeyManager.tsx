'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  deactivateExternalApiKeyAction,
  issueExternalApiKeyAction,
} from '@/app/(authenticated)/owner/integrations/api-keys/actions';
import type {
  ExternalApiKeyDeactivationActionState,
  ExternalApiKeyIssueActionState,
} from '@/lib/external-api/key-management';

export type ExternalApiKeyListItem = {
  id: string;
  name: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : '未使用・未設定';
}

export function ExternalApiKeyManager({ keys }: { keys: ExternalApiKeyListItem[] }) {
  const router = useRouter();
  const [issueState, setIssueState] = useState<ExternalApiKeyIssueActionState>({ status: 'idle' });
  const [deactivationState, setDeactivationState] = useState<ExternalApiKeyDeactivationActionState | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  async function handleIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsIssuing(true);
    const result = await issueExternalApiKeyAction(new FormData(event.currentTarget));
    setIssueState(result);
    setIsIssuing(false);

    if (result.status === 'success') {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  async function handleDeactivate(event: React.FormEvent<HTMLFormElement>, keyId: string) {
    event.preventDefault();
    setDeactivatingId(keyId);
    const result = await deactivateExternalApiKeyAction(new FormData(event.currentTarget));
    setDeactivationState(result);
    setDeactivatingId(null);
    router.refresh();
  }

  async function copyIssuedKey() {
    if (issueState.status !== 'success' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(issueState.apiKey);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>APIキーを発行</CardTitle>
          <CardDescription>外部連携先ごとに発行します。キーの値は発行後、この画面で一度だけ表示されます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleIssue} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">キー名</Label>
              <Input id="api-key-name" name="name" maxLength={100} required placeholder="日報アプリ" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">スコープ</legend>
              <label className="flex h-8 items-center gap-2 text-sm">
                <input name="scopes" type="checkbox" value="attendance:read" defaultChecked />
                勤怠データの参照
              </label>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="api-key-expires-on">有効期限（JST・任意）</Label>
              <Input id="api-key-expires-on" name="expires_on_jst" type="date" />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={isIssuing}>{isIssuing ? '発行中...' : '発行する'}</Button>
            </div>
          </form>

          {issueState.status === 'error' && (
            <p role="alert" className="text-sm text-destructive">{issueState.message}</p>
          )}
          {issueState.status === 'success' && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="font-medium text-amber-950">発行したAPIキー</p>
              <code className="block overflow-x-auto rounded border bg-white p-3 text-sm text-gray-900">{issueState.apiKey}</code>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={copyIssuedKey}>
                  <Copy aria-hidden="true" /> コピー
                </Button>
                <p className="text-sm text-amber-950">このキーは再表示できません。連携先へ安全に保管してください。</p>
              </div>
              {issueState.warning && <p role="alert" className="text-sm text-amber-950">{issueState.warning}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>発行済みAPIキー</CardTitle>
          <CardDescription>キーの値やハッシュは一覧に表示されません。</CardDescription>
        </CardHeader>
        <CardContent>
          {deactivationState?.status === 'error' && (
            <p role="alert" className="mb-4 text-sm text-destructive">{deactivationState.message}</p>
          )}
          {deactivationState?.status === 'success' && deactivationState.warning && (
            <p role="alert" className="mb-4 text-sm text-amber-900">{deactivationState.warning}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 font-medium">名前</th>
                  <th className="px-2 py-2 font-medium">スコープ</th>
                  <th className="px-2 py-2 font-medium">状態</th>
                  <th className="px-2 py-2 font-medium">最終利用</th>
                  <th className="px-2 py-2 font-medium">作成日時</th>
                  <th className="px-2 py-2 font-medium">有効期限</th>
                  <th className="px-2 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className="border-b last:border-0">
                    <td className="px-2 py-3 font-medium">{key.name}</td>
                    <td className="px-2 py-3">{key.scopes.join(', ')}</td>
                    <td className="px-2 py-3">
                      <Badge variant={key.is_active ? 'secondary' : 'outline'}>{key.is_active ? '有効' : '無効'}</Badge>
                    </td>
                    <td className="px-2 py-3">{formatDateTime(key.last_used_at)}</td>
                    <td className="px-2 py-3">{formatDateTime(key.created_at)}</td>
                    <td className="px-2 py-3">{key.expires_at ? formatDateTime(key.expires_at) : '無期限'}</td>
                    <td className="px-2 py-3 text-right">
                      {key.is_active && (
                        <form onSubmit={(event) => handleDeactivate(event, key.id)}>
                          <input type="hidden" name="key_id" value={key.id} />
                          <Button type="submit" variant="destructive" disabled={deactivatingId === key.id}>
                            {deactivatingId === key.id ? '無効化中...' : '無効化'}
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">発行済みのAPIキーはありません。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
