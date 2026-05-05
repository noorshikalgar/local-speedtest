export interface SpeedResult {
  id: number;
  timestamp: string;
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  jitter_ms: number | null;
  test_provider: SpeedTestProvider;
  server_name: string;
  server_location: string;
  server_id: string;
  server_host: string;
  isp_name: string;
  client_ip: string;
  result_url: string;
  is_manual: number;
  error: string | null;
}

export interface LatencyCheck {
  id: number;
  timestamp: string;
  url: string;
  latency_ms: number | null;
  status: string;
}

export interface Settings {
  plan_download_mbps: number;
  plan_upload_mbps: number;
  test_interval_minutes: number;
  retention_days: number;
  alert_threshold_pct: number;
  display_timezone: string;
  speed_test_provider: SpeedTestProvider;
  speed_test_auto_round_robin: boolean;
  latency_sites: string[];
}

export type TimeRange = '24h' | '7d' | '30d' | '90d';
export type SpeedTestProvider = 'cloudflare' | 'google' | 'ookla';

const API = '/api';

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const speedApi = {
  list: (range: TimeRange) => api<SpeedResult[]>(`/speeds?range=${range}`),
  latest: () => api<SpeedResult | null>('/speeds/latest'),
  page: (page: number, pageSize = 15) =>
    api<{ rows: SpeedResult[]; total: number }>(`/speeds/page?page=${page}&pageSize=${pageSize}`),
  run: () => api<{ success: boolean; latest: SpeedResult }>('/speeds/run', { method: 'POST' }),
  status: () => api<{ isRunning: boolean; lastRun: string | null; nextRun: string | null }>('/speeds/status'),
};

export const settingsApi = {
  get: () => api<Settings>('/settings'),
  update: (data: Partial<Settings>) =>
    api<{ success: boolean }>('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

export const latencyApi = {
  list: (range: '24h' | '7d' | '30d') => api<LatencyCheck[]>(`/latency?range=${range}`),
};
