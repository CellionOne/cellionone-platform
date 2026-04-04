import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CieLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Star, ArrowLeft, ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Momentum { daily: string | null; weekly: string | null; monthly: string | null }
interface SecurityItem {
  ticker: string; name: string; sector: string;
  ias: number | null; rs: number | null; cs: number | null;
  recommendation: string | null; scoreDate: string | null;
  momentum: Momentum;
}
interface SecurityDetail {
  ticker: string; name: string; sector: string; exchange: string | null;
  latestPrice: { date: string; closeNaira: number | null; volume: number } | null;
  scores: {
    scoreDate: string; ias: number; rs: number; cs: number;
    recommendation: string; pillarBreakdown: Record<string, number> | null;
  } | null;
  history: Array<{ date: string; ias: number; rs: number; cs: number }>;
  dividendAlert: { exDividendDate: string; amountPerShareNaira: number | null; daysUntil: number } | null;
}
interface StatusData { tier: "free" | "subscriber" | "pro"; isPaid: boolean; subscription: unknown }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function iasColor(v: number | null) {
  if (v == null) return "text-muted-foreground";
  if (v >= 70) return "text-green-600 dark:text-green-400 font-semibold";
  if (v >= 50) return "text-amber-600 dark:text-amber-400";
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
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[rec] ?? "bg-muted text-muted-foreground"}`}>{rec}</span>;
}

function starRating(ias: number | null) {
  if (ias == null) return null;
  const stars = ias >= 80 ? 5 : ias >= 65 ? 4 : ias >= 50 ? 3 : ias >= 35 ? 2 : 1;
  return (
    <span className="inline-flex gap-0.5" title={`IAS ${ias.toFixed(1)}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

function MomentumDots({ m }: { m: Momentum }) {
  const color: Record<string, string> = {
    up: "bg-green-500",
    down: "bg-red-500",
    flat: "bg-amber-400",
  };
  const labels = ["D", "W", "M"] as const;
  const values = [m.daily, m.weekly, m.monthly];
  return (
    <span className="inline-flex gap-1 items-center" title="RS trend: Daily / Weekly / Monthly">
      {labels.map((l, i) => (
        <span key={l} className="inline-flex flex-col items-center gap-0.5">
          <span className={`h-2 w-2 rounded-full ${values[i] ? color[values[i]!] ?? "bg-gray-300" : "bg-gray-200 dark:bg-gray-700"}`} />
          <span className="text-[9px] text-muted-foreground leading-none">{l}</span>
        </span>
      ))}
    </span>
  );
}

// ─── Security Detail ──────────────────────────────────────────────────────────

