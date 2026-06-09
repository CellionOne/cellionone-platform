import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, Download,
  Plus, Edit2, Trash2, BarChart3, Zap, Calendar, Database, FileSpreadsheet,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Security {
  id: number; symbol: string; name: string; sector: string;
  lastPriceKobo: number | null; dayChangePct: string | null;
  weekChangePct: string | null; signal: string | null;
  recommendation: string | null; rsi: string | null;
  momentum: string | null; investmentIntel: string | null;
  lastUpdatedAt: string | null;
}

interface SectorSummary {
  name: string; stockCount: number; avgDayChangePct: number;
  avgWeekChangePct: number; bullishCount: number; bearishCount: number;
  topPerformer: { ticker: string; dayChangePct: number } | null;
  bottomPerformer: { ticker: string; dayChangePct: number } | null;
  analystNote: string;
}

interface NgxDividend {
  id: number; ticker: string; companyName: string;
  dividendAmountKobo: number; qualificationDate: string;
  paymentDate: string | null; source: string; isActive: boolean;
  createdAt: string;
}

interface CieReport {
  id: number; reportDate: string; fileSize: number | null;
  securitiesCount: number | null; generatedAt: string; status: string;
  errorMessage: string | null;
}

interface DataSources {
  iconEtradeFeed: { lastEventReceived: string | null; eventsToday: number; priceUpdates: number; volumeEvents: number };
  manualEntry: { dividendsEntered: number; lastUpdated: string | null };
  ngxCoverage: { total: number; withDataToday: number; staleSecurities: string[] };
  dataFreshness: { overall: string; coveragePct: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: string | null }) {
  if (signal === "↑") return <span className="text-green-600 font-bold text-base">↑</span>;
  if (signal === "↓") return <span className="text-red-600 font-bold text-base">↓</span>;
  return <span className="text-muted-foreground">─</span>;
}

function PctCell({ val }: { val: string | number | null | undefined }) {
  if (val == null) return <span className="text-muted-foreground text-xs">—</span>;
  const n = parseFloat(String(val));
  const cls = n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : "text-muted-foreground";
  return <span className={`text-xs font-medium ${cls}`}>{n > 0 ? "+" : ""}{n.toFixed(2)}%</span>;
}

function FreshnessBadge({ freshness }: { freshness: string }) {
  if (freshness === "live") return <Badge className="bg-green-600 text-xs">Live</Badge>;
  if (freshness === "delayed") return <Badge className="bg-amber-500 text-xs">Delayed</Badge>;
  return <Badge variant="destructive" className="text-xs">Stale</Badge>;
}

