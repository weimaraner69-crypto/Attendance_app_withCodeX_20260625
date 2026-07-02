-- Add a four-digit PIN for privileged-user reauthentication.
-- The initial Supabase email/password authentication remains the primary factor.

create table public.user_login_pins (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pin_hash text not null,
  pin_updated_at timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.user_login_pins.pin_hash is
  'Scrypt hash used only for six-hour device reauthentication.';
comment on column public.user_login_pins.locked_until is
  'Temporary lock after repeated invalid PIN attempts.';

create index idx_user_login_pins_organization
  on public.user_login_pins (organization_id);

alter table public.user_login_pins enable row level security;

-- Intentionally no client RLS policies. Only the server-side service role may
-- create, read, or update privileged login PIN credentials.
