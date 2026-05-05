import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Play, Plus, Trash2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { sitesApi, type MySitePayload, type SiteCheck } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatActivityTime, formatChartTick } from '@/lib/datetime';
import { SiteCheckDetailsDrawer } from './MonitorDetailsDrawer';

type SiteRange = '24h' | '7d' | '30d';

const PALETTE = ['#22c55e', '#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6', '#84cc16'];
const RANGES: { label: string; value: SiteRange }[] = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

function host(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

function statusTone(status?: string | null) {
  if (status === 'ok') return 'bg-emerald-500';
  if (status === 'slow') return 'bg-amber-500';
  if (status === 'timeout') return 'bg-orange-600';
  if (!status) return 'bg-muted';
  return 'bg-red-500';
}

function statusBadge(status?: string | null) {
  if (status === 'ok') return <Badge variant="success">ok</Badge>;
  if (status === 'slow') return <Badge variant="warning">slow</Badge>;
  if (status === 'timeout') return <Badge variant="warning">timeout</Badge>;
  return <Badge variant="destructive">{status ?? 'none'}</Badge>;
}

function buildChart(checks: SiteCheck[]) {
  const names = [...new Set(checks.map(c => c.site_name))];
  const buckets = new Map<string, Record<string, number | null | string>>();
  for (const check of checks) {
    const ts = check.timestamp.substring(0, 16);
    if (!buckets.has(ts)) buckets.set(ts, { timestamp: ts });
    buckets.get(ts)![check.site_name] = check.status === 'ok' || check.status === 'slow' ? check.latency_ms : null;
  }
  return {
    names,
    rows: [...buckets.values()].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))),
  };
}

function Heatmap({ checks, onSelect }: { checks: SiteCheck[]; onSelect: (check: SiteCheck) => void }) {
  const recent = checks.slice(-48);
  return (
    <div className="flex flex-wrap gap-1">
      {recent.length === 0 && <span className="text-xs text-muted-foreground">No checks yet</span>}
      {recent.map(check => (
        <button
          key={check.id}
          title={`${check.site_name} ${check.status} ${check.latency_ms ?? '—'}ms`}
          onClick={() => onSelect(check)}
          className={cn('h-3 w-3 border border-background', statusTone(check.status))}
        />
      ))}
    </div>
  );
}

function CustomTooltip({ active, payload, label, timezone }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground mb-1">{formatActivityTime(String(label), timezone)}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums" style={{ color: p.color }}>{p.value != null ? `${Number(p.value).toFixed(0)} ms` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

export function MySitesPanel({ timezone }: { timezone?: string | null }) {
  const qc = useQueryClient();
  const [range, setRange] = useState<SiteRange>('24h');
  const [selected, setSelected] = useState<SiteCheck | null>(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    expected_status: 200,
    latency_threshold_ms: 500,
    interval_minutes: 15,
    enabled: true,
  });

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.list, refetchInterval: 60_000 });
  const { data: checks = [], isLoading } = useQuery({
    queryKey: ['site-checks', range],
    queryFn: () => sitesApi.checks(range),
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: sitesApi.create,
    onSuccess: () => {
      setForm({ name: '', url: '', expected_status: 200, latency_threshold_ms: 500, interval_minutes: 15, enabled: true });
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MySitePayload> }) => sitesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: sitesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['site-checks'] });
    },
  });
  const runMutation = useMutation({
    mutationFn: sitesApi.run,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['site-checks'] });
    },
  });

  const chart = useMemo(() => buildChart(checks), [checks]);
  const bySite = useMemo(() => {
    const map = new Map<number, SiteCheck[]>();
    for (const check of checks) map.set(check.site_id, [...(map.get(check.site_id) ?? []), check]);
    return map;
  }, [checks]);

  function addSite() {
    if (!form.url.startsWith('http')) return;
    createMutation.mutate({ ...form, interval_minutes: Math.max(15, form.interval_minutes) });
  }

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Add Site</span>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_2fr_120px_140px_120px_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="API" />
          </div>
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/health" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Input type="number" min={100} max={599} value={form.expected_status} onChange={e => setForm(f => ({ ...f, expected_status: parseInt(e.target.value, 10) || 200 }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Max ms</Label>
            <Input type="number" min={1} value={form.latency_threshold_ms} onChange={e => setForm(f => ({ ...f, latency_threshold_ms: parseInt(e.target.value, 10) || 500 }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Every min</Label>
            <Input type="number" min={15} value={form.interval_minutes} onChange={e => setForm(f => ({ ...f, interval_minutes: parseInt(e.target.value, 10) || 15 }))} />
          </div>
          <Button onClick={addSite} disabled={createMutation.isPending} size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Site Latency</span>
          <Tabs value={range} onValueChange={v => setRange(v as SiteRange)}>
            <TabsList>{RANGES.map(r => <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>)}</TabsList>
          </Tabs>
        </div>
        <div className="h-64 p-4">
          {chart.rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No site checks yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart.rows} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="timestamp" tickFormatter={v => formatChartTick(v, range, timezone)} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit="ms" />
                <Tooltip content={<CustomTooltip timezone={timezone} />} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 8 }} formatter={v => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{v}</span>} />
                {chart.names.map((name, i) => <Line key={name} type="monotone" dataKey={name} name={name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} connectNulls={false} />)}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sites</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Site</th>
                <th className="px-3 py-2 text-left font-medium">Target</th>
                <th className="px-3 py-2 text-left font-medium">Activity</th>
                <th className="px-3 py-2 text-right font-medium">Last ms</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">No sites yet</td></tr>}
              {sites.map(site => (
                <tr key={site.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <div>{site.name}</div>
                    <div className="text-[10px] text-muted-foreground">{host(site.url)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">HTTP {site.expected_status} / {site.latency_threshold_ms}ms / {site.interval_minutes}m</td>
                  <td className="px-3 py-2.5"><Heatmap checks={bySite.get(site.id) ?? []} onSelect={setSelected} /></td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums">{site.last_latency_ms != null ? site.last_latency_ms.toFixed(0) : '—'}</td>
                  <td className="px-3 py-2.5">{statusBadge(site.last_status)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <div className="flex items-center gap-1 px-1">
                        <Switch checked={site.enabled === 1} onCheckedChange={enabled => updateMutation.mutate({ id: site.id, data: { enabled } })} />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => runMutation.mutate(site.id)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(site.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground"><Activity className="mr-1 inline h-3.5 w-3.5 animate-pulse" /> Loading checks…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <SiteCheckDetailsDrawer row={selected} timezone={timezone} onClose={() => setSelected(null)} />
    </div>
  );
}
