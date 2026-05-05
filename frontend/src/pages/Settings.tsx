import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, CheckCircle } from 'lucide-react';
import { settingsApi, type Settings } from '@/api/client';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUnit } from '@/contexts/unit';
import { unitLabel, mbpsFromDisplay, toDisplaySpeed, speedEquivalent } from '@/lib/utils';

const INTERVALS = [
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '6 hours', value: 360 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
];

const RETENTION_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days (default)', value: 90 },
  { label: '180 days (max)', value: 180 },
];

export function SettingsPage() {
  const qc = useQueryClient();
  const { unit } = useUnit();
  const ul = unitLabel(unit);

  const { data: remote } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const [form, setForm] = useState<Settings | null>(null);
  const [newSite, setNewSite] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (remote && !form) setForm(remote);
  }, [remote]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (!form) return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
    </div>
  );

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f);
  }

  function addSite() {
    const url = newSite.trim();
    if (!url || !url.startsWith('http')) return;
    set('latency_sites', [...form!.latency_sites, url]);
    setNewSite('');
  }

  function removeSite(i: number) {
    set('latency_sites', form!.latency_sites.filter((_, idx) => idx !== i));
  }

  // Plan speed: form always stores Mbps internally; display in current unit
  const dlDisplay = toDisplaySpeed(form.plan_download_mbps, unit) ?? 0;
  const ulDisplay = toDisplaySpeed(form.plan_upload_mbps, unit) ?? 0;

  function setDl(displayVal: number) {
    set('plan_download_mbps', mbpsFromDisplay(displayVal, unit));
  }
  function setUl(displayVal: number) {
    set('plan_upload_mbps', mbpsFromDisplay(displayVal, unit));
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6 animate-in fade-in-0 duration-300">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold uppercase tracking-widest">Settings</h1>
          <Button onClick={() => form && saveMutation.mutate(form)} disabled={saveMutation.isPending} size="sm" className="gap-2">
            {saved ? <><CheckCircle className="h-3.5 w-3.5" /> Saved</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
          </Button>
        </div>

        {/* Plan Speed */}
        <Card>
          <CardHeader><CardTitle>Plan Speed</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dl">Download ({ul})</Label>
                <Input
                  id="dl" type="number" min={0.1} step={unit === 'MBps' ? 0.1 : 1}
                  value={unit === 'MBps' ? dlDisplay.toFixed(2) : dlDisplay.toFixed(0)}
                  onChange={(e) => setDl(parseFloat(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground">
                  = {speedEquivalent(form.plan_download_mbps, unit)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ul">Upload ({ul})</Label>
                <Input
                  id="ul" type="number" min={0.1} step={unit === 'MBps' ? 0.1 : 1}
                  value={unit === 'MBps' ? ulDisplay.toFixed(2) : ulDisplay.toFixed(0)}
                  onChange={(e) => setUl(parseFloat(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground">
                  = {speedEquivalent(form.plan_upload_mbps, unit)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Alert Threshold (%)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="threshold" type="number" min={5} max={80} className="w-24"
                  value={form.alert_threshold_pct}
                  onChange={(e) => set('alert_threshold_pct', parseInt(e.target.value) || 20)}
                />
                <span className="text-xs text-muted-foreground">
                  Alert when speed drops below {100 - form.alert_threshold_pct}% of plan
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader><CardTitle>Test Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label>Run speed test every</Label>
            <Select
              value={String(form.test_interval_minutes)}
              onValueChange={(v) => set('test_interval_minutes', parseInt(v, 10))}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVALS.map((i) => (
                  <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Retention */}
        <Card>
          <CardHeader><CardTitle>Data Retention</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label>Keep results for</Label>
            <Select
              value={String(form.retention_days)}
              onValueChange={(v) => set('retention_days', parseInt(v, 10))}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RETENTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Latency Sites */}
        <Card>
          <CardHeader><CardTitle>Latency Monitoring</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Sites checked after each speed test.</p>
            <Separator />
            <div className="space-y-1.5">
              {form.latency_sites.map((site, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <code className="flex-1 text-xs border border-border bg-muted px-3 py-2 text-muted-foreground">{site}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => removeSite(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSite()}
                className="text-xs"
              />
              <Button variant="outline" size="sm" onClick={addSite} className="gap-1.5 shrink-0">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
