import type { TimeRange } from '@/api/client';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

function parseTimestamp(ts: string): Date {
  const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T');
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasZone ? normalized : `${normalized}Z`);
}

function safeTimezone(timezone?: string | null): string {
  const tz = timezone?.trim() || DEFAULT_TIMEZONE;
  if (tz === 'Asia/Kolkatta') return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function formatInZone(ts: string, timezone: string | undefined | null, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimezone(timezone),
      hourCycle: 'h23',
      ...options,
    }).format(parseTimestamp(ts));
  } catch {
    return ts;
  }
}

export function formatActivityTime(ts: string, timezone?: string | null, withSeconds = false) {
  return formatInZone(ts, timezone, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  });
}

export function formatChartTick(ts: string, range: TimeRange | '24h' | '7d' | '30d', timezone?: string | null) {
  if (range === '24h') {
    return formatInZone(ts, timezone, { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return formatInZone(ts, timezone, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return formatInZone(ts, timezone, { month: 'short', day: 'numeric' });
}

export function formatTimeOnly(ts: string, timezone?: string | null) {
  return formatInZone(ts, timezone, { hour: '2-digit', minute: '2-digit' });
}
