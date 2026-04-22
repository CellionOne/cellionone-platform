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
import { Star, ChevronDown } from "lucide-react";
import { MacroBar } from "@/components/cie/macro-bar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Momentum { daily: string | null; weekly: string | null; monthly: string | null }
interface SecurityItem {
  ticker: string; name: string; sector: string;
  ias: number | null; rs: number | null; cs: number | null;
  recommendation: string | null; scoreDate: string | null;
  momentum: Momentum;
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

// ─── Securities List (detail at /cie/securities/:ticker) ──────────────────────

export default function CieSecurities() {
  const { data: status } = useQuery<StatusData>({ queryKey: ["/api/cie-portal/status"] });
  const tier = status?.tier ?? "free";

  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [recFilter, setRecFilter] = useState("all");

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

  return (
    <CieLayout tier={tier}>
      <div className="space-y-4 max-w-6xl">
        <div>
          <h2 className="text-lg font-semibold mb-1" data-testid="text-securities-heading">NGX Securities</h2>
          <p className="text-sm text-muted-foreground">IAS, RS, CS scores and recommendations for all NGX-listed securities.</p>
        </div>

        <div className="p-3 rounded-lg border border-border/60 bg-muted/30">
          <MacroBar />
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
                        onClick={() => navigate(`/cie/securities/${s.ticker}`)}
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
