import { Router } from 'express';
import { getAllSettings, setSetting } from '../db.js';
import { restartScheduler } from '../scheduler.js';

const router = Router();
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

function normalizeTimezone(value: unknown): string {
  const timezone = String(value ?? '').trim();
  if (timezone === 'Asia/Kolkatta') return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

router.get('/', (_req, res) => {
  const raw = getAllSettings();
  res.json({
    plan_download_mbps: parseFloat(raw.plan_download_mbps ?? '100'),
    plan_upload_mbps: parseFloat(raw.plan_upload_mbps ?? '50'),
    test_interval_minutes: parseInt(raw.test_interval_minutes ?? '120', 10),
    retention_days: parseInt(raw.retention_days ?? '90', 10),
    alert_threshold_pct: parseInt(raw.alert_threshold_pct ?? '20', 10),
    display_timezone: normalizeTimezone(raw.display_timezone ?? DEFAULT_TIMEZONE),
    latency_sites: JSON.parse(raw.latency_sites ?? '[]'),
  });
});

router.put('/', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const allowedNumbers = ['plan_download_mbps', 'plan_upload_mbps', 'test_interval_minutes', 'retention_days', 'alert_threshold_pct'];
  const intervalChanged = body.test_interval_minutes !== undefined;

  for (const key of allowedNumbers) {
    if (body[key] !== undefined) {
      let val = parseFloat(String(body[key]));
      if (key === 'retention_days') val = Math.min(180, Math.max(1, val));
      setSetting(key, String(val));
    }
  }

  if (body.latency_sites !== undefined && Array.isArray(body.latency_sites)) {
    setSetting('latency_sites', JSON.stringify(body.latency_sites));
  }

  if (body.display_timezone !== undefined) {
    setSetting('display_timezone', normalizeTimezone(body.display_timezone));
  }

  if (intervalChanged) restartScheduler();

  res.json({ success: true });
});

export default router;
