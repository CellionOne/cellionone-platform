import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  BarChart3, TrendingUp, Zap, Key, Lock, Star, CheckCircle2,
  Plus, Trash2, Copy, Activity, Shield, ArrowRight,
} from "lucide-react";
import { Link } from "wouter";

// ─── Types matching the actual API response shapes ────────────────────────────

interface StatusData {
  tier: "free" | "subscriber" | "pro";
  isPaid: boolean;
  subscription: {
    id: number; tier: string; status: string;
    currentPeriodEnd: string; cancelAtPeriodEnd: boolean;
  } | null;
}

interface PulseData {
  available: boolean;
  message?: string;
  asiIndex?: number | null;
  asiDailyChangePct?: number | null;
  brentCrudeUsd?: number | null;
  ngnPerUsd?: number | null;
  source?: string;
  updatedAt?: string;
}

interface SecurityItem {
  ticker: string; name: string; sector: string;
  ias: number | null; rs: number | null; cs: number | null;
  recommendation: string | null; scoreDate: string | null;
}

interface SecurityDetail {
  ticker: string; name: string; sector: string; isin: string | null;
  latestPrice: { date: string; closeNaira: number | null; volume: number } | null;
  scores: { scoreDate: string; ias: number; rs: number; cs: number; recommendation: string } | null;
  history: Array<{ date: string; ias: number; rs: number; cs: number }>;
  dividendAlert: { exDividendDate: string; amountPerShareNaira: number | null; daysUntil: number } | null;
}

interface Signal {
  id: number; ticker: string | null; type: string; sentiment: string;
  credibility: string; headline: string; body: string | null; publishedAt: string | null;
}

