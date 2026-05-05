import cron from 'node-cron';
import { runSpeedTest } from './speedtest.js';
import { checkLatency } from './latency.js';
import { getSetting, insertSpeedResult, insertLatencyCheck, pruneOldData } from './db.js';

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

async function runAllTests() {
  if (isRunning) return;
  isRunning = true;
  lastRun = new Date().toISOString();
  console.log(`[scheduler] Running speed test at ${lastRun}`);

  try {
    const result = await runSpeedTest();
    insertSpeedResult({ ...result, is_manual: false });
    console.log(`[scheduler] Done — ${result.download_mbps ?? 'ERR'} Mbps down`);

    const sitesRaw = getSetting('latency_sites') ?? '[]';
    const sites: string[] = JSON.parse(sitesRaw);
    for (const url of sites) {
      const { latency_ms, status } = await checkLatency(url);
      insertLatencyCheck(url, latency_ms, status);
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
