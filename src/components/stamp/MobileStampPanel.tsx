'use client';

import { useState } from 'react';
import { toast, Toaster } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { getCurrentLocation, type Coords } from '@/lib/utils/gpsUtils';

type StampEventType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out';

type StoreOption = {
  id: string;
  name: string;
};

type MobileStampPanelProps = {
  staffId: string;
  staffName: string;
  stores: StoreOption[];
  defaultStoreId: string | null;
};

const eventButtons: Array<{ type: StampEventType; label: string }> = [
  { type: 'clock_in', label: '出勤' },
  { type: 'break_start', label: '休憩開始' },
  { type: 'break_end', label: '休憩終了' },
  { type: 'clock_out', label: '退勤' },
];

export function MobileStampPanel({ staffId, staffName, stores, defaultStoreId }: MobileStampPanelProps) {
  const [storeId, setStoreId] = useState(defaultStoreId ?? stores[0]?.id ?? '');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const locate = async () => {
    try {
      setIsLocating(true);
      const current = await getCurrentLocation();
      setCoords(current);
      toast.success('位置情報を取得しました');
    } catch {
      toast.error('位置情報を取得できませんでした');
    } finally {
      setIsLocating(false);
    }
  };

  const submitStamp = async (eventType: StampEventType) => {
    if (!storeId) {
      toast.error('店舗を選択してください');
      return;
    }

    const currentCoords = coords ?? await getCurrentLocation().catch(() => null);
    if (!currentCoords) {
      toast.error('位置情報を取得してください');
      return;
    }
    setCoords(currentCoords);

    try {
      setIsLoading(true);
      const response = await fetch('/api/attendance/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          staff_id: staffId,
          source: 'mobile_web',
          event_type: eventType,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          gps_accuracy_meters: currentCoords.accuracy,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message ?? '打刻に失敗しました');
        return;
      }

      toast.success(`${eventButtons.find((button) => button.type === eventType)?.label}を記録しました`);
    } catch {
      toast.error('打刻に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{staffName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="mobile-store">店舗</Label>
          <select
            id="mobile-store"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">選択してください</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            {coords
              ? `緯度 ${coords.latitude.toFixed(6)} / 経度 ${coords.longitude.toFixed(6)} / 精度 ${Math.round(coords.accuracy)}m`
              : '位置情報は未取得です'}
          </div>
          <Button type="button" variant="outline" onClick={locate} disabled={isLocating}>
            {isLocating ? '取得中...' : 'GPS取得'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {eventButtons.map((button) => (
            <Button
              key={button.type}
              type="button"
              size="lg"
              disabled={isLoading || stores.length === 0}
              onClick={() => submitStamp(button.type)}
            >
              {button.label}
            </Button>
          ))}
        </div>

        {stores.length === 0 && <p className="text-sm text-red-600">打刻できる所属店舗がありません。</p>}
        <Toaster />
      </CardContent>
    </Card>
  );
}
