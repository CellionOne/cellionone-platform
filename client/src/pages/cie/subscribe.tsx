import { useQuery, useMutation } from "@tanstack/react-query";
import { CieLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Shield, Star } from "lucide-react";

interface StatusData {
  tier: "free" | "subscriber" | "pro";
  isPaid: boolean;
  subscription: {
    id: number; tier: string; status: string;
    currentPeriodEnd: string; cancelAtPeriodEnd: boolean;
  } | null;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function CieSubscribe() {
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<StatusData>({
    queryKey: ["/api/cie-portal/status"],
  });

  const tier = status?.tier ?? "free";
  const sub = status?.subscription;

  const subscribeMutation = useMutation({
    mutationFn: async (newTier: "subscriber" | "pro") => {
      const res = await apiRequest("POST", "/api/cie-billing/subscribe", { tier: newTier });
      // Server returns result.data directly: { authorizationUrl, reference, subscriptionId, tier, ... }
      return res.json() as Promise<{ authorizationUrl?: string; reference?: string; subscriptionId?: number; directSwitch?: boolean }>;
    },
    onSuccess: (data) => {
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else if (data?.directSwitch) {
        queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/status"] });
        toast({ title: "Plan upgraded successfully!" });
      } else {
        toast({ title: "Subscription initiated — check your email to complete payment" });
      }
    },
    onError: (err: unknown) => toast({ title: err instanceof Error ? err.message : "Failed to initiate subscription", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cie-billing/cancel", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cie-portal/status"] });
      toast({ title: "Subscription will cancel at end of billing period" });
    },
    onError: (err: unknown) => toast({ title: err instanceof Error ? err.message : "Failed to cancel", variant: "destructive" }),
  });

  if (statusLoading) {
    return (
      <CieLayout tier="free">
        <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
      </CieLayout>
    );
  }

  const plans = [
    {
      tier: "subscriber" as const,
      name: "Subscriber",
      price: "₦5,000",
      period: "per month",
      features: [
        "IAS, RS & CS scores for all NGX-listed securities",
        "Analyst recommendations (Strong Buy → Sell)",
        "Star ratings & daily/weekly/monthly RS momentum",
        "Dividend calendar & corporate action alerts",
        "30-session score history with sparkline charts",
        "Pillar breakdown analysis",
        "API access (500 req/min)",
      ],
      highlight: false,
    },
    {
      tier: "pro" as const,
      name: "Pro",
      price: "₦10,000",
      period: "per month",
      features: [
        "Everything in Subscriber",
        "Analyst trade calls & signals",
        "Sector rotation alerts",
        "Credibility-rated intelligence feed",
        "Priority API access (1,000 req/min)",
      ],
      highlight: true,
    },
  ] as const;

  return (
    <CieLayout tier={tier}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1" data-testid="text-subscribe-heading">Subscription</h2>
          <p className="text-sm text-muted-foreground">Choose a plan to unlock the full NGX intelligence suite.</p>
        </div>

        {sub && (
          <Card className="border-primary/30" data-testid="card-active-subscription">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold capitalize">{sub.tier} Plan — Active</p>
                <p className="text-xs text-muted-foreground">
                  {sub.cancelAtPeriodEnd
                    ? `Cancels on ${formatDate(sub.currentPeriodEnd)}`
                    : `Renews on ${formatDate(sub.currentPeriodEnd)}`}
                </p>
              </div>
              {!sub.cancelAtPeriodEnd && (
                <Button
                  size="sm" variant="outline"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  data-testid="button-cancel-subscription"
                >
                  {cancelMutation.isPending ? <LoadingSpinner size="sm" /> : "Cancel Plan"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {plans.map((t, i) => (
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
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Star className="h-3 w-3" /> Most Popular
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-primary mb-3">
                  {t.price} <span className="text-sm font-normal text-muted-foreground">{t.period}</span>
                </p>
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
                {subscribeMutation.isPending && tier !== t.tier
                  ? <LoadingSpinner size="sm" />
                  : tier === t.tier ? "Current Plan" : "Subscribe"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </CieLayout>
  );
}
