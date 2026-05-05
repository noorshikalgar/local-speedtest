import cron from 'node-cron';
import { normalizeSpeedTestProvider, runSpeedTest, type SpeedTestProvider } from './speedtest.js';
import { checkLatency } from './latency.js';
import { getSetting, setSetting, insertSpeedResult, insertLatencyCheck, pruneOldData } from './db.js';

let currentTask: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRun: string | null = null;
let nextRunEstimate: string | null = null;

function minutesToCron(minutes: number): string {
  if (minutes < 60) return `*/${minutes} * * * *`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `0 */${hours} * * *`;
  return `0 */2 * * *`; // fallback
}

const ROUND_ROBIN_PROVIDERS: SpeedTestProvider[] = ['cloudflare', 'google', 'ookla'];

function nextProvider(): SpeedTestProvider {
  if (getSetting('speed_test_auto_round_robin') !== 'true') {
    return normalizeSpeedTestProvider(getSetting('speed_test_provider') ?? 'cloudflare');
  }

  const rawIndex = parseInt(getSetting('speed_test_round_robin_index') ?? '0', 10);
  const index = Number.isFinite(rawIndex) ? rawIndex : 0;
  const provider = ROUND_ROBIN_PROVIDERS[index % ROUND_ROBIN_PROVIDERS.length];
  setSetting('speed_test_round_robin_index', String((index + 1) % ROUND_ROBIN_PROVIDERS.length));
  return provider;
}

async function runAllTests() {
  if (isRunning) return;
  isRunning = true;
  lastRun = new Date().toISOString();
  console.log(`[scheduler] Running speed test at ${lastRun}`);

  try {
    const provider = nextProvider();
    const result = await runSpeedTest(provider);
    insertSpeedResult({ ...result, is_manual: false });
    console.log(`[scheduler] Done — ${provider} — ${result.download_mbps ?? 'ERR'} Mbps down`);

    const sitesRaw = getSetting('latency_sites') ?? '[]';
    const sites: string[] = JSON.parse(sitesRaw);
    for (const url of sites) {
      const result = await checkLatency(url);
      insertLatencyCheck(url, result);
    }

    const retention = parseInt(getSetting('retention_days') ?? '90', 10);
    pruneOldData(retention);
  } catch (err) {
    console.error('[scheduler] Error during test:', err);
  } finally {
    isRunning = false;
  }
}

export function startScheduler() {
  stopScheduler();
  const intervalMin = parseInt(getSetting('test_interval_minutes') ?? '120', 10);
  const expression = minutesToCron(intervalMin);
  console.log(`[scheduler] Scheduling tests every ${intervalMin}m (cron: ${expression})`);

  currentTask = cron.schedule(expression, runAllTests);

  const now = new Date();
  const next = new Date(now.getTime() + intervalMin * 60_000);
  nextRunEstimate = next.toISOString();
}

export function stopScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
}

export function restartScheduler() {
  startScheduler();
}

export function getSchedulerStatus() {
  return { isRunning, lastRun, nextRun: nextRunEstimate };
}

export { runAllTests };
