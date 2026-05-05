import { execFile } from 'child_process';
import { promisify } from 'util';

export interface SpeedResult {
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  jitter_ms: number | null;
  test_provider: SpeedTestProvider;
  server_name: string;
  server_location: string;
  result_url: string;
  error?: string;
}

export type SpeedTestProvider = 'cloudflare' | 'google' | 'ookla';

export const SPEED_TEST_PROVIDERS: Record<SpeedTestProvider, { label: string; serverName: string; serverLocation: string; resultUrl: string }> = {
  cloudflare: {
    label: 'Cloudflare',
    serverName: 'Cloudflare',
    serverLocation: 'Global CDN',
    resultUrl: 'https://speed.cloudflare.com',
  },
  google: {
    label: 'Google',
    serverName: 'Google CDN',
    serverLocation: 'Global edge',
    resultUrl: 'https://www.google.com',
  },
  ookla: {
    label: 'Ookla',
    serverName: 'Ookla Speedtest',
    serverLocation: 'Auto-selected',
    resultUrl: 'https://www.speedtest.net',
  },
};

const PROVIDERS = Object.keys(SPEED_TEST_PROVIDERS) as SpeedTestProvider[];
const CF_BASE = 'https://speed.cloudflare.com';
const GOOGLE_BASE = 'https://www.google.com';
const GOOGLE_DOWNLOAD_URL = 'https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb';
const TIMEOUT_MS = 30_000;
const execFileAsync = promisify(execFile);

export function normalizeSpeedTestProvider(value: unknown): SpeedTestProvider {
  const provider = String(value ?? '').trim().toLowerCase();
  return PROVIDERS.includes(provider as SpeedTestProvider) ? provider as SpeedTestProvider : 'cloudflare';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function measurePing(url: string): Promise<{ ping: number; jitter: number }> {
  const times: number[] = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    await fetch(url, { cache: 'no-store' });
    times.push(performance.now() - start);
  }
  times.shift(); // discard warmup
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const jitter = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length);
  return { ping: Math.round(avg * 10) / 10, jitter: Math.round(jitter * 10) / 10 };
}

async function measureDownload(url: string): Promise<number> {
  // Run 3 chunks and compute aggregate Mbps
  const chunkBytes = 25_000_000; // 25 MB
  const runs = 3;
  let totalBytes = 0;
  let totalMs = 0;

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const res = await fetch(url.includes('{bytes}') ? url.replace('{bytes}', String(chunkBytes)) : url);
    const buf = await res.arrayBuffer();
    totalMs += performance.now() - start;
    totalBytes += buf.byteLength;
  }

  return (totalBytes * 8) / (totalMs / 1000) / 1_000_000;
}

async function measureUpload(url: string): Promise<number> {
  const sizes = [2_000_000, 8_000_000, 8_000_000];
  let totalBytes = 0;
  let totalMs = 0;

  for (const size of sizes) {
    const body = new Uint8Array(size); // zeros are fine for throughput testing
    const start = performance.now();
    await fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    totalMs += performance.now() - start;
    totalBytes += size;
  }

  return (totalBytes * 8) / (totalMs / 1000) / 1_000_000;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function runHttpSpeedTest(provider: Extract<SpeedTestProvider, 'cloudflare' | 'google'>): Promise<SpeedResult> {
  const meta = SPEED_TEST_PROVIDERS[provider];
  const endpoints = provider === 'cloudflare'
    ? {
        ping: `${CF_BASE}/cdn-cgi/trace`,
        download: `${CF_BASE}/__down?bytes={bytes}`,
        upload: `${CF_BASE}/__up`,
      }
    : {
        ping: `${GOOGLE_BASE}/generate_204`,
        download: GOOGLE_DOWNLOAD_URL,
        upload: `${GOOGLE_BASE}/gen_204`,
      };

  try {
    const { ping, jitter } = await withTimeout(measurePing(endpoints.ping), TIMEOUT_MS);
    const [download_mbps, upload_mbps] = await Promise.all([
      withTimeout(measureDownload(endpoints.download), TIMEOUT_MS * 3),
      withTimeout(measureUpload(endpoints.upload), TIMEOUT_MS * 2),
    ]);

    return {
      download_mbps: round2(download_mbps),
      upload_mbps: round2(upload_mbps),
      ping_ms: ping,
      jitter_ms: jitter,
      test_provider: provider,
      server_name: meta.serverName,
      server_location: meta.serverLocation,
      result_url: meta.resultUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      download_mbps: null,
      upload_mbps: null,
      ping_ms: null,
      jitter_ms: null,
      test_provider: provider,
      server_name: meta.serverName,
      server_location: meta.serverLocation,
      result_url: meta.resultUrl,
      error: msg,
    };
  }
}

async function runOoklaSpeedTest(): Promise<SpeedResult> {
  const meta = SPEED_TEST_PROVIDERS.ookla;
  try {
    const { stdout } = await execFileAsync('speedtest', ['--format=json', '--accept-license', '--accept-gdpr'], {
      timeout: TIMEOUT_MS * 4,
      maxBuffer: 1024 * 1024,
    });
    const data = JSON.parse(stdout);
    const server = data.server ?? {};
    const result = data.result ?? {};

    return {
      download_mbps: data.download?.bandwidth != null ? round2((data.download.bandwidth * 8) / 1_000_000) : null,
      upload_mbps: data.upload?.bandwidth != null ? round2((data.upload.bandwidth * 8) / 1_000_000) : null,
      ping_ms: data.ping?.latency != null ? round2(data.ping.latency) : null,
      jitter_ms: data.ping?.jitter != null ? round2(data.ping.jitter) : null,
      test_provider: 'ookla',
      server_name: server.name ?? meta.serverName,
      server_location: [server.location, server.country].filter(Boolean).join(', ') || meta.serverLocation,
      result_url: result.url ?? meta.resultUrl,
    };
  } catch (err) {
    const msg = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'Ookla speedtest CLI is not installed'
      : err instanceof Error ? err.message : String(err);
    return {
      download_mbps: null,
      upload_mbps: null,
      ping_ms: null,
      jitter_ms: null,
      test_provider: 'ookla',
      server_name: meta.serverName,
      server_location: meta.serverLocation,
      result_url: meta.resultUrl,
      error: msg,
    };
  }
}

export async function runSpeedTest(providerValue: unknown = 'cloudflare'): Promise<SpeedResult> {
  const provider = normalizeSpeedTestProvider(providerValue);
  if (provider === 'ookla') return runOoklaSpeedTest();
  return runHttpSpeedTest(provider);
}
