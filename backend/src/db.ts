import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'speedwatch.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS speed_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    download_mbps REAL,
    upload_mbps REAL,
    ping_ms REAL,
    jitter_ms REAL,
    server_name TEXT DEFAULT 'Cloudflare',
    server_location TEXT DEFAULT '',
    result_url TEXT DEFAULT '',
    is_manual INTEGER DEFAULT 0,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS latency_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    url TEXT NOT NULL,
    latency_ms REAL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_speed_ts ON speed_results(timestamp);
  CREATE INDEX IF NOT EXISTS idx_latency_ts ON latency_checks(timestamp);
`);

const DEFAULTS: Record<string, string> = {
  plan_download_mbps: '100',
  plan_upload_mbps: '50',
  test_interval_minutes: '120',
  retention_days: '90',
  alert_threshold_pct: '20',
  latency_sites: JSON.stringify(['https://google.com', 'https://cloudflare.com', 'https://github.com']),
};

const insertDefault = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULTS)) insertDefault.run(k, v);

export function getSetting(key: string): string | undefined {
  return (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any)?.value;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function insertSpeedResult(r: {
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  jitter_ms: number | null;
  server_name: string;
  server_location: string;
  result_url: string;
  is_manual: boolean;
  error?: string;
}) {
  return db.prepare(`
    INSERT INTO speed_results (timestamp, download_mbps, upload_mbps, ping_ms, jitter_ms, server_name, server_location, result_url, is_manual, error)
    VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(r.download_mbps, r.upload_mbps, r.ping_ms, r.jitter_ms, r.server_name, r.server_location, r.result_url, r.is_manual ? 1 : 0, r.error ?? null);
}

export function insertLatencyCheck(url: string, latency_ms: number | null, status: string) {
  db.prepare(`
    INSERT INTO latency_checks (timestamp, url, latency_ms, status)
    VALUES (datetime('now'), ?, ?, ?)
  `).run(url, latency_ms, status);
}

export function getSpeedResults(sinceIso: string, limit = 500) {
  return db.prepare(`
    SELECT * FROM speed_results WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT ?
  `).all(sinceIso, limit);
}

export function getLatestSpeed() {
  return db.prepare('SELECT * FROM speed_results ORDER BY timestamp DESC LIMIT 1').get();
}

export function getLatencyResults(sinceIso: string, limit = 500) {
  return db.prepare(`
    SELECT * FROM latency_checks WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT ?
  `).all(sinceIso, limit);
}

export function pruneOldData(retentionDays: number) {
  db.prepare(`DELETE FROM speed_results WHERE timestamp < datetime('now', '-' || ? || ' days')`).run(retentionDays);
  db.prepare(`DELETE FROM latency_checks WHERE timestamp < datetime('now', '-' || ? || ' days')`).run(retentionDays);
}

export function getSpeedPage(offset: number, pageSize: number) {
  const rows = db.prepare('SELECT * FROM speed_results ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(pageSize, offset);
  const total = (db.prepare('SELECT COUNT(*) as c FROM speed_results').get() as any).c;
  return { rows, total };
}

export default db;
