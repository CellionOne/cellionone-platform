import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CieLayout } from "./layout";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface StatusData { tier: "free" | "subscriber" | "pro"; isPaid: boolean; subscription: unknown }
interface PulseData {
  available: boolean; message?: string;
  asiIndex?: number | null; asiDailyChangePct?: number | null;
  brentCrudeUsd?: number | null; ngnPerUsd?: number | null;
  source?: string; updatedAt?: string;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function CieMarketPulse() {
  const { data: status } = useQuery<StatusData>({ queryKey: ["/api/cie-portal/status"] });
  const tier = status?.tier ?? "free";

  const { data, isLoading } = useQuery<PulseData>({ queryKey: ["/api/cie-portal/pulse"] });

  const changeColor = (v?: number | null) =>
    v == null ? "text-foreground" : v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";

  const metrics = data?.available
    ? [
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
      ]
    : [];

  return (
    <CieLayout tier={tier}>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-lg font-semibold mb-1" data-testid="text-pulse-heading">Market Pulse</h2>
          <p className="text-sm text-muted-foreground">Live summary of the Nigerian Exchange Group — available to all users.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
        ) : !data?.available ? (
          <Card data-testid="card-pulse-unavailable">
            <CardContent className="py-16 text-center">
              <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">{data?.message ?? "Market pulse data not yet available."}</p>
              <p className="text-xs text-muted-foreground mt-2">Check back after the next market session.</p>
            </CardContent>
          </Card>
        ) : (
          <>
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
                  Last updated: {formatDate(data?.updatedAt)} · Source: {data?.source ?? "manual"}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Upgrade to <strong>Subscriber</strong> or <strong>Pro</strong> to unlock individual security scores,
                  analyst recommendations, RS-trend momentum indicators, dividend calendars, and the full NGX intelligence suite.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CieLayout>
  );
}
