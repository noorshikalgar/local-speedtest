import { Router } from 'express';
import { getSpeedResults, getLatestSpeed, getSpeedPage, insertSpeedResult } from '../db.js';
import { runSpeedTest } from '../speedtest.js';
import { runAllTests, getSchedulerStatus } from '../scheduler.js';

const router = Router();

function rangeToIso(range: string): string {
  const now = new Date();
  const map: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
  const days = map[range] ?? 1;
  return new Date(now.getTime() - days * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
}

router.get('/', (req, res) => {
  const range = (req.query.range as string) ?? '24h';
  const since = rangeToIso(range);
  const results = getSpeedResults(since);
  res.json(results);
});

router.get('/latest', (_req, res) => {
  res.json(getLatestSpeed() ?? null);
});

router.get('/page', (req, res) => {
  const page = parseInt((req.query.page as string) ?? '1', 10);
  const pageSize = parseInt((req.query.pageSize as string) ?? '15', 10);
  const offset = (page - 1) * pageSize;
  res.json(getSpeedPage(offset, pageSize));
});

router.get('/status', (_req, res) => {
  res.json(getSchedulerStatus());
});

router.post('/run', async (_req, res) => {
  try {
    await runAllTests();
    res.json({ success: true, latest: getLatestSpeed() });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
