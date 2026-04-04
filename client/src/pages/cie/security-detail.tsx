import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CieLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Star, ArrowLeft, Sparkles, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface StatusData { tier: "free" | "subscriber" | "pro"; isPaid: boolean; subscription: unknown }

interface CieScoreNarrative {
  headline: string;
  body: string;
  keyPoints: string[];
  caveats: string;
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

type Momentum = { daily: string | null; weekly: string | null; monthly: string | null };

function MomentumDots({ m }: { m: Momentum }) {
  const color: Record<string, string> = { up: "bg-green-500", down: "bg-red-500", flat: "bg-amber-400" };
  return (
    <span className="inline-flex gap-1 items-center" title="RS trend: Daily / Weekly / Monthly">
      {(["D", "W", "M"] as const).map((l, i) => {
        const v = [m.daily, m.weekly, m.monthly][i];
        return (
          <span key={l} className="inline-flex flex-col items-center gap-0.5">
            <span className={`h-2 w-2 rounded-full ${v ? color[v] ?? "bg-gray-300" : "bg-gray-200 dark:bg-gray-700"}`} />
            <span className="text-[9px] text-muted-foreground leading-none">{l}</span>
          </span>
        );
      })}
    </span>
  );
}

function AiInsightCard({ ticker }: { ticker: string }) {
  // Check if AI is available first — hide the entire card if not
  const { data: aiStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/cie-portal/ai-status"],
    staleTime: 5 * 60 * 1000,
  });

  // Auto-fetch the narrative on mount (enabled once we know AI is available)
  const { data: narrativeData, isLoading, isError, refetch, isFetching } = useQuery<{ ticker: string; narrative: CieScoreNarrative }>({
    queryKey: ["/api/cie-portal/securities", ticker, "ai-narrative"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/cie-portal/securities/${ticker}/ai-narrative`);
      if (!res.ok) throw new Error("Failed to generate narrative");
      return res.json();
    },
    enabled: aiStatus?.available === true,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Gracefully hide the entire card when AI is unavailable
  if (aiStatus?.available === false) return null;

  const narrative = narrativeData?.narrative ?? null;

  return (
    <Card data-testid="card-ai-insight">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Analyst Insight
          </CardTitle>
          {!isLoading && !isError && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 h-7 text-xs"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-ai-insight"
            >
              {isFetching ? <LoadingSpinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {(isLoading || (isFetching && !narrative)) && (
          <div className="space-y-3" data-testid="skeleton-ai-insight">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}
        {isError && !narrative && (
          <p className="text-sm text-muted-foreground italic">AI insight currently unavailable for this security.</p>
        )}
        {narrative && (
          <div className="space-y-4">
            <p className="font-semibold text-sm" data-testid="text-ai-headline">{narrative.headline}</p>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-ai-body">
              {narrative.body}
            </div>
            {narrative.keyPoints?.length > 0 && (
              <ul className="space-y-1.5" data-testid="list-ai-keypoints">
                {narrative.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {pt}
                  </li>
                ))}
              </ul>
            )}
            {narrative.caveats && (
              <p className="text-xs text-muted-foreground border-t pt-3 italic" data-testid="text-ai-caveats">
                {narrative.caveats}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CieSecurityDetail() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params.ticker ?? "").toUpperCase();

  const { data: status } = useQuery<StatusData>({ queryKey: ["/api/cie-portal/status"] });
  const tier = status?.tier ?? "free";

  const { data, isLoading, error } = useQuery<SecurityDetail>({
    queryKey: ["/api/cie-portal/securities", ticker],
    queryFn: async () => {
      const res = await fetch(`/api/cie-portal/securities/${ticker}`, { credentials: "include" });
      if (!res.ok) throw new Error("Security not found");
      return res.json();
    },
    enabled: !!ticker,
  });

  function computeMomentum(history: Array<{ rs: number }>): Momentum {
    if (history.length < 2) return { daily: null, weekly: null, monthly: null };
    const curr = history[0]?.rs;
    function trend(c: number, p: number | undefined): string | null {
      if (p === undefined) return null;
      return Math.abs(c - p) < 0.5 ? "flat" : c > p ? "up" : "down";
    }
    return {
      daily: trend(curr, history[1]?.rs),
      weekly: trend(curr, history[5]?.rs),
      monthly: trend(curr, history[20]?.rs),
    };
  }

  if (isLoading) {
    return (
      <CieLayout tier={tier}>
        <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
      </CieLayout>
    );
  }

  if (error || !data) {
    return (
      <CieLayout tier={tier}>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-muted-foreground">Security "{ticker}" not found or data unavailable.</p>
          <Link href="/cie/securities">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Securities
            </Button>
          </Link>
        </div>
      </CieLayout>
    );
  }

  const momentum = computeMomentum(data.history);

  const sparkData = [...data.history].reverse().slice(-30).map(h => ({
    date: h.date,
    IAS: +(h.ias ?? 0).toFixed(2),
    RS: +(h.rs ?? 0).toFixed(2),
  }));

  const pillars = data.scores?.pillarBreakdown
    ? Object.entries(data.scores.pillarBreakdown).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <CieLayout tier={tier}>
      <div className="space-y-6 max-w-4xl">
        <Link href="/cie/securities">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2" data-testid="button-back-securities">
            <ArrowLeft className="h-4 w-4" /> All Securities
          </Button>
        </Link>

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
              <div>
                <p className="text-xs text-muted-foreground">Close</p>
                <p className="text-xl font-bold">{data.latestPrice.closeNaira != null ? `₦${data.latestPrice.closeNaira.toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="text-xl font-bold">{data.latestPrice.volume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-base font-medium">{data.latestPrice.date}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {sparkData.length > 1 && (
          <Card data-testid="card-sparkline">
            <CardHeader><CardTitle className="text-sm">30-Session IAS & RS Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={sparkData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, n: string) => [v.toFixed(1), n]} labelFormatter={l => `Date: ${l}`} />
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
                      className={`h-full rounded-full ${val >= 70 ? "bg-green-500" : val >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min(100, val)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {data.scores && (
          <AiInsightCard ticker={data.ticker} />
        )}

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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.history.slice(0, 15).map((h, i) => (
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
      </div>
    </CieLayout>
  );
}
