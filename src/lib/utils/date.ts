export type DateInput = Date | string | null | undefined;

function parse(date: DateInput): Date | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: DateInput, locale = 'ko-KR', fallback = '-'): string {
  const d = parse(date);
  if (!d) return fallback;
  return d.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(date: DateInput, locale = 'ko-KR', fallback = '-'): string {
  const d = parse(date);
  if (!d) return fallback;
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: DateInput, locale = 'ko-KR', fallback = '-'): string {
  const d = parse(date);
  if (!d) return fallback;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return formatDate(d, locale, fallback);
}

export function toISOString(date: DateInput): string | null {
  const d = parse(date);
  return d ? d.toISOString() : null;
}

export function toDateInputValue(date: DateInput): string {
  const d = parse(date);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export function getDaysDiff(from: DateInput, to: DateInput): number | null {
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function isToday(date: DateInput): boolean {
  const d = parse(date);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isPast(date: DateInput): boolean {
  const d = parse(date);
  return d ? d.getTime() < Date.now() : false;
}

export function isFuture(date: DateInput): boolean {
  const d = parse(date);
  return d ? d.getTime() > Date.now() : false;
}

export function isValidDate(date: DateInput): boolean {
  return parse(date) !== null;
}
