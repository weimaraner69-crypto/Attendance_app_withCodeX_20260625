'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast, Toaster } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const correctionSchema = z.object({
  storeId: z.string().min(1, '店舗を選択してください'),
  targetDate: z.string().min(1, '対象日を入力してください'),
  correctionStartTime: z.string().optional(),
  correctionEndTime: z.string().optional(),
  reason: z.string().min(1, '理由を入力してください'),
}).refine(
  (data) => Boolean(data.correctionStartTime || data.correctionEndTime),
  {
    message: '出勤時刻または退勤時刻を入力してください',
    path: ['correctionStartTime'],
  },
);

type CorrectionFormData = z.infer<typeof correctionSchema>;

type StoreOption = {
  id: string;
  name: string;
};

type CorrectionRequestFormProps = {
  stores: StoreOption[];
  defaultStoreId: string | null;
};

function getTokyoDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function CorrectionRequestForm({ stores, defaultStoreId }: CorrectionRequestFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CorrectionFormData>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      storeId: defaultStoreId ?? stores[0]?.id ?? '',
      targetDate: getTokyoDateString(),
      correctionStartTime: '',
      correctionEndTime: '',
      reason: '',
    },
  });

  const onFormSubmit = async (data: CorrectionFormData) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/attendance/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: data.storeId,
          target_date: data.targetDate,
          requested_clock_in_time: data.correctionStartTime || null,
          requested_clock_out_time: data.correctionEndTime || null,
          reason: data.reason,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message ?? '申請に失敗しました');
        return;
      }

      toast.success('打刻修正申請を送信しました');
      reset({
        storeId: data.storeId,
        targetDate: data.targetDate,
        correctionStartTime: '',
        correctionEndTime: '',
        reason: '',
      });
    } catch {
      toast.error('申請に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">打刻修正申請</CardTitle>
        <CardDescription>打刻漏れや時刻違いを店長へ申請します。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correction-store">店舗</Label>
            <select
              id="correction-store"
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...register('storeId')}
            >
              <option value="">選択してください</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
            {errors.storeId && (
              <p className="text-sm text-red-500">{errors.storeId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetDate">対象日</Label>
            <Input id="targetDate" type="date" {...register('targetDate')} />
            {errors.targetDate && (
              <p className="text-sm text-red-500">{errors.targetDate.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="correctionStartTime">出勤時刻</Label>
              <Input id="correctionStartTime" type="time" {...register('correctionStartTime')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correctionEndTime">退勤時刻</Label>
              <Input id="correctionEndTime" type="time" {...register('correctionEndTime')} />
            </div>
          </div>

          {errors.correctionStartTime && (
            <p className="text-sm text-red-500">{errors.correctionStartTime.message}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">理由</Label>
            <Input
              id="reason"
              placeholder="修正理由を入力してください"
              {...register('reason')}
            />
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? '処理中...' : '申請する'}
          </Button>
          {stores.length === 0 && <p className="text-sm text-red-600">申請できる所属店舗がありません。</p>}
        </form>
        <Toaster />
      </CardContent>
    </Card>
  );
}
