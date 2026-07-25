import Link from 'next/link';

import { ExternalApiKeyManager, type ExternalApiKeyListItem } from '@/components/integrations/ExternalApiKeyManager';
import { buttonVariants } from '@/components/ui/button';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

export default async function OwnerExternalApiKeysPage() {
  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_api_keys')
    .select('id, name, scopes, is_active, last_used_at, created_at, expires_at')
    .eq('organization_id', context.profile.organization_id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">外部連携APIキー</h2>
          <p className="mt-1 text-sm text-gray-600">日報アプリなどの外部連携先に対する参照用APIキーを管理します。</p>
        </div>
        <Link href="/owner" className={buttonVariants({ variant: 'outline' })}>戻る</Link>
      </div>
      {error ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          発行済みAPIキーの取得に失敗しました。キーの状態を確認できないため、発行・無効化は行えません。時間を置いて再読み込みしてください。
        </div>
      ) : (
        <ExternalApiKeyManager keys={(data ?? []) as ExternalApiKeyListItem[]} />
      )}
    </div>
  );
}
