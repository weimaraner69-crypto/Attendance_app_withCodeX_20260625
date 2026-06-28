'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AttendanceReportFilters, AttendanceReportRow } from '@/lib/reports/attendance';

type AttendancePdfExportButtonProps = {
  title: string;
  filters: AttendanceReportFilters;
  rows: AttendanceReportRow[];
};

const statusLabels: Record<AttendanceReportRow['status'], string> = {
  not_started: '未打刻',
  working: '出勤中',
  on_break: '休憩中',
  finished: '退勤済み',
};

function formatTokyoTime(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return '0分';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function summarizeAttendance(rows: AttendanceReportRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.workDays += row.status === 'not_started' ? 0 : 1;
      summary.totalWorkMinutes += row.total_work_minutes;
      summary.totalBreakMinutes += row.break_minutes;
      summary.nightShiftMinutes += row.night_shift_minutes;
      summary.manualCount += row.is_manual ? 1 : 0;
      summary.missingClockOut += row.clock_in_at && !row.clock_out_at ? 1 : 0;
      return summary;
    },
    {
      workDays: 0,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
      nightShiftMinutes: 0,
      manualCount: 0,
      missingClockOut: 0,
    },
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildReportHtml(title: string, filters: AttendanceReportFilters, rows: AttendanceReportRow[]) {
  const summary = summarizeAttendance(rows);
  const generatedAt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const body = rows.length
    ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.work_date)}</td>
          <td>${escapeHtml(row.stores?.name ?? '不明な店舗')}</td>
          <td>${escapeHtml(row.staff?.name ?? '不明なスタッフ')}</td>
          <td>${escapeHtml(statusLabels[row.status])}</td>
          <td>${escapeHtml(formatTokyoTime(row.clock_in_at))}</td>
          <td>${escapeHtml(formatTokyoTime(row.clock_out_at))}</td>
          <td>${escapeHtml(formatMinutes(row.break_minutes))}</td>
          <td>${escapeHtml(formatMinutes(row.total_work_minutes))}</td>
          <td>${escapeHtml(formatMinutes(row.night_shift_minutes))}</td>
          <td>${escapeHtml([
            row.is_manual ? '手修正' : '',
            row.clock_in_at && !row.clock_out_at ? '退勤漏れ' : '',
            row.note ?? '',
          ].filter(Boolean).join(' / ') || '-')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="10" class="empty">条件に一致する勤怠データはありません。</td></tr>';

  return `
    <section class="report">
      <h1>${escapeHtml(title)}</h1>
      <p class="period">対象期間: ${escapeHtml(filters.from)} 〜 ${escapeHtml(filters.to)}</p>
      <div class="summary">
        <div><span>勤務日数</span><strong>${summary.workDays}日</strong></div>
        <div><span>総勤務</span><strong>${escapeHtml(formatMinutes(summary.totalWorkMinutes))}</strong></div>
        <div><span>総休憩</span><strong>${escapeHtml(formatMinutes(summary.totalBreakMinutes))}</strong></div>
        <div><span>深夜</span><strong>${escapeHtml(formatMinutes(summary.nightShiftMinutes))}</strong></div>
        <div><span>要確認</span><strong>${summary.manualCount + summary.missingClockOut}件</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>日付</th><th>店舗</th><th>スタッフ</th><th>状態</th><th>出勤</th>
            <th>退勤</th><th>休憩</th><th>勤務</th><th>深夜</th><th>補足</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <p class="generated">出力日時: ${escapeHtml(generatedAt)}</p>
    </section>
  `;
}

export function AttendancePdfExportButton({ title, filters, rows }: AttendancePdfExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function exportPdf() {
    setIsExporting(true);

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;width:1120px;background:#fff;color:#111;padding:36px;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;';
    host.innerHTML = `
      <style>
        .report h1 { font-size: 28px; margin: 0 0 6px; }
        .period, .generated { color: #555; font-size: 12px; }
        .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 24px 0; }
        .summary div { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
        .summary span { display: block; color: #666; font-size: 11px; }
        .summary strong { display: block; font-size: 17px; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #d8d8d8; padding: 7px 5px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; white-space: nowrap; }
        tr { break-inside: avoid; }
        .empty { padding: 24px; text-align: center; color: #666; }
        .generated { margin-top: 16px; text-align: right; }
      </style>
      ${buildReportHtml(title, filters, rows)}
    `;
    document.body.appendChild(host);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(host, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      const printableHeight = pageHeight - margin * 2;
      const image = canvas.toDataURL('image/jpeg', 0.92);

      let y = margin;
      let remainingHeight = imageHeight;
      pdf.addImage(image, 'JPEG', margin, y, imageWidth, imageHeight);

      while (remainingHeight > printableHeight) {
        remainingHeight -= printableHeight;
        y -= printableHeight;
        pdf.addPage();
        pdf.addImage(image, 'JPEG', margin, y, imageWidth, imageHeight);
      }

      pdf.save(`attendance-${filters.from}-${filters.to}.pdf`);
    } finally {
      host.remove();
      setIsExporting(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={exportPdf} disabled={isExporting}>
      {isExporting ? 'PDF作成中…' : 'PDF出力'}
    </Button>
  );
}
