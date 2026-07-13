import Link from 'next/link';

import { AttendancePdfExportButton } from '@/components/reports/AttendancePdfExportButton';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  type AttendanceReportFilters,
  type AttendanceReportRow,
  type ReportStaff,
  type ReportStore,
  formatMinutes,
  formatTokyoTime,
  summarizeAttendance,
} from '@/lib/reports/attendance';

type AttendanceReportViewProps = {
  title: string;
  description: string;
  backHref: string;
  filters: AttendanceReportFilters;
  stores: ReportStore[];
  staff: ReportStaff[];
  rows: AttendanceReportRow[];
};

const statusLabels: Record<AttendanceReportRow['status'], string> = {
  not_started: '未打刻',
  working: '出勤中',
  on_break: '休憩中',
  finished: '退勤済み',
};

const statusVariants: Record<AttendanceReportRow['status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  not_started: 'destructive',
  working: 'default',
  on_break: 'outline',
  finished: 'secondary',
};

export function AttendanceReportView({
  title,
  description,
  backHref,
  filters,
  stores,
  staff,
  rows,
}: AttendanceReportViewProps) {
  const summary = summarizeAttendance(rows);
  const csvParams = new URLSearchParams();
  csvParams.set('from', filters.from);
  csvParams.set('to', filters.to);
  if (filters.storeId) csvParams.set('store_id', filters.storeId);
  if (filters.staffId) csvParams.set('staff_id', filters.staffId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <div className="flex gap-2">
          <AttendancePdfExportButton title={title} filters={filters} rows={rows} />
          <a
            href={`/api/reports/attendance.csv?${csvParams.toString()}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            CSV出力
          </a>
          <Link href={backHref} className={buttonVariants({ variant: 'outline' })}>
            戻る
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>絞り込み</CardTitle>
          <CardDescription>期間、店舗、スタッフで勤怠レコードを絞り込みます。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="report-from">開始日</Label>
              <Input id="report-from" name="from" type="date" defaultValue={filters.from} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-to">終了日</Label>
              <Input id="report-to" name="to" type="date" defaultValue={filters.to} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-store">店舗</Label>
              <select
                id="report-store"
                name="store_id"
                defaultValue={filters.storeId}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">全店舗</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-staff">スタッフ</Label>
              <select
                id="report-staff"
                name="staff_id"
                defaultValue={filters.staffId}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">全スタッフ</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">表示</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>勤務日数</CardDescription>
            <CardTitle className="text-2xl">{summary.workDays}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総勤務</CardDescription>
            <CardTitle className="text-2xl">{formatMinutes(summary.totalWorkMinutes)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総休憩</CardDescription>
            <CardTitle className="text-2xl">{formatMinutes(summary.totalBreakMinutes)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>深夜</CardDescription>
            <CardTitle className="text-2xl">{formatMinutes(summary.nightShiftMinutes)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>要確認</CardDescription>
            <CardTitle className="text-2xl">{summary.manualCount + summary.missingClockOut}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>月次勤怠一覧</CardTitle>
          <CardDescription>CSV出力の主データになる日別勤怠結果です。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>店舗</TableHead>
                <TableHead>スタッフ</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>出勤</TableHead>
                <TableHead>退勤</TableHead>
                <TableHead>休憩</TableHead>
                <TableHead>勤務</TableHead>
                <TableHead>深夜</TableHead>
                <TableHead>補足</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.work_date}</TableCell>
                  <TableCell>{row.stores?.name ?? '不明な店舗'}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.staff?.name ?? '不明なスタッフ'}</div>
                    {row.staff?.employee_code && (
                      <div className="text-xs text-gray-500">{row.staff.employee_code}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[row.status]}>{statusLabels[row.status]}</Badge>
                  </TableCell>
                  <TableCell>{formatTokyoTime(row.clock_in_at)}</TableCell>
                  <TableCell>{formatTokyoTime(row.clock_out_at)}</TableCell>
                  <TableCell>{formatMinutes(row.break_minutes)}</TableCell>
                  <TableCell>{formatMinutes(row.total_work_minutes)}</TableCell>
                  <TableCell>{formatMinutes(row.night_shift_minutes)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.is_manual && <Badge variant="outline">手修正</Badge>}
                      {row.clock_in_at && !row.clock_out_at && <Badge variant="destructive">退勤漏れ</Badge>}
                      {row.note && <span className="text-xs text-gray-600">{row.note}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-gray-500">
                    条件に一致する勤怠データはありません。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
