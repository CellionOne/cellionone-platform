import { useQuery } from "@tanstack/react-query";
import { CieLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { TrendingUp, Activity } from "lucide-react";

interface StatusData { tier: "free" | "subscriber" | "pro"; isPaid: boolean; subscription: unknown }
interface Signal {
  id: number; ticker: string | null; type: string; sentiment: string;
  credibility: string; headline: string; body: string | null; publishedAt: string | null;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const credColor: Record<string, string> = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-muted-foreground",
};

function sentimentIcon(s: string) {
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
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {s.ticker && <span className="font-mono text-primary font-semibold text-sm">{s.ticker}</span>}
                        <span className="text-xs capitalize bg-muted rounded px-1.5 py-0.5">{s.type.replace(/_/g, " ")}</span>
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
