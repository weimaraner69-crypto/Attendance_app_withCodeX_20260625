import { AttendanceReportView } from '@/components/reports/AttendanceReportView';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { getReportFilters, loadAttendanceReport } from '@/lib/reports/attendance';

type ReportsPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const context = await requireAuthenticatedRole(['owner']);
  const filters = getReportFilters(searchParams);
  const report = await loadAttendanceReport(context.profile.organization_id, filters);

  return (
    <AttendanceReportView
      title="レポート"
      description="勤務・給与確認向けの月次勤怠一覧です。"
      backHref="/owner"
      filters={filters}
      stores={report.stores}
      staff={report.staff}
      rows={report.rows}
    />
  );
}
