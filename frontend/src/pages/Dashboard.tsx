import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  speedApi, settingsApi, latencyApi,
  type TimeRange, type SpeedResult, type LatencyCheck, type Settings,
} from '@/api/client';
import { Header } from '@/components/Header';
import { StatCards } from '@/components/StatCards';
import { AlertBanner } from '@/components/AlertBanner';
import { SpeedChart } from '@/components/SpeedChart';
import { SpeedTable } from '@/components/SpeedTable';
import { CombinedChart } from '@/components/CombinedChart';
import { LatencyChart } from '@/components/LatencyChart';
import { LatencyTable } from '@/components/LatencyTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { fmtSpeed, fmtMs, speedStatus, unitLabel } from '@/lib/utils';
import { useUnit } from '@/contexts/unit';
import { cn } from '@/lib/utils';

type LatencyRange = '24h' | '7d' | '30d';
type ViewTab = 'combined' | 'speed' | 'latency';

function fmtTs(ts: string) {
  try { return format(parseISO(ts.replace(' ', 'T')), 'MMM d, HH:mm'); } catch { return ts; }
}
function host(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}
// minute bucket for grouping test runs
function bucket(ts: string) { return ts.substring(0, 16); }

// ─── Unified timeline row types ───────────────────────────────────────────────
type SpeedEntry  = { kind: 'speed';   bkt: string; data: SpeedResult };
type LatencyEntry = { kind: 'latency'; bkt: string; data: LatencyCheck };
type Entry = SpeedEntry | LatencyEntry;

function buildTimeline(speedRows: SpeedResult[], latencyRows: LatencyCheck[]): Entry[] {
  const entries: Entry[] = [
    ...speedRows.map(r => ({ kind: 'speed'   as const, bkt: bucket(r.timestamp), data: r })),
    ...latencyRows.map(r => ({ kind: 'latency' as const, bkt: bucket(r.timestamp), data: r })),
  ];
  // sort descending by raw timestamp
  entries.sort((a, b) => b.data.timestamp.localeCompare(a.data.timestamp));
  return entries;
}

