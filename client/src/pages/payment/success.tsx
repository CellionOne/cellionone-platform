import { useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, ClipboardList, Loader2 } from "lucide-react";

export default function PaymentSuccessPage() {
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    sessionStorage.removeItem("checkoutState");
  }, []);

  const { data: orderData, isLoading: orderLoading } = useQuery<{
    order: {
      id: number;
      status: string;
      founderId: string;
    };
    items: Array<{
      sku: string;
    }>;
  }>({
    queryKey: ["/api/founder/orders", orderId],
    enabled: !!orderId,
  });

  const hasPostIncItems = useMemo(() => {
    if (!orderData?.items) return false;
    return orderData.items.some(item => ["SCUML", "TM", "TIN"].includes(item.sku));
  }, [orderData]);

  const nextSteps = useMemo(() => {
    const steps = [];

    if (hasPostIncItems) {
      steps.push({
        title: "Complete Service Request Form",
        description: "Provide your company details and upload required documents so a lawyer can process your request",
        link: `/founder/service-request${orderId ? `?orderId=${orderId}` : ""}`,
        highlight: true,
      });
    }

    steps.push({
      title: "View Your Orders",
      description: "Track the status of your orders and service requests",
      link: orderId ? `/founder/orders/${orderId}` : "/founder/dashboard",
      highlight: false,
    });

    steps.push({
      title: "Go to Dashboard",
      description: "View all your applications and services",
      link: "/founder/dashboard",
      highlight: false,
    });

    return steps;
  }, [hasPostIncItems, orderId]);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-payment-success-title">Payment Successful</h1>
          <p className="text-muted-foreground mt-2">
            Thank you for your payment. Your services will be activated once the transaction is confirmed.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Continue your journey with Cellion One</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              nextSteps.map((step, idx) => (
                <Link key={idx} href={step.link}>
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer ${
                      step.highlight
                        ? "border-primary bg-primary/5 hover-elevate"
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`link-next-step-${idx}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {step.highlight && <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />}
                      <div>
                        <h3 className="font-medium text-foreground">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Button variant="outline" onClick={() => setLocation("/founder/dashboard")} data-testid="button-go-dashboard">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
