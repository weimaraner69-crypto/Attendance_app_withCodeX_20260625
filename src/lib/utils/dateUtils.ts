export function getCurrentDate(): Date {
  return new Date();
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatTime(date: Date): string {
  return date.toISOString().split('T')[1].slice(0, 5);
}

export function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function getDayOfWeek(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function endOfWeek(date: Date): Date {
  const d = new Date(startOfWeek(date));
  d.setDate(d.getDate() + 6);
  return d;
}

export function getMonthRange(yearMonth: string): { start: Date; end: Date } {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

export function calculateWorkMinutes(startTime: Date, endTime: Date, breakMinutes: number = 0): number {
  const diffMs = endTime.getTime() - startTime.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  return Math.max(0, totalMinutes - breakMinutes);
}

export function isNightShift(startTime: Date, endTime: Date): boolean {
  const startHour = startTime.getHours();
  const endHour = endTime.getHours();
  return startHour >= 22 || endHour >= 22 || (startHour < 6 && endHour < 6);
}

export function calculateNightShiftMinutes(startTime: Date, endTime: Date): number {
  let nightMinutes = 0;
  const current = new Date(startTime);

  while (current < endTime) {
    const hour = current.getHours();
    if (hour >= 22 || hour < 6) {
      nightMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  return nightMinutes;
}
