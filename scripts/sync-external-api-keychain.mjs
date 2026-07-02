import { createHash } from 'crypto';
import { spawnSync } from 'child_process';

import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

const service = 'attendance-app.external-api';
const account = 'daily-report-production';
const organizationName = '株式会社樫尾商店';
const apiKeyName = '日報アプリ本番';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Required Supabase server environment variables are not configured.');
  process.exit(1);
}

const keyResult = spawnSync(
  'security',
  ['find-generic-password', '-s', service, '-a', account, '-w'],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  },
);

if (keyResult.status !== 0) {
  console.error('External API key was not found in macOS Keychain.');
  process.exit(keyResult.status ?? 1);
}

const keyHash = createHash('sha256')
  .update(keyResult.stdout.trim(), 'utf8')
  .digest('hex');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: organization, error: organizationError } = await supabase
  .from('organizations')
  .select('id')
  .eq('name', organizationName)
  .single();

if (organizationError || !organization) {
  console.error('Target organization was not found.');
  process.exit(1);
}

const { data: existingKey, error: existingKeyError } = await supabase
  .from('external_api_keys')
  .select('id')
  .eq('organization_id', organization.id)
  .eq('name', apiKeyName)
  .maybeSingle();

if (existingKeyError) {
  console.error('Failed to inspect the existing external API key.');
  process.exit(1);
}

const payload = {
  organization_id: organization.id,
  name: apiKeyName,
  key_hash: keyHash,
  scopes: ['attendance:read'],
  is_active: true,
};

const syncResult = existingKey
  ? await supabase.from('external_api_keys').update(payload).eq('id', existingKey.id)
  : await supabase.from('external_api_keys').insert(payload);

if (syncResult.error) {
  console.error('Failed to synchronize the external API key hash.');
  process.exit(1);
}

console.log('External API key hash synchronized without displaying secret values.');
