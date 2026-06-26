create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid references public.user_profiles(id) on delete cascade,
  recipient_staff_id uuid references public.staff(id) on delete cascade,
  title text not null,
  body text not null,
  notification_type text not null,
  related_table text,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_user_id is not null or recipient_staff_id is not null)
);

create index idx_notifications_recipient_user
  on public.notifications (recipient_user_id, read_at, created_at desc);

create index idx_notifications_recipient_staff
  on public.notifications (recipient_staff_id, read_at, created_at desc);

alter table public.notifications enable row level security;

create policy "organization members can read own notifications"
on public.notifications for select
using (
  organization_id = public.current_user_organization_id()
  and (
    recipient_user_id = auth.uid()
    or exists (
      select 1
      from public.staff own_staff
      where own_staff.id = notifications.recipient_staff_id
        and own_staff.auth_user_id = auth.uid()
    )
    or public.current_user_role() in ('owner', 'manager')
  )
);

create policy "owners and managers can manage notifications"
on public.notifications for all
using (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
)
with check (
  public.current_user_role() in ('owner', 'manager')
  and organization_id = public.current_user_organization_id()
);
