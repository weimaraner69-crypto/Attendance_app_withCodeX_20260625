'use server';

import { revalidatePath } from 'next/cache';

import { requireAuthenticatedRole } from '@/lib/auth/session';
import {
  externalApiKeyDeactivationSuccess,
  externalApiKeyIssueSuccess,
  prepareExternalApiKey,
  validateExternalApiKeyIssueInput,
  type ExternalApiKeyDeactivationActionState,
  type ExternalApiKeyIssueActionState,
} from '@/lib/external-api/key-management';
import { createSupabaseAdminClient } from '@/lib/supabase';

const apiKeysPath = '/owner/integrations/api-keys';

type ExternalApiKeyAuditTarget = {
  id: string;
  name: string;
  scopes: string[];
  expires_at: string | null;
  is_active: boolean;
};

async function writeExternalApiKeyAuditLog({
  organizationId,
  actorUserId,
  action,
  key,
}: {
  organizationId: string;
  actorUserId: string;
  action: 'external_api_key.issued' | 'external_api_key.deactivated';
  key: ExternalApiKeyAuditTarget;
}) {
  try {
    const { error } = await createSupabaseAdminClient().from('audit_logs').insert({
      organization_id: organizationId,
      actor_user_id: actorUserId,
      action,
      target_table: 'external_api_keys',
      target_id: key.id,
      metadata: {
        name: key.name,
        scopes: key.scopes,
        expires_at: key.expires_at,
        is_active: key.is_active,
      },
    });
    return !error;
  } catch {
    return false;
  }
}

export async function issueExternalApiKeyAction(
  formData: FormData
): Promise<ExternalApiKeyIssueActionState> {
  const context = await requireAuthenticatedRole(['owner']);
  const validation = validateExternalApiKeyIssueInput({
    name: formData.get('name')?.toString() ?? '',
    scopes: formData.getAll('scopes').map((scope) => scope.toString()),
    expiresOnJst: formData.get('expires_on_jst')?.toString() ?? '',
  });

  if (!validation.ok) return { status: 'error', message: validation.message };

  const prepared = prepareExternalApiKey(validation.value);
  const supabase = createSupabaseAdminClient();
  const { data: insertedKey, error } = await supabase
    .from('external_api_keys')
    .insert({
      organization_id: context.profile.organization_id,
      ...prepared.record,
      is_active: true,
    })
    .select('id, name, scopes, expires_at, is_active')
    .single<ExternalApiKeyAuditTarget>();

  if (error || !insertedKey) {
    return { status: 'error', message: 'APIキーを発行できませんでした。入力内容を確認してください。' };
  }

  const auditRecorded = await writeExternalApiKeyAuditLog({
    organizationId: context.profile.organization_id,
    actorUserId: context.user.id,
    action: 'external_api_key.issued',
    key: insertedKey,
  });
  revalidatePath(apiKeysPath);

  return externalApiKeyIssueSuccess(
    prepared.rawApiKey,
    auditRecorded ? undefined : 'APIキーは発行されましたが、監査ログの記録に失敗しました。'
  );
}

export async function deactivateExternalApiKeyAction(
  formData: FormData
): Promise<ExternalApiKeyDeactivationActionState> {
  const context = await requireAuthenticatedRole(['owner']);
  const keyId = formData.get('key_id')?.toString().trim() ?? '';
  if (!keyId) return { status: 'error', message: '対象のAPIキーを特定できませんでした。' };

  const supabase = createSupabaseAdminClient();
  const { data: existingKey } = await supabase
    .from('external_api_keys')
    .select('id, name, scopes, expires_at, is_active')
    .eq('id', keyId)
    .eq('organization_id', context.profile.organization_id)
    .eq('is_active', true)
    .maybeSingle<ExternalApiKeyAuditTarget>();

  if (!existingKey) {
    return { status: 'error', message: '対象のAPIキーは無効化できませんでした。' };
  }

  const { data: deactivatedKey, error } = await supabase
    .from('external_api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('organization_id', context.profile.organization_id)
    .eq('is_active', true)
    .select('id, name, scopes, expires_at, is_active')
    .maybeSingle<ExternalApiKeyAuditTarget>();

  if (error || !deactivatedKey) {
    return { status: 'error', message: 'APIキーを無効化できませんでした。' };
  }

  const auditRecorded = await writeExternalApiKeyAuditLog({
    organizationId: context.profile.organization_id,
    actorUserId: context.user.id,
    action: 'external_api_key.deactivated',
    key: deactivatedKey,
  });
  revalidatePath(apiKeysPath);

  return externalApiKeyDeactivationSuccess(
    auditRecorded ? undefined : 'APIキーは無効化されましたが、監査ログの記録に失敗しました。'
  );
}
