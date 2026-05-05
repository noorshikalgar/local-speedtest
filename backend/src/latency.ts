export async function checkLatency(url: string): Promise<{ latency_ms: number | null; status: string }> {
  try {
    const start = performance.now();
    const res = await Promise.race([
      fetch(url, { method: 'HEAD', redirect: 'follow' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]);
    const ms = Math.round((performance.now() - start) * 10) / 10;
    return { latency_ms: ms, status: (res as Response).ok ? 'ok' : `http_${(res as Response).status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { latency_ms: null, status: msg.includes('timeout') ? 'timeout' : 'error' };
  }
}
