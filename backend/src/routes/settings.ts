import { Router } from 'express';
import { getAllSettings, setSetting } from '../db.js';
import { restartScheduler } from '../scheduler.js';

const router = Router();

router.get('/', (_req, res) => {
  const raw = getAllSettings();
  res.json({
    plan_download_mbps: parseFloat(raw.plan_download_mbps ?? '100'),
    plan_upload_mbps: parseFloat(raw.plan_upload_mbps ?? '50'),
    test_interval_minutes: parseInt(raw.test_interval_minutes ?? '120', 10),
    retention_days: parseInt(raw.retention_days ?? '90', 10),
    alert_threshold_pct: parseInt(raw.alert_threshold_pct ?? '20', 10),
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

  if (intervalChanged) restartScheduler();

  res.json({ success: true });
});

export default router;
