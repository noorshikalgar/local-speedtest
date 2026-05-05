import { Router } from 'express';
import { getLatencyResults } from '../db.js';

const router = Router();

function rangeToIso(range: string): string {
  const now = new Date();
  const map: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };
  const days = map[range] ?? 1;
  return new Date(now.getTime() - days * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
}

router.get('/', (req, res) => {
  const range = (req.query.range as string) ?? '24h';
  const since = rangeToIso(range);
  res.json(getLatencyResults(since));
});

export default router;
