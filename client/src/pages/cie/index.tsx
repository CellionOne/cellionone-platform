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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  scores: { scoreDate: string; ias: number; rs: number; cs: number; recommendation: string; pillarBreakdown: any } | null;
  history: Array<{ date: string; ias: number; rs: number; cs: number }>;
  dividendAlert: { exDividendDate: string; amountPerShareNaira: number | null; daysUntil: number } | null;
}

interface Signal {
  id: number; ticker: string | null; type: string; sentiment: string;
  credibility: string; headline: string; body: string | null; publishedAt: string | null;
}

interface ApiKey {
  id: number; name: string; prefix: string; scopes: string[];
  createdAt: string; lastUsedAt: string | null; isActive: boolean;
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
          You are currently on the <strong className="capitalize">{currentTier}</strong> plan.
        </p>
      </div>
      <Button className="gap-2" onClick={() => document.querySelector<HTMLButtonElement>("[data-testid='tab-subscribe']")?.click()} data-testid="button-upgrade-cta">
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

  const changeColor = (v?: number | null) => !v ? "text-foreground" : v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";

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
    { label: "USD/NGN", value: data.ngnPerUsd != null ? `₦${data.ngnPerUsd.toFixed(2)}` : "—", color: "" },
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            Live — last updated {formatDate(data.updatedAt)} · Source: {data.source ?? "manual"}
          </div>
          <p className="text-sm mt-3 leading-relaxed text-muted-foreground">
            Upgrade to <strong>Subscriber</strong> or <strong>Pro</strong> to access individual security scores, analyst recommendations, dividend calendars, and the full NGX intelligence suite.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Securities Tab ───────────────────────────────────────────────────────────

function SecuritiesTab({ tier }: { tier: string }) {
  const [search, setSearch] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ securities: SecurityItem[]; count: number; sectors: string[] }>({
    queryKey: ["/api/cie-portal/securities"],
    enabled: tier !== "free",
  });

  const { data: detail, isLoading: detailLoading } = useQuery<SecurityDetail>({
    queryKey: ["/api/cie-portal/securities", selectedTicker],
    enabled: selectedTicker !== null,
  });

  if (tier === "free") return <UpgradeGate requiredTier="subscriber" currentTier="free" />;

  const filtered = (data?.securities ?? []).filter(s =>
    search === "" ||
    s.ticker.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (selectedTicker !== null) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => setSelectedTicker(null)} data-testid="button-back-securities">
          ← Back to Securities
        </Button>
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold font-mono text-primary" data-testid="text-security-symbol">{detail.ticker}</h2>
                <p className="text-muted-foreground">{detail.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{detail.sector}</p>
              </div>
              {detail.scores && (
                <div className="text-right">
                  {recoBadge(detail.scores.recommendation)}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(detail.scores.scoreDate)}</p>
                </div>
              )}
            </div>

            {detail.dividendAlert && (
              <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-900/10" data-testid="card-dividend-alert">
                <CardContent className="p-4 flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm">
                    <strong>Dividend Alert:</strong> Ex-dividend date is {detail.dividendAlert.exDividendDate}
                    {detail.dividendAlert.amountPerShareNaira != null && ` — ₦${detail.dividendAlert.amountPerShareNaira.toFixed(2)}/share`}
                    {` (${detail.dividendAlert.daysUntil} days away)`}
                  </p>
                </CardContent>
              </Card>
            )}