function SecurityDetail({ ticker, tier, onBack }: { ticker: string; tier: string; onBack: () => void }) {
  const { data, isLoading } = useQuery<SecurityDetail>({
    queryKey: ["/api/cie-portal/securities", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/cie-portal/securities/${ticker}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load security");
      return res.json();
    },
  });

  // Compute real momentum from detail history
  function computeDetailMomentum(history: Array<{ rs: number }>): Momentum {
    if (history.length < 2) return { daily: null, weekly: null, monthly: null };
    const curr = history[0]?.rs;
    const d1 = history[1]?.rs;
    const d7 = history[5]?.rs;
    const d30 = history[20]?.rs;
    function trend(c: number, p: number | undefined): string | null {
      if (p === undefined) return null;
      if (Math.abs(c - p) < 0.5) return "flat";
      return c > p ? "up" : "down";
    }
    return { daily: trend(curr, d1), weekly: trend(curr, d7), monthly: trend(curr, d30) };
  }

  if (isLoading) return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>;
  if (!data) return null;

  const momentum = computeDetailMomentum(data.history);

  // Sparkline data (reverse so oldest is on left)
  const sparkData = [...data.history].reverse().slice(-30).map(h => ({
    date: h.date,
    IAS: +(h.ias ?? 0).toFixed(2),
    RS: +(h.rs ?? 0).toFixed(2),
  }));

  // Pillar breakdown bars
  const pillars = data.scores?.pillarBreakdown
    ? Object.entries(data.scores.pillarBreakdown as Record<string, number>).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={onBack} data-testid="button-back-securities">
        <ArrowLeft className="h-4 w-4" /> All Securities
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-4xl font-bold font-mono text-primary" data-testid="text-security-symbol">{data.ticker}</h2>
          <p className="text-muted-foreground mt-1">{data.name}</p>
          <p className="text-xs text-muted-foreground">{data.sector} · {data.exchange ?? "NGX"}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          {data.scores && recoBadge(data.scores.recommendation)}
          {data.scores && starRating(data.scores.ias)}
          <MomentumDots m={momentum} />
          {data.scores && <p className="text-xs text-muted-foreground">Scored {formatDate(data.scores.scoreDate)}</p>}
        </div>
      </div>

      {data.dividendAlert && (
        <Card className="border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10" data-testid="card-dividend-alert">
          <CardContent className="p-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm">
              <strong>Dividend Alert:</strong> Ex-dividend {data.dividendAlert.exDividendDate}
              {data.dividendAlert.amountPerShareNaira != null && ` — ₦${data.dividendAlert.amountPerShareNaira.toFixed(2)}/share`}
              &nbsp;({data.dividendAlert.daysUntil} day{data.dividendAlert.daysUntil !== 1 ? "s" : ""} away)
            </p>
          </CardContent>
        </Card>
      )}

      {data.scores && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { abbr: "IAS", label: "Integrated Aggregate Score", value: data.scores.ias },
            { abbr: "RS", label: "Relative Score (sector)", value: data.scores.rs },
            { abbr: "CS", label: "Composite Score", value: data.scores.cs },
          ].map(m => (
            <Card key={m.abbr} data-testid={`card-score-${m.abbr.toLowerCase()}`}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{m.abbr}</p>
                <p className={`text-4xl font-bold ${iasColor(m.value)}`}>{m.value.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{m.label}</p>
                {m.abbr === "IAS" && <div className="mt-2">{starRating(m.value)}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data.latestPrice && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Latest Trading Data</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><p className="text-xs text-muted-foreground">Close</p>
              <p className="text-xl font-bold">{data.latestPrice.closeNaira != null ? `₦${data.latestPrice.closeNaira.toFixed(2)}` : "—"}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-xl font-bold">{data.latestPrice.volume.toLocaleString()}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">Date</p>
              <p className="text-base font-medium">{data.latestPrice.date}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 30-day IAS / RS sparkline */}
      {sparkData.length > 1 && (
        <Card data-testid="card-sparkline">
          <CardHeader><CardTitle className="text-sm">30-Session IAS & RS Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={sparkData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number, name: string) => [v.toFixed(1), name]}
                  labelFormatter={l => `Date: ${l}`}
                />
                <Line type="monotone" dataKey="IAS" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="RS" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-primary inline-block" />IAS</span>
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-amber-400 inline-block" />RS</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pillar breakdown */}
      {pillars.length > 0 && (
        <Card data-testid="card-pillar-breakdown">
          <CardHeader><CardTitle className="text-sm">Score Pillar Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pillars.map(([name, val]) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground capitalize">{name.replace(/_/g, " ")}</span>
                  <span className={`font-medium ${iasColor(val)}`}>{val.toFixed(1)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${val >= 70 ? "bg-green-500" : val >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${Math.min(100, val)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Score history table */}
      {data.history.length > 0 && (
        <Card data-testid="card-score-history">
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
                  {data.history.slice(0, 15).map((h, i) => {
                    const prev = data.history[i + 1];
                    const rowMom: Momentum = {
                      daily: prev ? (Math.abs(h.rs - prev.rs) < 0.5 ? "flat" : h.rs > prev.rs ? "up" : "down") : null,
                      weekly: null,
                      monthly: null,
                    };
                    return (
                      <TableRow key={i} data-testid={`row-history-${i}`}>
                        <TableCell className="text-sm">{h.date}</TableCell>
                        <TableCell className={`text-center text-sm ${iasColor(h.ias)}`}>{h.ias?.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-sm">{h.rs?.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-sm">{h.cs?.toFixed(1)}</TableCell>
                        <TableCell><MomentumDots m={rowMom} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Securities List ──────────────────────────────────────────────────────────

export default function CieSecurities() {
  const { data: status } = useQuery<StatusData>({ queryKey: ["/api/cie-portal/status"] });
  const tier = status?.tier ?? "free";

  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [recFilter, setRecFilter] = useState("all");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ securities: SecurityItem[]; sectors: string[]; total: number }>({
    queryKey: ["/api/cie-portal/securities"],
  });

  const sectors = ["all", ...(data?.sectors ?? [])];
  const recs = ["all", "Strong Buy", "Accumulate", "Hold", "Reduce", "Sell"];

  const filtered = (data?.securities ?? []).filter(s => {
    const ms = search.toLowerCase();
    return (
      (search === "" || s.ticker.toLowerCase().includes(ms) || s.name.toLowerCase().includes(ms)) &&
      (sectorFilter === "all" || s.sector === sectorFilter) &&
      (recFilter === "all" || s.recommendation === recFilter)
    );
  });

  if (selectedTicker) {
    return (
      <CieLayout tier={tier}>
        <SecurityDetail ticker={selectedTicker} tier={tier} onBack={() => setSelectedTicker(null)} />
      </CieLayout>
    );
  }

  return (
    <CieLayout tier={tier}>
      <div className="space-y-4 max-w-6xl">
        <div>
          <h2 className="text-lg font-semibold mb-1" data-testid="text-securities-heading">NGX Securities</h2>
          <p className="text-sm text-muted-foreground">IAS, RS, CS scores and recommendations for all NGX-listed securities.</p>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <Input
            placeholder="Search ticker or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
            data-testid="input-search-securities"
          />

          {/* Sector filter */}
          <div className="flex gap-1 flex-wrap">
            {sectors.map(s => (
              <button
                key={s}
                onClick={() => setSectorFilter(s)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  sectorFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}
                data-testid={`filter-sector-${s}`}
              >
                {s === "all" ? "All Sectors" : s}
              </button>
            ))}
          </div>

          {/* Recommendation filter */}
          <div className="flex gap-1 flex-wrap">
            {recs.map(r => (
              <button
                key={r}
                onClick={() => setRecFilter(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  recFilter === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}
                data-testid={`filter-rec-${r}`}
              >
                {r === "all" ? "All Ratings" : r}
              </button>
            ))}
          </div>

          <span className="text-sm text-muted-foreground self-center ml-auto">{filtered.length} securities</span>
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
                      <TableHead title="RS trend: Daily/Weekly/Monthly">Momentum D/W/M</TableHead>
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
                        <TableCell><MomentumDots m={s.momentum} /></TableCell>
                        <TableCell className={`text-center text-sm font-medium ${iasColor(s.ias)}`}>
                          {s.ias?.toFixed(1) ?? "—"}
                        </TableCell>
                        <TableCell>{starRating(s.ias)}</TableCell>
                        <TableCell>{recoBadge(s.recommendation)}</TableCell>
                        <TableCell><ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" /></TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && !isLoading && (
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
    </CieLayout>
  );
}
