import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { CieLayout } from "./layout";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, Zap, Key } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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

function CiePublicLanding() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">CIE <span className="text-primary">Intelligence</span></span>
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">NGX</span>
        </div>
        <div className="flex gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm" data-testid="button-cie-signin">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" data-testid="button-cie-getstarted">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-cie-landing-heading">
            Nigeria's Premier <span className="text-primary">Equity Intelligence</span> API
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Real-time NGX scores, analyst signals, and a developer-ready REST API — all in one platform.
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <Link href="/register">
              <Button size="lg" data-testid="button-cie-subscribe-cta">Start free — no card required</Button>
            </Link>
            <Link href="/cie-intelligence">
              <Button variant="outline" size="lg">Learn more</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {[
            { icon: Activity, title: "Market Pulse", desc: "Daily NGX ASI index, Brent crude, and USD/NGN — free for all users.", badge: "Free" },
            { icon: BarChart3, title: "Security Scores", desc: "IAS, RS, and CS scores for every NGX-listed security with star ratings and recommendations.", badge: "Subscriber" },
            { icon: Zap, title: "Analyst Signals", desc: "Proprietary analyst signals with entry/exit levels, sector momentum, and conviction ratings.", badge: "Pro" },
            { icon: Key, title: "Developer API", desc: "Programmatic access to NGX intelligence via REST API with X-API-Key authentication and tiered rate limits.", badge: "Subscriber+" },
          ].map(({ icon: Icon, title, desc, badge }) => (
            <Card key={title} data-testid={`card-cie-feature-${title.toLowerCase().replace(/\s/g, "-")}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{title}</h3>
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{badge}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline underline-offset-2">Sign in to access your portal</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function CieMarketPulse() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: status } = useQuery<StatusData>({
    queryKey: ["/api/cie-portal/status"],
    enabled: isAuthenticated,
  });
  const tier = status?.tier ?? "free";

  const { data, isLoading } = useQuery<PulseData>({
    queryKey: ["/api/cie-portal/pulse"],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (!isAuthenticated) {
    return <CiePublicLanding />;
  }

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
