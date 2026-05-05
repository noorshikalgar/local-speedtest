import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ChevronDown, ChevronUp, Play, Plus, Trash2 } from 'lucide-react';
import { sitesApi, type MySite, type MySitePayload, type SiteCheck } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatActivityTime } from '@/lib/datetime';
import { SiteCheckDetailsDrawer } from './MonitorDetailsDrawer';

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

function Heatmap({ checks, onSelect }: { checks: SiteCheck[]; onSelect: (check: SiteCheck) => void }) {
  const recent = checks.slice(-48);
  return (
    <div className="flex flex-wrap gap-1">
      {recent.length === 0 && <span className="text-xs text-muted-foreground">No checks yet</span>}
      {recent.map(check => (
        <button
          key={check.id}
          title={`${check.site_name} ${check.status} ${check.latency_ms ?? '—'}ms`}
          onClick={(e) => { e.stopPropagation(); onSelect(check); }}
          className={cn('h-3 w-3 border border-background', statusTone(check.status))}
        />
      ))}
    </div>
  );
}

function AddSiteForm({ onAdd, isPending }: {
  onAdd: (form: MySitePayload) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    url: '',
    expected_status: 200,
    latency_threshold_ms: 500,
    interval_minutes: 15,
    enabled: true,
  });

  function submit() {
    if (!form.url.startsWith('http')) return;
    onAdd({ ...form, interval_minutes: Math.max(15, form.interval_minutes) });
    setForm({ name: '', url: '', expected_status: 200, latency_threshold_ms: 500, interval_minutes: 15, enabled: true });
  }

  return (
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
      <Button onClick={submit} disabled={isPending} size="sm" className="gap-2">
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}

export function MySitesPanel({ timezone }: { timezone?: string | null }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<SiteCheck | null>(null);

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.list, refetchInterval: 60_000 });
  const { data: checks = [], isLoading } = useQuery({
    queryKey: ['site-checks', '24h'],
    queryFn: () => sitesApi.checks('24h'),
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: sitesApi.create,
    onSuccess: () => {
      setShowForm(false);
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

  const bySite = useMemo(() => {
    const map = new Map<number, SiteCheck[]>();
    for (const check of checks) map.set(check.site_id, [...(map.get(check.site_id) ?? []), check]);
    return map;
  }, [checks]);

  return (
    <div className="space-y-4">
      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sites</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowForm(v => !v)}
          >
            {showForm ? <ChevronUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? 'Cancel' : 'New Site'}
          </Button>
        </div>

        {showForm && (
          <div className="border-b border-border bg-muted/20">
            <AddSiteForm onAdd={(form) => createMutation.mutate(form)} isPending={createMutation.isPending} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Site</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Target</th>
                <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Activity</th>
                <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">Last ms</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">No sites yet — click New Site to add one</td></tr>
              )}
              {sites.map(site => {
                const siteChecks = bySite.get(site.id) ?? [];
                const latestCheck = siteChecks.length > 0 ? siteChecks[siteChecks.length - 1] : null;
                return (
                  <tr
                    key={site.id}
                    onClick={() => latestCheck && setSelected(latestCheck)}
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/30 transition-colors',
                      latestCheck ? 'cursor-pointer' : '',
                    )}
                  >
                    <td className="px-3 py-2.5 text-xs font-medium">
                      <div>{site.name}</div>
                      <div className="text-[10px] text-muted-foreground">{host(site.url)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                      HTTP {site.expected_status} / {site.latency_threshold_ms}ms / {site.interval_minutes}m
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <Heatmap checks={siteChecks} onSelect={setSelected} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums hidden sm:table-cell">
                      {site.last_latency_ms != null ? site.last_latency_ms.toFixed(0) : '—'}
                    </td>
                    <td className="px-3 py-2.5">{statusBadge(site.last_status)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 px-1">
                          <Switch
                            checked={site.enabled === 1}
                            onCheckedChange={enabled => updateMutation.mutate({ id: site.id, data: { enabled } })}
                          />
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
                );
              })}
              {isLoading && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">
                  <Activity className="mr-1 inline h-3.5 w-3.5 animate-pulse" /> Loading checks…
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SiteCheckDetailsDrawer row={selected} timezone={timezone} onClose={() => setSelected(null)} />
    </div>
  );
}
