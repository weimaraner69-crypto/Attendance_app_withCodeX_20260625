'use client';

import { useState } from 'react';
import { toast, Toaster } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type StampEventType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out';

type StaffOption = {
  id: string;
  name: string;
  employee_code: string | null;
};

type KioskDeviceOption = {
  id: string;
  name: string;
  device_code: string;
};

type KioskStampPanelProps = {
  storeId: string;
  storeName: string;
  staff: StaffOption[];
  kioskDevices: KioskDeviceOption[];
};

const eventButtons: Array<{ type: StampEventType; label: string }> = [
  { type: 'clock_in', label: '出勤' },
  { type: 'break_start', label: '休憩開始' },
  { type: 'break_end', label: '休憩終了' },
  { type: 'clock_out', label: '退勤' },
];

export function KioskStampPanel({ storeId, storeName, staff, kioskDevices }: KioskStampPanelProps) {
  const [staffId, setStaffId] = useState('');
  const [kioskDeviceId, setKioskDeviceId] = useState(kioskDevices[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submitStamp = async (eventType: StampEventType) => {
    if (!staffId) {
      toast.error('スタッフを選択してください');
      return;
    }
    if (!kioskDeviceId) {
      toast.error('店舗iPad端末を選択してください');
      return;
    }
    if (!pin) {
      toast.error('PINを入力してください');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/attendance/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          staff_id: staffId,
          kiosk_device_id: kioskDeviceId,
          source: 'kiosk',
          event_type: eventType,
          pin,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message ?? '打刻に失敗しました');
        return;
      }

      toast.success(`${eventButtons.find((button) => button.type === eventType)?.label}を記録しました`);
      setPin('');
    } catch {
      toast.error('打刻に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{storeName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kiosk-staff">スタッフ</Label>
            <select
              id="kiosk-staff"
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">選択してください</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}{member.employee_code ? ` (${member.employee_code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kiosk-device">店舗iPad端末</Label>
            <select
              id="kiosk-device"
              value={kioskDeviceId}
              onChange={(event) => setKioskDeviceId(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">選択してください</option>
              {kioskDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.device_code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kiosk-pin">PIN</Label>
          <Input
            id="kiosk-pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="PINを入力"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {eventButtons.map((button) => (
            <Button
              key={button.type}
              type="button"
              size="lg"
              disabled={isLoading || staff.length === 0 || kioskDevices.length === 0}
              onClick={() => submitStamp(button.type)}
            >
              {button.label}
            </Button>
          ))}
        </div>

        {staff.length === 0 && <p className="text-sm text-red-600">この店舗に所属中のスタッフがいません。</p>}
        {kioskDevices.length === 0 && <p className="text-sm text-red-600">有効な店舗iPad端末が登録されていません。</p>}
        <Toaster />
      </CardContent>
    </Card>
  );
}
