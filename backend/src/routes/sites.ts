import { Router } from 'express';
import { checkLatency } from '../latency.js';
import {
  createMySite,
  deleteMySite,
  getMySite,
  getSiteChecks,
  insertSiteCheck,
  listMySites,
  updateMySite,
} from '../db.js';

const router = Router();

function rangeToIso(range: string): string {
  const now = new Date();
  const map: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };
  const days = map[range] ?? 1;
  return new Date(now.getTime() - days * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
}

router.get('/', (_req, res) => {
  res.json(listMySites());
});

router.post('/', (req, res) => {
  const url = String(req.body?.url ?? '').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ success: false, error: 'url must start with http:// or https://' });
  }
  const result = createMySite(req.body ?? {});
  res.status(201).json({ success: true, id: Number(result.lastInsertRowid) });
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.body?.url !== undefined) {
    const url = String(req.body.url).trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'url must start with http:// or https://' });
    }
  }
  const result = updateMySite(id, req.body ?? {});
  res.json({ success: result.changes > 0 });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = deleteMySite(id);
  res.json({ success: result.changes > 0 });
});

router.post('/:id/check', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const site = getMySite(id);
  if (!site) return res.status(404).json({ success: false, error: 'site not found' });

  const result = await checkLatency(site.url);
  const insert = insertSiteCheck(site, result);
  res.json({ success: true, id: Number(insert.lastInsertRowid) });
});

router.get('/checks', (req, res) => {
  const range = (req.query.range as string) ?? '24h';
  res.json(getSiteChecks(rangeToIso(range)));
});

export default router;