// API Keys match the portal route response: label/keyPrefix/permissions/rateLimit/totalCalls
interface ApiKey {
  id: number;
  label: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  totalCalls: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function iasColor(ias?: number | null) {
  if (ias === null || ias === undefined) return "text-muted-foreground";
  if (ias >= 70) return "text-green-600 dark:text-green-400 font-semibold";
  if (ias >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function recoBadge(rec: string | null) {
  if (!rec) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, string> = {
    "Strong Buy": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Accumulate": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    "Hold": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    "Reduce": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    "Sell": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[rec] ?? "bg-muted text-muted-foreground"}`}>{rec}</span>;
}

function starRating(ias: number | null) {
  if (ias === null) return null;
  const stars = ias >= 80 ? 5 : ias >= 65 ? 4 : ias >= 50 ? 3 : ias >= 35 ? 2 : 1;
  return (
    <span className="inline-flex gap-0.5" title={`IAS ${ias?.toFixed(1)}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function momentumDot(ias: number | null, rs: number | null) {
  if (ias === null || rs === null) return null;
  const combined = (ias + rs) / 2;
  const color = combined >= 70 ? "bg-green-500" : combined >= 50 ? "bg-amber-500" : "bg-red-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={`RS: ${rs?.toFixed(1)}`} />;
}

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ requiredTier, currentTier }: { requiredTier: string; currentTier: string }) {
  const map: Record<string, string> = { subscriber: "Subscriber (₦5,000/mo)", pro: "Pro (₦10,000/mo)" };
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-6" data-testid="section-upgrade-gate">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Upgrade Required</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          This section requires a <strong>{map[requiredTier] ?? requiredTier}</strong> plan.
          You are on the <strong className="capitalize">{currentTier}</strong> plan.
        </p>
      </div>
      <Button
        className="gap-2"
        onClick={() => document.querySelector<HTMLButtonElement>("[data-testid='tab-subscribe']")?.click()}
        data-testid="button-upgrade-cta"
      >
        Upgrade Now <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Market Pulse ─────────────────────────────────────────────────────────────

function MarketPulseTab() {
  const { data, isLoading } = useQuery<PulseData>({
    queryKey: ["/api/cie-portal/pulse"],
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>;

  if (!data?.available) {
    return (
      <Card data-testid="card-pulse-unavailable">
        <CardContent className="py-16 text-center">
          <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">{data?.message ?? "Market pulse data not yet available."}</p>
          <p className="text-xs text-muted-foreground mt-2">Check back after the next market session.</p>
        </CardContent>
      </Card>
    );
  }

  const changeColor = (v?: number | null) =>
    v == null ? "text-foreground" : v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";

  const metrics = [
    { label: "NGX ASI", value: data.asiIndex?.toLocaleString() ?? "—", color: "" },
    {
      label: "Day Change %",
      value: data.asiDailyChangePct != null
        ? (data.asiDailyChangePct >= 0 ? "+" : "") + data.asiDailyChangePct.toFixed(2) + "%"
        : "—",
      color: changeColor(data.asiDailyChangePct),
    },
    { label: "Brent Crude", value: data.brentCrudeUsd != null ? `$${data.brentCrudeUsd.toFixed(2)}` : "—", color: "" },
    { label: "USD / NGN", value: data.ngnPerUsd != null ? `₦${data.ngnPerUsd.toFixed(2)}` : "—", color: "" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <Card key={i} data-testid={`card-pulse-metric-${i}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            Last updated: {formatDate(data.updatedAt)} · Source: {data.source ?? "manual"}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Upgrade to <strong>Subscriber</strong> or <strong>Pro</strong> to access individual security scores,
            analyst recommendations, dividend calendars, and the full NGX intelligence suite.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Securities Tab ───────────────────────────────────────────────────────────

function SecuritiesTab({ tier }: { tier: string }) {
  const [search, setSearch] = useState("");
  const [recFilter, setRecFilter] = useState("all");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ securities: SecurityItem[]; count: number }>({
    queryKey: ["/api/cie-portal/securities"],
    enabled: tier !== "free",
  });

  const { data: detail, isLoading: detailLoading } = useQuery<SecurityDetail>({
    queryKey: ["/api/cie-portal/securities", selectedTicker],
    enabled: selectedTicker !== null,
    queryFn: async () => {
      const res = await fetch(`/api/cie-portal/securities/${selectedTicker}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load security");
      return res.json();
    },
  });

  if (tier === "free") return <UpgradeGate requiredTier="subscriber" currentTier="free" />;

  const allRecs = ["all", "Strong Buy", "Accumulate", "Hold", "Reduce", "Sell"];

  const filtered = (data?.securities ?? []).filter(s => {
    const matchSearch = search === "" ||
      s.ticker.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase());
    const matchRec = recFilter === "all" || s.recommendation === recFilter;
    return matchSearch && matchRec;
  });

  if (selectedTicker !== null) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => setSelectedTicker(null)} data-testid="button-back-securities">
          ← Back to Securities
        </Button>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl font-bold font-mono text-primary" data-testid="text-security-symbol">{detail.ticker}</h2>
                <p className="text-muted-foreground text-sm mt-1">{detail.name}</p>
                <p className="text-xs text-muted-foreground">{detail.sector}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                {detail.scores && recoBadge(detail.scores.recommendation)}
                {detail.scores && starRating(detail.scores.ias)}
                {detail.scores && <p className="text-xs text-muted-foreground">{formatDate(detail.scores.scoreDate)}</p>}
              </div>
            </div>

            {detail.dividendAlert && (
              <Card className="border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10" data-testid="card-dividend-alert">
                <CardContent className="p-4 flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-sm">
                    <strong>Dividend Alert:</strong> Ex-dividend {detail.dividendAlert.exDividendDate}
                    {detail.dividendAlert.amountPerShareNaira != null && ` — ₦${detail.dividendAlert.amountPerShareNaira.toFixed(2)}/share`}
                    &nbsp;({detail.dividendAlert.daysUntil} days away)
                  </p>
                </CardContent>
              </Card>
            )}

            {detail.scores && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Integrated Aggregate Score", abbr: "IAS", value: detail.scores.ias },
                  { label: "Relative Score (sector)", abbr: "RS", value: detail.scores.rs },
                  { label: "Composite Score", abbr: "CS", value: detail.scores.cs },
                ].map(m => (
                  <Card key={m.abbr} data-testid={`card-score-${m.abbr.toLowerCase()}`}>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{m.abbr}</p>
                      <p className={`text-4xl font-bold ${iasColor(m.value)}`}>{m.value.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{m.label}</p>
                      <div className="mt-2">{m.abbr === "IAS" && starRating(m.value)}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {detail.latestPrice && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Latest Trading Data</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Close</p>
                    <p className="text-xl font-bold">
                      {detail.latestPrice.closeNaira != null ? `₦${detail.latestPrice.closeNaira.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Volume</p>
                    <p className="text-xl font-bold">{detail.latestPrice.volume.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trade Date</p>
                    <p className="text-base font-medium">{detail.latestPrice.date}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {detail.history.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Score History (last 30 sessions)</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-center">IAS</TableHead>
                          <TableHead className="text-center">RS</TableHead>
                          <TableHead className="text-center">CS</TableHead>
                          <TableHead>Momentum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.history.slice(0, 15).map((h, i) => (
                          <TableRow key={i} data-testid={`row-history-${i}`}>
                            <TableCell className="text-sm">{h.date}</TableCell>
                            <TableCell className={`text-center text-sm ${iasColor(h.ias)}`}>{h.ias?.toFixed(1)}</TableCell>
                            <TableCell className="text-center text-sm">{h.rs?.toFixed(1)}</TableCell>
                            <TableCell className="text-center text-sm">{h.cs?.toFixed(1)}</TableCell>
                            <TableCell>{momentumDot(h.ias, h.rs)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search ticker or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
          data-testid="input-search-securities"
        />
        <div className="flex gap-1 flex-wrap">
          {allRecs.map(r => (
            <button
              key={r}
              onClick={() => setRecFilter(r)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                recFilter === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}
              data-testid={`filter-rec-${r}`}
            >
              {r === "all" ? "All" : r}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} securities</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Momentum</TableHead>
                    <TableHead className="text-center">IAS</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow
                      key={s.ticker}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTicker(s.ticker)}
                      data-testid={`row-security-${s.ticker}`}
                    >
                      <TableCell className="font-mono font-bold text-primary">{s.ticker}</TableCell>
                      <TableCell className="text-sm max-w-[140px] truncate">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.sector}</TableCell>
                      <TableCell>{momentumDot(s.ias, s.rs)}</TableCell>
                      <TableCell className={`text-center text-sm font-medium ${iasColor(s.ias)}`}>
                        {s.ias?.toFixed(1) ?? "—"}
                      </TableCell>
                      <TableCell>{starRating(s.ias)}</TableCell>
                      <TableCell>{recoBadge(s.recommendation)}</TableCell>
                      <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                        No securities match your filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Signals Tab ──────────────────────────────────────────────────────────────

function SignalsTab({ tier }: { tier: string }) {
  const { data, isLoading } = useQuery<{ signals: Signal[]; count: number }>({
    queryKey: ["/api/cie-portal/signals"],
    enabled: tier === "pro",
  });

  if (tier !== "pro") return <UpgradeGate requiredTier="pro" currentTier={tier} />;

  const credColor: Record<string, string> = {
    high: "text-green-600 dark:text-green-400",
    medium: "text-amber-600 dark:text-amber-400",
    low: "text-muted-foreground",
  };
  const sentimentEl = (s: string) => {
    if (s === "bullish") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (s === "bearish") return <Activity className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Real-time analyst trade calls and market intelligence — exclusive to Pro subscribers.</p>
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-3">
          {(data?.signals ?? []).map(s => (
            <Card key={s.id} className="border-border/60 hover:border-primary/20 transition-colors" data-testid={`card-signal-${s.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{sentimentEl(s.sentiment)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {s.ticker && <span className="font-mono text-primary font-semibold text-sm">{s.ticker}</span>}
                      <span className="text-xs capitalize bg-muted rounded px-1.5 py-0.5">{s.type.replace("_", " ")}</span>
                      <span className={`text-xs font-medium capitalize ${credColor[s.credibility] ?? ""}`}>
                        ● {s.credibility} credibility
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">{s.headline}</p>
                    {s.body && <p className="text-xs text-muted-foreground">{s.body}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(s.publishedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!data?.signals?.length && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">No signals published yet</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab({ tier }: { tier: string }) {
  const { toast } = useToast();
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["/api/cie-portal/api-keys"],
    enabled: tier !== "free",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cie-portal/api-keys", { label: newKeyLabel });
      return res.json() as Promise<{ apiKey: string; label: string; permissions: string[]; rateLimit: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/api-keys"] });
      if (data?.apiKey) setRevealedKey(data.apiKey);
      toast({ title: "API key created — copy it now, it won't be shown again" });
      setNewKeyLabel("");
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to create key", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/cie-portal/api-keys/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/api-keys"] });
      toast({ title: "API key deleted" });
    },
    onError: () => toast({ title: "Failed to delete key", variant: "destructive" }),
  });

  if (tier === "free") return <UpgradeGate requiredTier="subscriber" currentTier="free" />;

  return (
    <div className="space-y-6">
      {revealedKey && (
        <Card className="border-green-500/50 bg-green-50/30 dark:bg-green-900/10">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> New API key — copy it now, it won't be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border rounded px-3 py-2 text-sm font-mono break-all" data-testid="text-new-api-key">
                {revealedKey}
              </code>
              <Button
                size="sm" variant="outline"
                onClick={() => { navigator.clipboard.writeText(revealedKey!); toast({ title: "Copied!" }); }}
                data-testid="button-copy-api-key"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRevealedKey(null)} data-testid="button-dismiss-key">
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create New API Key</CardTitle>
          <CardDescription className="text-xs">
            Keys are scoped to your subscription tier. Subscriber: read-only, 500 req/min. Pro: 1,000 req/min.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Key label (e.g. my-trading-app)"
              value={newKeyLabel}
              onChange={e => setNewKeyLabel(e.target.value)}
              className="max-w-xs"
              data-testid="input-new-key-label"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newKeyLabel || createMutation.isPending}
              className="gap-2"
              data-testid="button-create-api-key"
            >
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Your API Keys</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Total Calls</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.keys ?? []).map(k => (
                  <TableRow key={k.id} data-testid={`row-api-key-${k.id}`}>
                    <TableCell className="text-sm font-medium">{k.label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.keyPrefix}</TableCell>
                    <TableCell className="text-xs">{k.permissions.join(", ")}</TableCell>
                    <TableCell className="text-xs">{k.rateLimit?.toLocaleString()} req/min</TableCell>
                    <TableCell className="text-xs">{k.totalCalls?.toLocaleString() ?? 0}</TableCell>
                    <TableCell>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => deleteMutation.mutate(k.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-key-${k.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.keys?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                      No API keys yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Subscription Tab ─────────────────────────────────────────────────────────

function SubscriptionTab({ status }: { status?: StatusData }) {
  const { toast } = useToast();
  const tier = status?.tier ?? "free";
  const sub = status?.subscription;
  const expiresLabel = sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null;

  const subscribeMutation = useMutation({
    mutationFn: async (newTier: "subscriber" | "pro") => {
      const res = await apiRequest("POST", "/api/cie-billing/subscribe", { tier: newTier });
      return res.json() as Promise<{ ok: boolean; data: { authorizationUrl: string; reference: string } }>;
    },
    onSuccess: (data) => {
      const url = data?.data?.authorizationUrl;
      if (url) window.location.href = url;
      else toast({ title: "Subscription initiated — check email to complete payment" });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to initiate subscription", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cie-billing/cancel", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/status"] });
      toast({ title: "Subscription will cancel at period end" });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to cancel", variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl space-y-6">
      {sub && (
        <Card className="border-primary/30" data-testid="card-active-subscription">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold capitalize">{sub.tier} Plan</p>
              <p className="text-xs text-muted-foreground">
                {sub.cancelAtPeriodEnd ? `Cancels on ${expiresLabel}` : `Renews on ${expiresLabel}`}
              </p>
            </div>
            {!sub.cancelAtPeriodEnd && (
              <Button
                size="sm" variant="outline"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                data-testid="button-cancel-subscription"
              >
                Cancel Plan
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {([
        {
          tier: "subscriber" as const,
          name: "Subscriber",
          price: "₦5,000 / month",
          features: [
            "Security-level IAS & RS scores for all NGX-listed securities",
            "Analyst recommendations (Strong Buy → Sell)",
            "Star ratings and momentum indicators",
            "Dividend calendar & corporate actions",
            "API access (500 req/min)",
          ],
          highlight: false,
        },
        {
          tier: "pro" as const,
          name: "Pro",
          price: "₦10,000 / month",
          features: [
            "Everything in Subscriber",
            "Analyst trade calls & signals",
            "Sector rotation alerts",
            "Credibility-rated intelligence feed",
            "Priority API access (1,000 req/min)",
            "Dedicated support channel",
          ],
          highlight: true,
        },
      ] as const).map((t, i) => (
        <Card
          key={i}
          className={`border transition-all ${t.highlight ? "border-primary/60 shadow-sm" : "border-border/60"}`}
          data-testid={`card-subscribe-tier-${i}`}
        >
          <CardContent className="p-5 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{t.name}</h3>
                {t.highlight && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Most Popular</span>
                )}
              </div>
              <p className="text-lg font-bold text-primary mb-3">{t.price}</p>
              <ul className="space-y-1.5">
                {t.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
            </div>
            <Button
              className="shrink-0"
              variant={t.highlight ? "default" : "outline"}
              disabled={tier === t.tier || subscribeMutation.isPending}
              onClick={() => subscribeMutation.mutate(t.tier)}
              data-testid={`button-subscribe-${t.tier}`}
            >
              {tier === t.tier ? "Current Plan" : "Subscribe"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CiePortal() {
  const { data: status } = useQuery<StatusData>({
    queryKey: ["/api/cie-portal/status"],
  });

  const tier = status?.tier ?? "free";

  const tierBadge = (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ml-2 ${
        tier === "pro"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
          : tier === "subscriber"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          : "bg-muted text-muted-foreground"
      }`}
      data-testid="badge-cie-tier"
    >
      {tier}
    </span>
  );

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "CIE Intelligence Portal" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center flex-wrap gap-1" data-testid="text-cie-portal-heading">
              NGX Intelligence Portal {tierBadge}
            </h1>
            <p className="text-sm text-muted-foreground">
              Equity scores, signals, dividends, and API access for the Nigerian Exchange Group
            </p>
          </div>
        </div>

        <Tabs defaultValue="pulse">
          <TabsList className="mb-6 flex-wrap h-auto gap-1" data-testid="tabs-cie-portal">
            <TabsTrigger value="pulse" className="gap-2" data-testid="tab-pulse">
              <Activity className="h-4 w-4" />Market Pulse
            </TabsTrigger>
            <TabsTrigger value="securities" className="gap-2" data-testid="tab-securities-portal">
              <BarChart3 className="h-4 w-4" />Securities
              {tier === "free" && <Lock className="h-3 w-3 opacity-60" />}
            </TabsTrigger>
            <TabsTrigger value="signals" className="gap-2" data-testid="tab-signals-portal">
              <Zap className="h-4 w-4" />Signals
              {tier !== "pro" && <Lock className="h-3 w-3 opacity-60" />}
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-2" data-testid="tab-api-keys">
              <Key className="h-4 w-4" />API Keys
              {tier === "free" && <Lock className="h-3 w-3 opacity-60" />}
            </TabsTrigger>
            <TabsTrigger value="subscribe" className="gap-2" data-testid="tab-subscribe">
              <Star className="h-4 w-4" />Subscription
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pulse"><MarketPulseTab /></TabsContent>
          <TabsContent value="securities"><SecuritiesTab tier={tier} /></TabsContent>
          <TabsContent value="signals"><SignalsTab tier={tier} /></TabsContent>
          <TabsContent value="api-keys"><ApiKeysTab tier={tier} /></TabsContent>
          <TabsContent value="subscribe"><SubscriptionTab status={status} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
