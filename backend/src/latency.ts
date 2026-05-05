export interface LatencyResult {
  latency_ms: number | null;
  status: string;
  final_url: string;
  http_status: number | null;
  status_text: string;
  response_server: string;
  content_type: string;
  error_message: string;
}

export async function checkLatency(url: string): Promise<LatencyResult> {
  try {
    const start = performance.now();
    const res = await Promise.race([
      fetch(url, { method: 'HEAD', redirect: 'follow' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]);
    const response = res as Response;
    const ms = Math.round((performance.now() - start) * 10) / 10;
    return {
      latency_ms: ms,
      status: response.ok ? 'ok' : `http_${response.status}`,
      final_url: response.url || url,
      http_status: response.status,
      status_text: response.statusText,
      response_server: response.headers.get('server') ?? '',
      content_type: response.headers.get('content-type') ?? '',
      error_message: '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      latency_ms: null,
      status: msg.includes('timeout') ? 'timeout' : 'error',
      final_url: url,
      http_status: null,
      status_text: '',
      response_server: '',
      content_type: '',
      error_message: msg,
    };
  }
}