// ─── Unified table ────────────────────────────────────────────────────────────
function CombinedTable({ speedRows, latencyRows, settings }: {
  speedRows: SpeedResult[];
  latencyRows: LatencyCheck[];
  settings: Settings | null;
}) {
  const { unit } = useUnit();
  const ul = unitLabel(unit);
  const planDl   = settings?.plan_download_mbps ?? 100;
  const threshold = settings?.alert_threshold_pct ?? 20;

  // show last 30 entries (speed + latency combined)
  const entries = buildTimeline(speedRows, latencyRows).slice(0, 30);

  // track bucket changes to draw a divider between test-run groups
  let lastBkt = '';

  return (
    <div className="border border-border bg-card animate-in fade-in-0 duration-700">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recent Activity</span>
      </div>

      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No records yet — run a speed test</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left  font-medium w-32">Time</th>
                <th className="px-3 py-2 text-left  font-medium w-16">Type</th>
                {/* shared col: download speed OR hostname */}
                <th className="px-3 py-2 text-left  font-medium">DL ({ul}) / Host</th>
                {/* upload — only speed rows use this */}
                <th className="px-3 py-2 text-right font-medium w-24">UL ({ul})</th>
                {/* ping / latency ms */}
                <th className="px-3 py-2 text-right font-medium w-20">ms</th>
                <th className="px-3 py-2 text-left  font-medium w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const isNewBatch = entry.bkt !== lastBkt;
                lastBkt = entry.bkt;

                if (entry.kind === 'speed') {
                  const row = entry.data;
                  const st   = row.error ? 'low' : speedStatus(row.download_mbps, planDl, threshold);
                  const isLow  = st === 'low'  || !!row.error;
                  const isWarn = st === 'warn' && !row.error;

                  return (
                    <tr
                      key={`s-${row.id}`}
                      className={cn(
                        'hover:bg-muted/30 transition-colors animate-in fade-in-0 slide-in-from-bottom-1',
                        isNewBatch ? 'border-t-2 border-primary/25' : 'border-t border-border/40',
                        isLow  && 'bg-red-950/20',
                        isWarn && 'bg-amber-950/10',
                      )}
                      style={{ animationDelay: `${i * 20}ms`, animationDuration: '200ms' }}
                    >
                      <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">{fmtTs(row.timestamp)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">spd</Badge>
                      </td>
                      {/* DL */}
                      <td className={cn('px-3 py-2.5 text-xs tabular-nums font-semibold',
                        isLow ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-cyan-400')}>
                        {fmtSpeed(row.download_mbps, unit)}
                      </td>
                      {/* UL */}
                      <td className="px-3 py-2.5 text-xs tabular-nums text-right text-emerald-400">
                        {fmtSpeed(row.upload_mbps, unit)}
                      </td>
                      {/* ping */}
                      <td className="px-3 py-2.5 text-xs tabular-nums text-right text-orange-400">
                        {fmtMs(row.ping_ms)}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.error          ? <Badge variant="destructive">error</Badge>
                          : st === 'good'   ? <Badge variant="success">good</Badge>
                          : st === 'warn'   ? <Badge variant="warning">warn</Badge>
                          :                   <Badge variant="destructive">low</Badge>}
                      </td>
                    </tr>
                  );
                }

                // ── latency row ──────────────────────────────────────────────
                const row  = entry.data;
                const isOk = row.status === 'ok';

                return (
                  <tr
                    key={`l-${row.id}`}
                    className={cn(
                      'hover:bg-muted/30 transition-colors animate-in fade-in-0 slide-in-from-bottom-1',
                      isNewBatch ? 'border-t-2 border-primary/25' : 'border-t border-border/40',
                    )}
                    style={{ animationDelay: `${i * 20}ms`, animationDuration: '200ms' }}
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{fmtTs(row.timestamp)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">lat</Badge>
                    </td>
                    {/* hostname in DL/Host col */}
                    <td className="px-3 py-2 text-xs font-medium text-foreground">{host(row.url)}</td>
                    {/* no upload for latency */}
                    <td className="px-3 py-2 text-xs text-right text-muted-foreground/40">—</td>
                    {/* latency ms */}
                    <td className={cn('px-3 py-2 text-xs tabular-nums text-right',
                      isOk ? 'text-orange-400' : 'text-muted-foreground/50')}>
                      {isOk && row.latency_ms != null ? fmtMs(row.latency_ms) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {isOk                          ? <Badge variant="success">ok</Badge>
                        : row.status === 'timeout'   ? <Badge variant="warning">timeout</Badge>
                        :                              <Badge variant="destructive">{row.status}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function Dashboard() {
  const [view, setView] = useState<ViewTab>('combined');
  const [speedRange, setSpeedRange]   = useState<TimeRange>('24h');
  const [latencyRange, setLatencyRange] = useState<LatencyRange>('24h');
  const [refreshKey, setRefreshKey] = useState(0);
  const qc = useQueryClient();

  const { data: latest }   = useQuery({ queryKey: ['latest'],   queryFn: speedApi.latest,   refetchInterval: 30_000 });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const { data: chartData = [] } = useQuery({
    queryKey: ['speeds', speedRange, refreshKey],
    queryFn: () => speedApi.list(speedRange),
    refetchInterval: 60_000,
  });
  const { data: latencyData = [], isLoading: latencyLoading } = useQuery({
    queryKey: ['latency', latencyRange, refreshKey],
    queryFn: () => latencyApi.list(latencyRange),
    refetchInterval: 60_000,
  });
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: speedApi.status, refetchInterval: 10_000 });

  const runMutation = useMutation({
    mutationFn: speedApi.run,
    onSuccess: () => {
      setRefreshKey(k => k + 1);
      qc.invalidateQueries({ queryKey: ['latest'] });
      qc.invalidateQueries({ queryKey: ['speeds'] });
      qc.invalidateQueries({ queryKey: ['latency'] });
      qc.invalidateQueries({ queryKey: ['status'] });
    },
  });

  const isTestRunning = runMutation.isPending || status?.isRunning;

  const RunButton = (
    <Button onClick={() => runMutation.mutate()} disabled={isTestRunning} size="sm" className="gap-2">
      {isTestRunning
        ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing…</>
        : <><Play          className="h-3.5 w-3.5" />             Run Test Now</>}
    </Button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header isRunning={isTestRunning} nextRun={status?.nextRun} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-5 space-y-4">
        <Tabs value={view} onValueChange={v => setView(v as ViewTab)}>
          <TabsList className="h-8">
            <TabsTrigger value="combined">Combined</TabsTrigger>
            <TabsTrigger value="speed">Speed Test</TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
          </TabsList>

          {/* ── Combined ── */}
          <TabsContent value="combined" className="space-y-4 mt-4">
            <AlertBanner latest={latest ?? null} settings={settings ?? null} />
            <StatCards   latest={latest ?? null} settings={settings ?? null} />
            <div className="flex justify-end">{RunButton}</div>
            <CombinedChart speedData={chartData} latencyData={latencyData} settings={settings ?? null} />
            <CombinedTable speedRows={chartData} latencyRows={latencyData} settings={settings ?? null} />
          </TabsContent>

          {/* ── Speed Test ── */}
          <TabsContent value="speed" className="space-y-4 mt-4">
            <AlertBanner latest={latest ?? null} settings={settings ?? null} />
            <StatCards   latest={latest ?? null} settings={settings ?? null} />
            <div className="flex justify-end">{RunButton}</div>
            <SpeedChart data={chartData} settings={settings ?? null} range={speedRange} onRangeChange={setSpeedRange} />
            <SpeedTable settings={settings ?? null} refreshKey={refreshKey} />
          </TabsContent>

          {/* ── Latency ── */}
          <TabsContent value="latency" className="space-y-4 mt-4">
            <LatencyChart data={latencyData} range={latencyRange} onRangeChange={setLatencyRange} />
            <LatencyTable data={latencyData} isLoading={latencyLoading} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