            {detail.scores && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "IAS", value: detail.scores.ias },
                  { label: "RS", value: detail.scores.rs },
                  { label: "CS", value: detail.scores.cs },
                ].map((m, i) => (
                  <Card key={i} data-testid={`card-score-${m.label.toLowerCase()}`}>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                      <p className={`text-3xl font-bold ${iasColor(m.value)}`}>{m.value.toFixed(1)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {detail.latestPrice && (
              <Card>
                <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Latest Close</p>
                    <p className="text-xl font-bold">
                      {detail.latestPrice.closeNaira != null ? `₦${detail.latestPrice.closeNaira.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Volume</p>
                    <p className="text-xl font-bold">{detail.latestPrice.volume.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Trade Date</p>
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.history.slice(0, 10).map((h, i) => (
                          <TableRow key={i} data-testid={`row-history-${i}`}>
                            <TableCell className="text-sm">{h.date}</TableCell>
                            <TableCell className={`text-center text-sm ${iasColor(h.ias)}`}>{h.ias?.toFixed(1)}</TableCell>
                            <TableCell className="text-center text-sm">{h.rs?.toFixed(1)}</TableCell>
                            <TableCell className="text-center text-sm">{h.cs?.toFixed(1)}</TableCell>
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
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search ticker or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-securities"
        />
        <span className="text-sm text-muted-foreground">{filtered.length} securities</span>
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
                    <TableHead className="text-center">IAS</TableHead>
                    <TableHead className="text-center">RS</TableHead>
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
                      <TableCell className="text-sm">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.sector}</TableCell>
                      <TableCell className={`text-center text-sm ${iasColor(s.ias)}`}>{s.ias?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell className="text-center text-sm">{s.rs?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell>{recoBadge(s.recommendation)}</TableCell>
                      <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">No securities match your search</TableCell>
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
    high: "text-green-600", medium: "text-amber-600", low: "text-muted-foreground",
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
                      <span className={`text-xs font-medium capitalize ${credColor[s.credibility]}`}>● {s.credibility} credibility</span>
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
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["/api/cie-portal/api-keys"],
    enabled: tier !== "free",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cie-portal/api-keys", { name: newKeyName }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/api-keys"] });
      if (res?.apiKey) setRevealedKey(res.apiKey);
      toast({ title: "API key created — copy it now, it won't be shown again" });
      setNewKeyName("");
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to create key", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cie-portal/api-keys/${id}`, undefined),
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
              <code className="flex-1 bg-background border rounded px-3 py-2 text-sm font-mono break-all" data-testid="text-new-api-key">{revealedKey}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(revealedKey); toast({ title: "Copied!" }); }} data-testid="button-copy-api-key">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRevealedKey(null)} data-testid="button-dismiss-key">Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create New API Key</CardTitle>
          <CardDescription className="text-xs">Keys are scoped to your subscription tier. Subscriber: read-only, 100 req/min. Pro: includes signals, 300 req/min.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Key name (e.g. my-trading-app)"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              className="max-w-xs"
              data-testid="input-new-key-name"
            />
            <Button onClick={() => createMutation.mutate()} disabled={!newKeyName || createMutation.isPending} className="gap-2" data-testid="button-create-api-key">
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
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.keys ?? []).map(k => (
                  <TableRow key={k.id} data-testid={`row-api-key-${k.id}`}>
                    <TableCell className="text-sm font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.prefix}…</TableCell>
                    <TableCell className="text-xs">{k.scopes.join(", ")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(k.createdAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.lastUsedAt ? formatDate(k.lastUsedAt) : "Never"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(k.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-key-${k.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!data?.keys?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">No API keys yet. Create one to get started.</TableCell>
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
    mutationFn: (plan: "subscriber" | "pro") => apiRequest("POST", "/api/cie-billing/subscribe", { plan }),
    onSuccess: (data: any) => {
      if (data?.paymentUrl) window.location.href = data.paymentUrl;
    },
    onError: (e: any) => toast({ title: e?.message ?? "Failed to initiate subscription", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/cie-billing/cancel", {}),
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
          plan: "subscriber" as const,
          name: "Subscriber",
          price: "₦5,000/month",
          features: ["Security-level IAS & RS scores", "Analyst recommendations", "Dividend calendar", "API access (100 req/min)"],
          highlight: false,
        },
        {
          plan: "pro" as const,
          name: "Pro",
          price: "₦10,000/month",
          features: ["Everything in Subscriber", "Analyst signals feed", "Sector rotation alerts", "Priority API (300 req/min)"],
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
                {t.highlight && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Most Popular</span>}
              </div>
              <p className="text-lg font-bold text-primary mb-3">{t.price}</p>
              <ul className="space-y-1">
                {t.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
            <Button
              className="shrink-0"
              variant={t.highlight ? "default" : "outline"}
              disabled={tier === t.plan || subscribeMutation.isPending}
              onClick={() => subscribeMutation.mutate(t.plan)}
              data-testid={`button-subscribe-${t.plan}`}
            >
              {tier === t.plan ? "Current Plan" : "Subscribe"}
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

  const tierBadgeEl = (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2 ${
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
            <h1 className="text-xl font-bold flex items-center" data-testid="text-cie-portal-heading">
              NGX Intelligence Portal {tierBadgeEl}
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
              {tier === "free" && <Lock className="h-3 w-3 ml-0.5 text-muted-foreground" />}
            </TabsTrigger>
            <TabsTrigger value="signals" className="gap-2" data-testid="tab-signals-portal">
              <Zap className="h-4 w-4" />Signals
              {tier !== "pro" && <Lock className="h-3 w-3 ml-0.5 text-muted-foreground" />}
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-2" data-testid="tab-api-keys">
              <Key className="h-4 w-4" />API Keys
              {tier === "free" && <Lock className="h-3 w-3 ml-0.5 text-muted-foreground" />}
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
