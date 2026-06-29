create table public.line_link_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  line_account_id uuid not null references public.line_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_line_link_tokens_account_expires
  on public.line_link_tokens (line_account_id, expires_at desc);

alter table public.line_link_tokens enable row level security;

alter table public.notifications
  add column line_delivery_status text not null default 'not_applicable'
    check (line_delivery_status in ('not_applicable', 'pending', 'delivered', 'failed')),
  add column line_delivered_at timestamptz,
  add column line_delivery_error text;

create index idx_notifications_line_delivery
  on public.notifications (line_delivery_status, created_at desc)
  where line_delivery_status <> 'not_applicable';
