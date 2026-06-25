import { createHash } from 'crypto';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { hashPin } from '@/lib/auth/pin';
import { createSupabaseAdminClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type EmploymentType = Database['public']['Enums']['employment_type'];

type StaffRow = {
  id: string;
  auth_user_id: string | null;
  default_store_id: string | null;
  employee_code: string | null;
  name: string;
  name_kana: string | null;
  employment_type: EmploymentType | null;
  hourly_wage: number | null;
  phone: string | null;
  email: string | null;
  pin_hash: string | null;
  is_active: boolean;
  joined_on: string | null;
  retired_on: string | null;
  updated_at: string;
};

type StoreRow = {
  id: string;
  name: string;
  is_active: boolean;
};

const employmentLabels: Record<EmploymentType, string> = {
  full_time: '正社員',
  part_time: 'アルバイト',
  contract: '契約社員',
  temporary: '派遣',
  other: 'その他',
};

function nullableText(value: FormDataEntryValue | null) {
  const text = value?.toString().trim() ?? '';
  return text.length > 0 ? text : null;
}

function requiredText(value: FormDataEntryValue | null) {
  return value?.toString().trim() ?? '';
}

function nullableNumber(value: FormDataEntryValue | null) {
  const text = value?.toString().trim() ?? '';
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function nullableEmploymentType(value: FormDataEntryValue | null) {
  const text = value?.toString() ?? '';
  return text ? (text as EmploymentType) : null;
}

function legacyPinFingerprint(pin: string) {
  return createHash('sha256').update(pin, 'utf8').digest('hex').slice(0, 8);
}

async function upsertCurrentStoreAssignment(
  organizationId: string,
  staffId: string,
  storeId: string | null
) {
  if (!storeId) return;

  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  await supabase
    .from('store_staff_assignments')
    .upsert(
      {
        organization_id: organizationId,
        staff_id: staffId,
        store_id: storeId,
        starts_on: today,
        ends_on: null,
      },
      { onConflict: 'store_id,staff_id,starts_on' }
    );
}

async function createStaff(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const name = requiredText(formData.get('name'));

  if (!name) return;

  const defaultStoreId = nullableText(formData.get('default_store_id'));
  const pin = nullableText(formData.get('pin'));
  const { data: staff } = await supabase
    .from('staff')
    .insert({
      organization_id: context.profile.organization_id,
      auth_user_id: nullableText(formData.get('auth_user_id')),
      default_store_id: defaultStoreId,
      employee_code: nullableText(formData.get('employee_code')),
      name,
      name_kana: nullableText(formData.get('name_kana')),
      employment_type: nullableEmploymentType(formData.get('employment_type')),
      hourly_wage: nullableNumber(formData.get('hourly_wage')),
      phone: nullableText(formData.get('phone')),
      email: nullableText(formData.get('email')),
      pin_hash: pin ? hashPin(pin) : null,
      pin_updated_at: pin ? new Date().toISOString() : null,
      joined_on: nullableText(formData.get('joined_on')),
      is_active: true,
    })
    .select('id')
    .single();

  if (staff) {
    await upsertCurrentStoreAssignment(context.profile.organization_id, staff.id, defaultStoreId);
  }

  revalidatePath('/owner/staff');
}

async function updateStaff(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const staffId = requiredText(formData.get('staff_id'));
  const name = requiredText(formData.get('name'));

  if (!staffId || !name) return;

  const defaultStoreId = nullableText(formData.get('default_store_id'));

  await supabase
    .from('staff')
    .update({
      auth_user_id: nullableText(formData.get('auth_user_id')),
      default_store_id: defaultStoreId,
      employee_code: nullableText(formData.get('employee_code')),
      name,
      name_kana: nullableText(formData.get('name_kana')),
      employment_type: nullableEmploymentType(formData.get('employment_type')),
      hourly_wage: nullableNumber(formData.get('hourly_wage')),
      phone: nullableText(formData.get('phone')),
      email: nullableText(formData.get('email')),
      joined_on: nullableText(formData.get('joined_on')),
      retired_on: nullableText(formData.get('retired_on')),
    })
    .eq('id', staffId)
    .eq('organization_id', context.profile.organization_id);

  await upsertCurrentStoreAssignment(context.profile.organization_id, staffId, defaultStoreId);
  revalidatePath('/owner/staff');
}

async function setStaffActive(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const staffId = requiredText(formData.get('staff_id'));
  const isActive = formData.get('is_active') === 'true';

  if (!staffId) return;

  await supabase
    .from('staff')
    .update({ is_active: isActive, retired_on: isActive ? null : new Date().toISOString().slice(0, 10) })
    .eq('id', staffId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath('/owner/staff');
}

async function updateStaffPin(formData: FormData) {
  'use server';

  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();
  const staffId = requiredText(formData.get('staff_id'));
  const pin = requiredText(formData.get('pin'));

  if (!staffId || !pin) return;

  await supabase
    .from('staff')
    .update({
      pin_hash: hashPin(pin),
      pin_updated_at: new Date().toISOString(),
      pin_failed_attempts: 0,
      pin_locked_until: null,
    })
    .eq('id', staffId)
    .eq('organization_id', context.profile.organization_id);

  revalidatePath('/owner/staff');
}

function StoreSelect({
  stores,
  defaultValue,
  name = 'default_store_id',
}: {
  stores: StoreRow[];
  defaultValue?: string | null;
  name?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="">未設定</option>
      {stores.map((store) => (
        <option key={store.id} value={store.id}>
          {store.name}{store.is_active ? '' : '（無効）'}
        </option>
      ))}
    </select>
  );
}

function EmploymentSelect({ defaultValue }: { defaultValue?: EmploymentType | null }) {
  return (
    <select
      name="employment_type"
      defaultValue={defaultValue ?? ''}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="">未設定</option>
      {Object.entries(employmentLabels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

export default async function StaffPage() {
  const context = await requireAuthenticatedRole(['owner']);
  const supabase = createSupabaseAdminClient();

  const [{ data: staff }, { data: stores }] = await Promise.all([
    supabase
      .from('staff')
      .select(
        'id, auth_user_id, default_store_id, employee_code, name, name_kana, employment_type, hourly_wage, phone, email, pin_hash, is_active, joined_on, retired_on, updated_at'
      )
      .eq('organization_id', context.profile.organization_id)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('stores')
      .select('id, name, is_active')
      .eq('organization_id', context.profile.organization_id)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
  ]);

  const staffRows = (staff ?? []) as StaffRow[];
  const storeRows = (stores ?? []) as StoreRow[];
  const storeNameById = new Map(storeRows.map((store) => [store.id, store.name]));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">スタッフ管理</h2>
          <p className="mt-1 text-sm text-gray-600">スタッフ台帳、所属店舗、店舗iPad用PIN、スマホログイン紐づけを管理します。</p>
        </div>
        <Link href="/owner">
          <Button variant="outline">戻る</Button>
        </Link>
      </div>

      <section className="space-y-4 rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold">スタッフを追加</h3>
        <form action={createStaff} className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="new-staff-name">氏名</Label>
            <Input id="new-staff-name" name="name" required placeholder="田中 太郎" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="new-staff-kana">ふりがな</Label>
            <Input id="new-staff-kana" name="name_kana" placeholder="たなか たろう" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-staff-code">従業員コード</Label>
            <Input id="new-staff-code" name="employee_code" placeholder="S001" />
          </div>
          <div className="space-y-1">
            <Label>雇用形態</Label>
            <EmploymentSelect />
          </div>
          <div className="space-y-1">
            <Label>所属店舗</Label>
            <StoreSelect stores={storeRows} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-staff-wage">時給</Label>
            <Input id="new-staff-wage" name="hourly_wage" type="number" min="0" placeholder="1200" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="new-staff-email">メール</Label>
            <Input id="new-staff-email" name="email" type="email" placeholder="staff@example.com" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-staff-phone">電話番号</Label>
            <Input id="new-staff-phone" name="phone" placeholder="090..." />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-staff-joined">入社日</Label>
            <Input id="new-staff-joined" name="joined_on" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-staff-pin">PIN</Label>
            <Input id="new-staff-pin" name="pin" type="password" inputMode="numeric" placeholder="任意" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="new-staff-auth">AuthユーザーID</Label>
            <Input id="new-staff-auth" name="auth_user_id" placeholder="個人スマホ利用者のみ" />
          </div>
          <div className="flex items-end">
            <Button type="submit">追加</Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">スタッフ一覧</h3>
          <span className="text-sm text-gray-500">{staffRows.length}件</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>スタッフ</TableHead>
              <TableHead>所属・雇用</TableHead>
              <TableHead>連絡先/Auth</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffRows.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="min-w-[320px] whitespace-normal align-top">
                  <form action={updateStaff} className="grid gap-2">
                    <input type="hidden" name="staff_id" value={member.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="name" defaultValue={member.name} required aria-label={`${member.name} 氏名`} />
                      <Input name="name_kana" defaultValue={member.name_kana ?? ''} placeholder="ふりがな" aria-label={`${member.name} ふりがな`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="employee_code" defaultValue={member.employee_code ?? ''} placeholder="従業員コード" aria-label={`${member.name} 従業員コード`} />
                      <EmploymentSelect defaultValue={member.employment_type} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="joined_on" type="date" defaultValue={member.joined_on ?? ''} aria-label={`${member.name} 入社日`} />
                      <Input name="retired_on" type="date" defaultValue={member.retired_on ?? ''} aria-label={`${member.name} 退職日`} />
                    </div>
                    <div>
                      <Button type="submit" variant="outline" size="sm">保存</Button>
                    </div>
                  </form>
                </TableCell>
                <TableCell className="min-w-[220px] whitespace-normal align-top">
                  <form action={updateStaff} className="space-y-2">
                    <input type="hidden" name="staff_id" value={member.id} />
                    <input type="hidden" name="name" value={member.name} />
                    <input type="hidden" name="name_kana" value={member.name_kana ?? ''} />
                    <input type="hidden" name="employee_code" value={member.employee_code ?? ''} />
                    <input type="hidden" name="employment_type" value={member.employment_type ?? ''} />
                    <input type="hidden" name="hourly_wage" value={member.hourly_wage ?? ''} />
                    <input type="hidden" name="phone" value={member.phone ?? ''} />
                    <input type="hidden" name="email" value={member.email ?? ''} />
                    <input type="hidden" name="auth_user_id" value={member.auth_user_id ?? ''} />
                    <input type="hidden" name="joined_on" value={member.joined_on ?? ''} />
                    <input type="hidden" name="retired_on" value={member.retired_on ?? ''} />
                    <StoreSelect stores={storeRows} defaultValue={member.default_store_id} />
                    <div className="text-xs text-gray-500">
                      現在: {member.default_store_id ? storeNameById.get(member.default_store_id) ?? '不明な店舗' : '未設定'}
                    </div>
                    <Button type="submit" variant="outline" size="sm">所属保存</Button>
                  </form>
                  <div className="mt-3 text-sm">
                    時給: {member.hourly_wage == null ? '-' : `${member.hourly_wage.toLocaleString()}円`}
                  </div>
                </TableCell>
                <TableCell className="min-w-[260px] whitespace-normal align-top">
                  <form action={updateStaff} className="grid gap-2">
                    <input type="hidden" name="staff_id" value={member.id} />
                    <input type="hidden" name="name" value={member.name} />
                    <input type="hidden" name="name_kana" value={member.name_kana ?? ''} />
                    <input type="hidden" name="employee_code" value={member.employee_code ?? ''} />
                    <input type="hidden" name="employment_type" value={member.employment_type ?? ''} />
                    <input type="hidden" name="default_store_id" value={member.default_store_id ?? ''} />
                    <input type="hidden" name="joined_on" value={member.joined_on ?? ''} />
                    <input type="hidden" name="retired_on" value={member.retired_on ?? ''} />
                    <Input name="email" type="email" defaultValue={member.email ?? ''} placeholder="メール" aria-label={`${member.name} メール`} />
                    <Input name="phone" defaultValue={member.phone ?? ''} placeholder="電話番号" aria-label={`${member.name} 電話番号`} />
                    <Input name="hourly_wage" type="number" min="0" defaultValue={member.hourly_wage ?? ''} placeholder="時給" aria-label={`${member.name} 時給`} />
                    <Input name="auth_user_id" defaultValue={member.auth_user_id ?? ''} placeholder="AuthユーザーID" aria-label={`${member.name} AuthユーザーID`} />
                    <Button type="submit" variant="outline" size="sm">連絡先保存</Button>
                  </form>
                </TableCell>
                <TableCell className="min-w-[180px] whitespace-normal align-top">
                  <div className="space-y-2">
                    <Badge variant={member.pin_hash ? 'default' : 'outline'}>
                      {member.pin_hash ? 'PIN設定済み' : '未設定'}
                    </Badge>
                    {member.pin_hash && (
                      <div className="text-xs text-gray-500">識別: {legacyPinFingerprint(member.pin_hash)}</div>
                    )}
                    <form action={updateStaffPin} className="flex gap-2">
                      <input type="hidden" name="staff_id" value={member.id} />
                      <Input name="pin" type="password" inputMode="numeric" placeholder="新PIN" required aria-label={`${member.name} 新PIN`} />
                      <Button type="submit" variant="outline" size="sm">更新</Button>
                    </form>
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={member.is_active ? 'default' : 'outline'}>
                    {member.is_active ? '有効' : '無効'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right align-top">
                  <form action={setStaffActive}>
                    <input type="hidden" name="staff_id" value={member.id} />
                    <input type="hidden" name="is_active" value={String(!member.is_active)} />
                    <Button type="submit" variant="outline" size="sm">
                      {member.is_active ? '無効化' : '有効化'}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {staffRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                  スタッフがまだありません。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
