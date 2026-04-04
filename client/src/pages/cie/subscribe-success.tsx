import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CheckCircle2, Clock, XCircle, BarChart3 } from "lucide-react";
import { Link } from "wouter";

interface StatusData {
  tier: "free" | "subscriber" | "pro";
  isPaid: boolean;
  subscription: { tier: string; status: string; currentPeriodEnd: string } | null;
}

type PageState = "loading" | "success" | "pending" | "failed";

export default function CieSubscribeSuccess() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const reference = params.get("reference");
  const paystackStatus = params.get("status"); // Paystack appends "?status=success|cancelled"

  // If Paystack explicitly signals cancelled/failure, show failure state immediately
  const isCancelled = paystackStatus === "cancelled" || paystackStatus === "failed";

  // Poll status — stop when subscription is active
  const { data, isLoading } = useQuery<StatusData>({
    queryKey: ["/api/cie-portal/status"],
    enabled: !isCancelled,
    refetchInterval: (query) => (query.state.data?.isPaid ? false : 5000),
    refetchIntervalInBackground: false,
  });

  function getState(): PageState {
    if (isCancelled) return "failed";
    if (isLoading) return "loading";
    if (data?.isPaid) return "success";
    // Data loaded but subscription not yet active — webhook may still be processing
    return "pending";
  }

  const state = getState();

  const content: Record<PageState, { icon: JSX.Element; heading: string; body: string; cta: JSX.Element }> = {
    loading: {
      icon: <LoadingSpinner size="lg" />,
      heading: "Confirming Payment…",
      body: "Please wait while we verify your payment with Paystack.",
      cta: <></>,
    },
    success: {
      icon: (
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
      ),
      heading: "Subscription Active!",
      body: `Your ${data?.subscription?.tier ?? data?.tier ?? "CIE"} plan is now active. Access the full intelligence suite immediately.`,
      cta: (
        <Link href="/cie/securities">
          <Button className="gap-2 w-full" data-testid="button-go-to-portal">
            <BarChart3 className="h-4 w-4" /> Explore Securities
          </Button>
        </Link>
      ),
    },
    pending: {
      icon: (
        <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
      ),
      heading: "Payment Processing",
      body: "Your payment was received and is being confirmed. Your subscription will activate automatically — this usually takes a few moments.",
      cta: (
        <Link href="/cie">
          <Button variant="outline" className="w-full" data-testid="button-back-portal">Back to Portal</Button>
        </Link>
      ),
    },
    failed: {
      icon: (
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
      ),
      heading: "Payment Cancelled",
      body: "Your payment was not completed. No charge was made. You can try again at any time.",
      cta: (
        <Link href="/cie/subscribe">
          <Button variant="outline" className="w-full" data-testid="button-retry-subscribe">Try Again</Button>
        </Link>
      ),
    },
  };

  const { icon, heading, body, cta } = content[state];

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "CIE Portal", href: "/cie" }, { label: "Subscription" }]}>
      <div className="max-w-md mx-auto px-4 py-20">
        <Card data-testid="card-subscribe-result">
          <CardContent className="p-8 text-center flex flex-col items-center gap-5">
            {icon}
            {state !== "loading" && (
              <>
                <div>
                  <h2 className="text-xl font-bold mb-2" data-testid={`text-${state}-heading`}>{heading}</h2>
                  <p className="text-sm text-muted-foreground">{body}</p>
                  {reference && (
                    <p className="text-xs text-muted-foreground mt-2">Ref: {reference}</p>
                  )}
                </div>
                {cta}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
