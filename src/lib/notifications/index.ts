import { createSupabaseAdminClient } from '@/lib/supabase';

type CreateNotificationInput = {
  organizationId: string;
  recipientUserId?: string | null;
  recipientStaffId?: string | null;
  title: string;
  body: string;
  notificationType: string;
  relatedTable?: string | null;
  relatedId?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  if (!input.recipientUserId && !input.recipientStaffId) return;

  const supabase = createSupabaseAdminClient();
  await supabase
    .from('notifications')
    .insert({
      organization_id: input.organizationId,
      recipient_user_id: input.recipientUserId ?? null,
      recipient_staff_id: input.recipientStaffId ?? null,
      title: input.title,
      body: input.body,
      notification_type: input.notificationType,
      related_table: input.relatedTable ?? null,
      related_id: input.relatedId ?? null,
    });
}

export async function createStaffNotification(input: Omit<CreateNotificationInput, 'recipientUserId'>) {
  await createNotification(input);
}
