import { createSupabaseAdminClient } from '@/lib/supabase';
import { isLineConfigured, pushLineText } from '@/lib/line/messaging';

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
  const { data: lineAccount } = input.recipientStaffId && isLineConfigured()
    ? await supabase
        .from('line_accounts')
        .select('line_user_id')
        .eq('organization_id', input.organizationId)
        .eq('staff_id', input.recipientStaffId)
        .eq('status', 'linked')
        .maybeSingle()
    : { data: null };

  const { data: notification, error } = await supabase
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
      line_delivery_status: lineAccount ? 'pending' : 'not_applicable',
    })
    .select('id')
    .single();

  if (error || !notification) {
    throw new Error(`通知の保存に失敗しました: ${error?.message ?? 'unknown error'}`);
  }

  if (!lineAccount) return;

  try {
    await pushLineText(lineAccount.line_user_id, `${input.title}\n${input.body}`);
    await supabase
      .from('notifications')
      .update({
        line_delivery_status: 'delivered',
        line_delivered_at: new Date().toISOString(),
        line_delivery_error: null,
      })
      .eq('id', notification.id);
  } catch {
    await supabase
      .from('notifications')
      .update({
        line_delivery_status: 'failed',
        line_delivery_error: 'LINE Messaging APIへの送信に失敗しました',
      })
      .eq('id', notification.id);
  }
}

export async function createStaffNotification(input: Omit<CreateNotificationInput, 'recipientUserId'>) {
  await createNotification(input);
}