function relativeTime(ts: string | null): string {
  if (!ts) return "Never";
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Tab 1: Live Pulse ────────────────────────────────────────────────────────

function LivePulseTab() {
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, refetch } = useQuery<{ securities: Security[] }>({
    queryKey: ["/api/admin/cie/intelligence/securities"],
  });
  const { data: pulseData } = useQuery<{ pulse: any; context: any }>({
    queryKey: ["/api/admin/cie/intelligence/pulse"],
  });

  const securities = data?.securities ?? [];
  const sorted = [...securities].sort((a, b) => {
    const av = parseFloat(String(a.dayChangePct ?? "0"));
    const bv = parseFloat(String(b.dayChangePct ?? "0"));
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const now = Date.now();
  let lastUpdated: Date | null = null;
  for (const s of securities) {
    if (s.lastUpdatedAt) {
      const d = new Date(s.lastUpdatedAt);
      if (!lastUpdated || d > lastUpdated) lastUpdated = d;
    }
  }
  const ageMs = lastUpdated ? now - lastUpdated.getTime() : Infinity;
  const freshness = ageMs < oneHour ? "live" : ageMs < oneDay ? "delayed" : "stale";

  const gainers = securities.filter(s => s.dayChangePct != null && parseFloat(String(s.dayChangePct)) > 0).length;
  const losers = securities.filter(s => s.dayChangePct != null && parseFloat(String(s.dayChangePct)) < 0).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Gainers</p>
            <p className="text-xl font-bold text-green-600">{gainers}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Losers</p>
            <p className="text-xl font-bold text-red-600">{losers}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[120px]">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Total Securities</p>
            <p className="text-xl font-bold">{securities.length}</p>
          </CardContent>
        </Card>
        <div className="flex items-center gap-2 ml-auto">
          <FreshnessBadge freshness={freshness} />
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdated ? relativeTime(lastUpdated.toISOString()) : "Never"}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 h-8">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 text-xs"
                        onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}>
                        Day% {sortDir === "desc" ? "▼" : "▲"}
                      </button>
                    </TableHead>
                    <TableHead>Sig</TableHead>
                    <TableHead>RSI</TableHead>
                    <TableHead>Rec</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm font-semibold">{s.symbol}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.sector}</TableCell>
                      <TableCell className="text-sm">
                        {s.lastPriceKobo != null ? `₦${(s.lastPriceKobo / 100).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell><PctCell val={s.dayChangePct} /></TableCell>
                      <TableCell><SignalBadge signal={s.signal} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.rsi != null ? parseFloat(String(s.rsi)).toFixed(0) : "—"}
                      </TableCell>
                      <TableCell>
                        {s.recommendation
                          ? <Badge variant={s.recommendation === "BUY" ? "default" : s.recommendation === "REDUCE" ? "destructive" : "secondary"} className="text-xs">{s.recommendation}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {relativeTime(s.lastUpdatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8 text-sm">
                        No securities data yet. Waiting for events from Icon eTrade feed.
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

// ── Tab 2: Sector Summary ────────────────────────────────────────────────────

function SectorSummaryTab() {
  const { data, isLoading } = useQuery<{ sectors: SectorSummary[] }>({
    queryKey: ["/api/admin/cie/intelligence/sectors"],
  });
  const sectors = data?.sectors ?? [];

  if (isLoading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  if (sectors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No sector data yet. Securities data will populate this view once price events are received.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sectors.map(s => (
        <Card key={s.name} className={s.avgDayChangePct > 0 ? "border-green-200/60" : s.avgDayChangePct < 0 ? "border-red-200/60" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{s.name}</CardTitle>
              <PctCell val={s.avgDayChangePct} />
            </div>
            <p className="text-xs text-muted-foreground">{s.stockCount} stocks</p>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            {s.topPerformer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Top</span>
                <span className="text-green-600 font-medium">{s.topPerformer.ticker} +{s.topPerformer.dayChangePct.toFixed(2)}%</span>
              </div>
            )}
            {s.bottomPerformer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bottom</span>
                <span className="text-red-600 font-medium">{s.bottomPerformer.ticker} {s.bottomPerformer.dayChangePct.toFixed(2)}%</span>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <span className="text-green-600">{s.bullishCount} bullish</span>
              <span className="text-red-600">{s.bearishCount} bearish</span>
            </div>
            <p className="text-muted-foreground italic pt-0.5">{s.analystNote}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Tab 3: Dividend Calendar ─────────────────────────────────────────────────

function DividendCalendarTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<NgxDividend | null>(null);
  const [form, setForm] = useState({ ticker: "", company_name: "", dividend_amount_ngn: "", qualification_date: "", payment_date: "" });

  const { data, isLoading } = useQuery<{ dividends: NgxDividend[] }>({
    queryKey: ["/api/admin/cie/intelligence/dividends"],
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/admin/cie/intelligence/dividends", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/intelligence/dividends"] });
      toast({ title: "Dividend added" });
      setShowAdd(false);
      setForm({ ticker: "", company_name: "", dividend_amount_ngn: "", qualification_date: "", payment_date: "" });
    },
    onError: () => toast({ title: "Failed to add dividend", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      apiRequest("PUT", `/api/admin/cie/intelligence/dividends/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/intelligence/dividends"] });
      toast({ title: "Dividend updated" });
      setEditItem(null);
    },
    onError: () => toast({ title: "Failed to update dividend", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/cie/intelligence/dividends/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cie/intelligence/dividends"] });
      toast({ title: "Dividend removed" });
    },
    onError: () => toast({ title: "Failed to delete dividend", variant: "destructive" }),
  });

  const dividends = data?.dividends ?? [];
  const active = dividends.filter(d => d.isActive);

  function openEdit(d: NgxDividend) {
    setEditItem(d);
    setForm({
      ticker: d.ticker,
      company_name: d.companyName,
      dividend_amount_ngn: String(d.dividendAmountKobo / 100),
      qualification_date: d.qualificationDate,
      payment_date: d.paymentDate ?? "",
    });
  }

  function handleSave() {
    const body = {
      ticker: form.ticker,
      company_name: form.company_name,
      dividend_amount_ngn: parseFloat(form.dividend_amount_ngn),
      qualification_date: form.qualification_date,
      ...(form.payment_date ? { payment_date: form.payment_date } : {}),
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  function daysLeft(date: string): number {
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{active.length} active dividend entries</p>
        <Button size="sm" className="gap-1.5 h-8" onClick={() => { setEditItem(null); setForm({ ticker: "", company_name: "", dividend_amount_ngn: "", qualification_date: "", payment_date: "" }); setShowAdd(true); }}>
          <Plus className="h-3.5 w-3.5" /> Add Dividend
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : active.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No dividend data yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Add dividends manually or they will appear automatically when corporate actions are received from the NGX feed via Icon eTrade.
            </p>
            <Button size="sm" variant="outline" onClick={() => { setShowAdd(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Dividend
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Amount ₦</TableHead>
                    <TableHead>Qual Date</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.map(d => {
                    const days = daysLeft(d.qualificationDate);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono font-semibold text-sm">{d.ticker}</TableCell>
                        <TableCell className="text-sm">{d.companyName}</TableCell>
                        <TableCell className="text-sm">₦{(d.dividendAmountKobo / 100).toFixed(4)}</TableCell>
                        <TableCell className="text-sm">{d.qualificationDate}</TableCell>
                        <TableCell>
                          <Badge variant={days <= 7 ? "destructive" : days <= 21 ? "secondary" : "outline"} className="text-xs">
                            {days > 0 ? `${days}d` : "Passed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.paymentDate ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{d.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                              onClick={() => deleteMutation.mutate(d.id)} disabled={deleteMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={showAdd || !!editItem} onOpenChange={open => { if (!open) { setShowAdd(false); setEditItem(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Dividend" : "Add Dividend"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ticker</Label>
                <Input placeholder="MTNN" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Dividend Amount ₦</Label>
                <Input type="number" step="0.01" placeholder="1.50" value={form.dividend_amount_ngn}
                  onChange={e => setForm(f => ({ ...f, dividend_amount_ngn: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input placeholder="MTN Nigeria" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Qualification Date</Label>
                <Input type="date" value={form.qualification_date} onChange={e => setForm(f => ({ ...f, qualification_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date (optional)</Label>
                <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending || !form.ticker || !form.company_name || !form.dividend_amount_ngn || !form.qualification_date}>
              {(createMutation.isPending || updateMutation.isPending) ? <LoadingSpinner size="sm" /> : (editItem ? "Save Changes" : "Save Dividend")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tab 4: Report History ────────────────────────────────────────────────────

function ReportHistoryTab() {
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{ reports: CieReport[] }>({
    queryKey: ["/api/admin/cie/intelligence/reports"],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/cie/intelligence/reports/generate", {}),
    onSuccess: () => {
      toast({ title: "Report generation started", description: "Refresh in a few seconds to see the result." });
      setTimeout(() => refetch(), 5000);
    },
    onError: () => toast({ title: "Failed to trigger report generation", variant: "destructive" }),
  });

  const reports = data?.reports ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{reports.length} reports generated</p>
        <Button size="sm" className="gap-1.5 h-8" onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}>
          {generateMutation.isPending ? <LoadingSpinner size="sm" /> : <><FileSpreadsheet className="h-3.5 w-3.5" /> Generate Today's Report</>}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : reports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No reports generated yet</p>
            <p className="text-xs text-muted-foreground">
              Reports are generated automatically at 19:00 WAT daily, or you can generate one manually above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Securities</TableHead>
                    <TableHead>Generated At</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.reportDate}</TableCell>
                      <TableCell className="text-sm">{r.securitiesCount ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.generatedAt).toLocaleString("en-NG")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.fileSize ? `${Math.round(r.fileSize / 1024)}KB` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "complete" ? "default" : r.status === "failed" ? "destructive" : "secondary"}
                          className="text-xs capitalize"
                        >{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.status === "complete" && (
                            <a href={`/api/admin/cie/intelligence/reports/${r.id}/download`} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <Download className="h-3 w-3" /> Download
                              </Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Tab 5: Data Sources ──────────────────────────────────────────────────────

function DataSourcesTab() {
  const { data, isLoading } = useQuery<DataSources>({
    queryKey: ["/api/admin/cie/intelligence/data-sources"],
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>;
  if (!data) return null;

  const { iconEtradeFeed, manualEntry, ngxCoverage, dataFreshness } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Icon eTrade Feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Icon eTrade Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last event</span>
              <span>{relativeTime(iconEtradeFeed.lastEventReceived)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Events today</span>
              <span className="font-medium">{iconEtradeFeed.eventsToday}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Price updates</span><span>{iconEtradeFeed.priceUpdates}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Volume events</span><span>{iconEtradeFeed.volumeEvents}</span>
            </div>
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" /> Manual Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dividends entered</span>
              <span className="font-medium">{manualEntry.dividendsEntered}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last updated</span>
              <span>{relativeTime(manualEntry.lastUpdated)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NGX Coverage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">NGX Securities Coverage</CardTitle>
            <FreshnessBadge freshness={dataFreshness.overall} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm mb-1">
            <span>{ngxCoverage.withDataToday} of {ngxCoverage.total} securities have data today</span>
            <span className="font-medium">{dataFreshness.coveragePct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div
              className={`h-2 rounded-full transition-all ${dataFreshness.coveragePct >= 80 ? "bg-green-500" : dataFreshness.coveragePct >= 30 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${dataFreshness.coveragePct}%` }}
            />
          </div>
          {ngxCoverage.staleSecurities.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">No data today ({ngxCoverage.staleSecurities.length} securities):</p>
              <div className="flex flex-wrap gap-1">
                {ngxCoverage.staleSecurities.slice(0, 30).map(t => (
                  <Badge key={t} variant="outline" className="text-xs font-mono">{t}</Badge>
                ))}
                {ngxCoverage.staleSecurities.length > 30 && (
                  <Badge variant="outline" className="text-xs">+{ngxCoverage.staleSecurities.length - 30} more</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminIntelligence() {
  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Intelligence", href: "/admin/intelligence" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time NGX market data from the Icon eTrade feed
          </p>
        </div>

        <Tabs defaultValue="pulse">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="pulse" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Live Pulse</TabsTrigger>
            <TabsTrigger value="sectors" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Sectors</TabsTrigger>
            <TabsTrigger value="dividends" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Dividends</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" /> Reports</TabsTrigger>
            <TabsTrigger value="sources" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Data Sources</TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <TabsContent value="pulse"><LivePulseTab /></TabsContent>
            <TabsContent value="sectors"><SectorSummaryTab /></TabsContent>
            <TabsContent value="dividends"><DividendCalendarTab /></TabsContent>
            <TabsContent value="reports"><ReportHistoryTab /></TabsContent>
            <TabsContent value="sources"><DataSourcesTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
