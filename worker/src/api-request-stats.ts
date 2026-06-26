/** UTC date string YYYY-MM-DD from unix seconds. */
export function statDateFromTimestamp(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATIC_API_SEGMENTS = new Set([
  'api',
  'auth',
  'user',
  'public',
  'health',
  'config',
  'mailboxes',
  'emails',
  'attachments',
  'mail',
  'send',
  'lease',
  'login',
  'logout',
  'stats',
  'maintenance',
  'announcements',
  'rules',
  'users',
  'audit-logs',
  'brevo-stats',
  'rate-limit-stats',
  'request-stats',
  'latest-code',
  'latest-link',
  'raw',
  'read',
  'read-all',
  'unread',
  'reactivate',
  'quota',
  'tokens',
  'extract-rules',
  'sent',
  'me',
]);

function isDynamicPathSegment(segment: string, previousSegment?: string): boolean {
  if (segment.includes('@')) return true;
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  if (STATIC_API_SEGMENTS.has(segment)) return false;
  if (previousSegment === 'mailboxes' && /^[a-z0-9._-]+$/i.test(segment)) return true;
  return false;
}

/** Collapse IDs and mailbox addresses into route groups for aggregation. */
export function normalizeApiPath(pathname: string): string | null {
  if (!pathname.startsWith('/api/')) return null;

  const segments = pathname.split('/').filter(Boolean);
  const normalized: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const prev = i > 0 ? segments[i - 1] : undefined;
    if (isDynamicPathSegment(seg, prev)) {
      normalized.push(prev === 'mailboxes' ? ':address' : ':id');
    } else {
      normalized.push(seg);
    }
  }

  return `/${normalized.join('/')}`;
}

export interface StatusCodeBucket {
  statusCode: number;
  count: number;
}

export interface PathVolumeBucket {
  pathGroup: string;
  count: number;
}

export interface StatusCategoryTotals {
  success2xx: number;
  client4xx: number;
  server5xx: number;
  other: number;
}

/** Sum rows into status-code buckets sorted by code. */
export function aggregateByStatusCode(rows: Array<{ statusCode: number; count: number }>): StatusCodeBucket[] {
  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.statusCode, (map.get(row.statusCode) ?? 0) + row.count);
  }
  return [...map.entries()]
    .map(([statusCode, count]) => ({ statusCode, count }))
    .sort((a, b) => a.statusCode - b.statusCode);
}

/** Sum rows across status codes into path volume, top N. */
export function aggregateTopPaths(
  rows: Array<{ pathGroup: string; count: number }>,
  limit = 10
): PathVolumeBucket[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.pathGroup, (map.get(row.pathGroup) ?? 0) + row.count);
  }
  return [...map.entries()]
    .map(([pathGroup, count]) => ({ pathGroup, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function categorizeStatusTotals(buckets: StatusCodeBucket[]): StatusCategoryTotals {
  const totals: StatusCategoryTotals = { success2xx: 0, client4xx: 0, server5xx: 0, other: 0 };
  for (const { statusCode, count } of buckets) {
    if (statusCode >= 200 && statusCode < 300) totals.success2xx += count;
    else if (statusCode >= 400 && statusCode < 500) totals.client4xx += count;
    else if (statusCode >= 500 && statusCode < 600) totals.server5xx += count;
    else totals.other += count;
  }
  return totals;
}

export const REQUEST_STATS_TREND_DAYS = 7;

/** Last N UTC calendar days ending at `nowSec` (inclusive of today). */
export function lastStatDates(days: number, nowSec: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(statDateFromTimestamp(nowSec - i * 86400));
  }
  return dates;
}

export interface RequestStatsTrendSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export interface RequestStatsTrend {
  dates: string[];
  series: RequestStatsTrendSeries[];
}

export const REQUEST_STATS_CHART_SERIES = [
  { key: '2xx', label: '2xx 成功', color: '#22c55e', match: (c: number) => c >= 200 && c < 300 },
  { key: '4xx', label: '4xx 客户端', color: '#f59e0b', match: (c: number) => c >= 400 && c < 500 },
  { key: '5xx', label: '5xx 服务端', color: '#ef4444', match: (c: number) => c >= 500 && c < 600 },
  { key: '401', label: '401 未授权', color: '#60a5fa', match: (c: number) => c === 401 },
  { key: '403', label: '403 禁止', color: '#a78bfa', match: (c: number) => c === 403 },
  { key: '404', label: '404 未找到', color: '#f472b6', match: (c: number) => c === 404 },
  { key: '429', label: '429 限流', color: '#fcd34d', match: (c: number) => c === 429 },
  { key: '500', label: '500 错误', color: '#f87171', match: (c: number) => c === 500 },
] as const;

/** Build 7-day line-chart series from daily status-code rows. */
export function buildRequestStatsTrend(
  dates: string[],
  rows: Array<{ statDate: string; statusCode: number; count: number }>
): RequestStatsTrend {
  const byDate = new Map<string, Map<number, number>>();
  for (const date of dates) {
    byDate.set(date, new Map());
  }
  for (const row of rows) {
    const dayMap = byDate.get(row.statDate);
    if (!dayMap) continue;
    dayMap.set(row.statusCode, (dayMap.get(row.statusCode) ?? 0) + row.count);
  }

  const series = REQUEST_STATS_CHART_SERIES.map((def) => ({
    key: def.key,
    label: def.label,
    color: def.color,
    values: dates.map((date) => {
      const dayMap = byDate.get(date)!;
      let sum = 0;
      for (const [code, count] of dayMap) {
        if (def.match(code)) sum += count;
      }
      return sum;
    }),
  }));

  return { dates, series };
}
