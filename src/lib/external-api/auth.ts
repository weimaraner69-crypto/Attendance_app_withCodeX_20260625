import { createHash } from 'crypto';

import { createSupabaseAdminClient } from '@/lib/supabase';

import { externalApiError } from './responses';

type ExternalApiKeyRow = {
  id: string;
  organization_id: string;
  name: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  timezone: string;
};

export type ExternalApiContext = {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  apiKey: {
    id: string;
    name: string;
    scopes: string[];
  };
  organization: OrganizationRow;
};

export type ExternalApiAuthResult =
  | { ok: true; context: ExternalApiContext }
  | { ok: false; response: Response };

export function hashExternalApiKey(apiKey: string) {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

export async function authenticateExternalApiRequest(
  request: Request,
  requiredScope = 'attendance:read'
): Promise<ExternalApiAuthResult> {
  const rawApiKey = request.headers.get('x-external-api-key')?.trim();

  if (!rawApiKey) {
    return {
      ok: false,
      response: externalApiError(401, 'UNAUTHENTICATED', 'APIキーが指定されていません'),
    };
  }

  const supabase = createSupabaseAdminClient();
  const keyHash = hashExternalApiKey(rawApiKey);

  const { data: apiKey, error: apiKeyError } = await supabase
    .from('external_api_keys')
    .select('id, organization_id, name, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle<ExternalApiKeyRow>();

  if (apiKeyError) {
    return {
      ok: false,
      response: externalApiError(500, 'INTERNAL_ERROR', 'APIキーの確認に失敗しました'),
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      response: externalApiError(401, 'UNAUTHENTICATED', 'APIキーが無効です'),
    };
  }

  if (!apiKey.is_active) {
    return {
      ok: false,
      response: externalApiError(403, 'FORBIDDEN', 'APIキーが無効化されています'),
    };
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at).getTime() <= Date.now()) {
    return {
      ok: false,
      response: externalApiError(401, 'UNAUTHENTICATED', 'APIキーの有効期限が切れています'),
    };
  }

  if (!apiKey.scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: externalApiError(403, 'FORBIDDEN', '必要なスコープがありません'),
    };
  }

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name, timezone')
    .eq('id', apiKey.organization_id)
    .single<OrganizationRow>();

  if (organizationError || !organization) {
    return {
      ok: false,
      response: externalApiError(500, 'INTERNAL_ERROR', '組織情報の取得に失敗しました'),
    };
  }

  await supabase
    .from('external_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id);

  return {
    ok: true,
    context: {
      supabase,
      organization,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        scopes: apiKey.scopes,
      },
    },
  };
}
