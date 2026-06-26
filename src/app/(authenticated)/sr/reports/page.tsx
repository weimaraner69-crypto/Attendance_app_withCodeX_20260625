import { AttendanceReportView } from '@/components/reports/AttendanceReportView';
import { requireAuthenticatedRole } from '@/lib/auth/session';
import { getReportFilters, loadAttendanceReport } from '@/lib/reports/attendance';

type SRReportsPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function SRReportsPage({ searchParams }: SRReportsPageProps) {
  const context = await requireAuthenticatedRole(['sr']);
  const filters = getReportFilters(searchParams);
  const report = await loadAttendanceReport(context.profile.organization_id, filters);

  return (
    <AttendanceReportView
      title="レポート"
      description="労働時間・休憩・手修正を確認する社労士向け一覧です。"
      backHref="/sr"
      filters={filters}
      stores={report.stores}
      staff={report.staff}
      rows={report.rows}
    />
  );
}
