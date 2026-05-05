export interface SpeedResult {
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  jitter_ms: number | null;
  server_name: string;
  server_location: string;
  result_url: string;
  error?: string;
}

const CF_BASE = 'https://speed.cloudflare.com';
const TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function measurePing(): Promise<{ ping: number; jitter: number }> {
  const times: number[] = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    await fetch(`${CF_BASE}/cdn-cgi/trace`);
    times.push(performance.now() - start);
  }
  times.shift(); // discard warmup
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const jitter = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length);
  return { ping: Math.round(avg * 10) / 10, jitter: Math.round(jitter * 10) / 10 };
}

async function measureDownload(): Promise<number> {
  // Run 3 chunks and compute aggregate Mbps
  const chunkBytes = 25_000_000; // 25 MB
  const runs = 3;
  let totalBytes = 0;
  let totalMs = 0;

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const res = await fetch(`${CF_BASE}/__down?bytes=${chunkBytes}`);
    const buf = await res.arrayBuffer();
    totalMs += performance.now() - start;
    totalBytes += buf.byteLength;
  }

  return (totalBytes * 8) / (totalMs / 1000) / 1_000_000;
}

async function measureUpload(): Promise<number> {
  const sizes = [2_000_000, 8_000_000, 8_000_000];
  let totalBytes = 0;
  let totalMs = 0;

  for (const size of sizes) {
    const body = new Uint8Array(size); // zeros are fine for throughput testing
    const start = performance.now();
    await fetch(`${CF_BASE}/__up`, {
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

export async function runSpeedTest(): Promise<SpeedResult> {
  try {
    const { ping, jitter } = await withTimeout(measurePing(), TIMEOUT_MS);
    const [download_mbps, upload_mbps] = await Promise.all([
      withTimeout(measureDownload(), TIMEOUT_MS * 3),
      withTimeout(measureUpload(), TIMEOUT_MS * 2),
    ]);

    return {
      download_mbps: round2(download_mbps),
      upload_mbps: round2(upload_mbps),
      ping_ms: ping,
      jitter_ms: jitter,
      server_name: 'Cloudflare',
      server_location: 'Global CDN',
      result_url: 'https://speed.cloudflare.com',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      download_mbps: null,
      upload_mbps: null,
      ping_ms: null,
      jitter_ms: null,
      server_name: 'Cloudflare',
      server_location: '',
      result_url: '',
      error: msg,
    };
  }
}
