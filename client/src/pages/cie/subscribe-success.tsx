import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface StatusData {
  tier: "free" | "subscriber" | "pro";
  isPaid: boolean;
  subscription: { tier: string; status: string; currentPeriodEnd: string } | null;
}

export default function CieSubscribeSuccess() {
  const search = useSearch();
  const reference = new URLSearchParams(search).get("reference");

  // Poll the status endpoint briefly to reflect the subscription state
  const { data, isLoading } = useQuery<StatusData>({
    queryKey: ["/api/cie-portal/status"],
    refetchInterval: (query) => (query.state.data?.isPaid ? false : 4000),
    refetchIntervalInBackground: false,
  });

  const activated = data?.isPaid === true;

  if (isLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "CIE Portal", href: "/cie" }, { label: "Activating Subscription" }]}>
        <div className="flex flex-col items-center justify-center py-32 gap-6" data-testid="section-verifying">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground text-sm">Confirming your subscription…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "CIE Portal", href: "/cie" }, { label: "Subscription" }]}>
      <div className="max-w-md mx-auto px-4 py-20">
        <Card data-testid="card-subscribe-result">
          <CardContent className="p-8 text-center flex flex-col items-center gap-5">
            {activated ? (
              <>
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2" data-testid="text-success-heading">Subscription Active!</h2>
                  <p className="text-sm text-muted-foreground">
                    Your <strong className="capitalize">{data?.subscription?.tier ?? data?.tier}</strong> plan is now active.
                    Access the full intelligence suite immediately.
                  </p>
                  {reference && (
                    <p className="text-xs text-muted-foreground mt-2">Reference: {reference}</p>
                  )}
                </div>
                <Link href="/cie">
                  <Button className="gap-2 w-full" data-testid="button-go-to-portal">
                    <BarChart3 className="h-4 w-4" /> Open Intelligence Portal
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2" data-testid="text-pending-heading">Payment Processing</h2>
                  <p className="text-sm text-muted-foreground">
                    Your payment was received and is being confirmed by Paystack. Your subscription will activate automatically —
                    this usually takes a few moments. This page refreshes automatically.
                  </p>
                  {reference && (
                    <p className="text-xs text-muted-foreground mt-2">Reference: {reference}</p>
                  )}
                </div>
                <Link href="/cie">
                  <Button variant="outline" className="w-full" data-testid="button-back-portal">Back to Portal</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
