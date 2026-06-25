-- External read API keys for daily-report app integration.

create table public.external_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  scopes text[] not null default '{attendance:read}',
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_external_api_keys_updated_at before update on public.external_api_keys
  for each row execute function public.set_updated_at();

create index idx_external_api_keys_org_active
  on public.external_api_keys (organization_id, is_active);

create index idx_external_api_keys_expires_at
  on public.external_api_keys (expires_at);

alter table public.external_api_keys enable row level security;
