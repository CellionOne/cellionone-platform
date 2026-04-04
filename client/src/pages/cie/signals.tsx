import { useQuery } from "@tanstack/react-query";
import { CieLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { TrendingUp, Activity } from "lucide-react";

interface StatusData { tier: "free" | "subscriber" | "pro"; isPaid: boolean; subscription: unknown }
interface Signal {
  id: number; symbol: string | null; type: string; sentiment: string | null;
  credibility: number | null; content: string; publishedAt: string | null;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function credLabel(n: number | null): string {
  if (n === null) return "unrated";
  if (n >= 5) return "very high";
  if (n >= 4) return "high";
  if (n >= 3) return "medium";
  if (n >= 2) return "low";
  return "very low";
}

function credClass(n: number | null): string {
  if (n === null) return "text-muted-foreground";
  if (n >= 4) return "text-green-600 dark:text-green-400";
  if (n >= 3) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function sentimentIcon(s: string | null) {
  if (s === "bullish") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (s === "bearish") return <Activity className="h-4 w-4 text-red-500" />;
  return <Activity className="h-4 w-4 text-muted-foreground" />;
}

export default function CieSignals() {
  const { data: status } = useQuery<StatusData>({ queryKey: ["/api/cie-portal/status"] });
  const tier = status?.tier ?? "free";

  const { data, isLoading } = useQuery<{ signals: Signal[]; count: number }>({
    queryKey: ["/api/cie-portal/signals"],
    enabled: tier === "pro",
  });

  return (
    <CieLayout tier={tier}>
      <div className="space-y-4 max-w-3xl">
        <div>
          <h2 className="text-lg font-semibold mb-1" data-testid="text-signals-heading">Analyst Signals</h2>
          <p className="text-sm text-muted-foreground">
            Real-time analyst trade calls and market intelligence — exclusive to Pro subscribers.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-3">
            {(data?.signals ?? []).map(s => (
              <Card key={s.id} className="border-border/60 hover:border-primary/20 transition-colors" data-testid={`card-signal-${s.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{sentimentIcon(s.sentiment)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {s.symbol && <span className="font-mono text-primary font-semibold text-sm" data-testid={`text-signal-symbol-${s.id}`}>{s.symbol}</span>}
                        <span className="text-xs capitalize bg-muted rounded px-1.5 py-0.5">{s.type.replace(/_/g, " ")}</span>
                        {s.sentiment && (
                          <span className={`text-xs font-medium capitalize ${s.sentiment === "bullish" ? "text-green-600" : s.sentiment === "bearish" ? "text-red-500" : "text-muted-foreground"}`}>
                            {s.sentiment}
                          </span>
                        )}
                        <span className={`text-xs font-medium ${credClass(s.credibility)}`}>
                          ● {credLabel(s.credibility)} credibility
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" data-testid={`text-signal-content-${s.id}`}>{s.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatDate(s.publishedAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!data?.signals?.length && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  No signals published yet. Check back after the next scoring run.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </CieLayout>
  );
}
