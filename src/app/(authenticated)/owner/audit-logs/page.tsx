import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  auditActionLabels,
  auditFieldLabels,
  formatAuditValue,
  isAuditMetadata,
  type AuditMetadata,
} from '@/lib/audit/format';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase';

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: unknown;
  created_at: string;
};

type ActorRow = {
  id: string;
  display_name: string;
  email: string;
};

function getStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function getChanges(metadata: AuditMetadata) {
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

export default async function OwnerAuditLogsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const action = getStringParam(searchParams.action);
  const from = getStringParam(searchParams.from);
  const to = getStringParam(searchParams.to);

  let query = supabase
    .from('audit_logs')
    .select('id, actor_user_id, action, target_table, target_id, metadata, created_at')
    .eq('organization_id', context.profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (action) query = query.eq('action', action);
  if (from) query = query.gte('created_at', `${from}T00:00:00+09:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59.999+09:00`);

  const { data } = await query;
  const logs = (data ?? []) as AuditLogRow[];
  const actorIds = Array.from(new Set(logs.map((log) => log.actor_user_id).filter(Boolean))) as string[];
  const { data: actorsData } = actorIds.length
    ? await supabase.from('user_profiles').select('id, display_name, email').in('id', actorIds)
    : { data: [] };
  const actors = new Map(((actorsData ?? []) as ActorRow[]).map((actor) => [actor.id, actor]));
  const actions = Array.from(new Set(logs.map((log) => log.action))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">監査ログ</h2>
          <p className="mt-1 text-sm text-gray-600">重要操作の実行者、日時、変更前後を確認します。</p>
        </div>
        <Link href="/owner" className={buttonVariants({ variant: 'outline' })}>
          戻る
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>絞り込み</CardTitle>
          <CardDescription>最大200件を新しい順に表示します。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="audit-from">開始日</Label>
              <Input id="audit-from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-to">終了日</Label>
              <Input id="audit-to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-action">操作</Label>
              <select
                id="audit-action"
                name="action"
                defaultValue={action}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="">すべて</option>
                {actions.map((item) => (
                  <option key={item} value={item}>{auditActionLabels[item] ?? item}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">表示</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {logs.map((log) => {
          const actor = log.actor_user_id ? actors.get(log.actor_user_id) : null;
          const metadata = isAuditMetadata(log.metadata) ? log.metadata : {};
          const changes = getChanges(metadata);

          return (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-lg">{auditActionLabels[log.action] ?? log.action}</CardTitle>
                    <CardDescription>
                      {new Intl.DateTimeFormat('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        dateStyle: 'medium',
                        timeStyle: 'medium',
                      }).format(new Date(log.created_at))}
                      {' / '}
                      {actor?.display_name ?? actor?.email ?? 'システム・不明'}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {log.target_table && <Badge variant="outline">{log.target_table}</Badge>}
                    {log.target_id && <Badge variant="secondary">{log.target_id}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {changes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">項目</th>
                          <th className="px-2 py-2">変更前</th>
                          <th className="px-2 py-2">変更後</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((change) => (
                          <tr key={change.key} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">
                              {auditFieldLabels[change.key] ?? change.key}
                            </td>
                            <td className="px-2 py-2 text-gray-600">{formatAuditValue(change.before)}</td>
                            <td className="px-2 py-2">{formatAuditValue(change.after)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">変更前後の詳細がない既存ログです。</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {logs.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500">
              条件に一致する監査ログはありません。
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
