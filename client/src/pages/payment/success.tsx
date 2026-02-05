import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

interface SessionInfo {
  session: {
    id: number;
    status: string;
    mode: string;
    lineItems: Array<{ serviceType: string; tier?: string }>;
    contextJson: Record<string, any>;
  };
}

export default function PaymentSuccessPage() {
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasSecondStep, setHasSecondStep] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get("session_id");
    setSessionId(sid);
    
    const checkoutState = sessionStorage.getItem("checkoutState");
    if (checkoutState) {
      try {
        const parsed = JSON.parse(checkoutState);
        if (parsed.items && parsed.items.length > 0) {
          setHasSecondStep(true);
          setTimeout(() => {
            setLocation("/payment/checkout?step=2");
          }, 2000);
        }
      } catch (e) {
        sessionStorage.removeItem("checkoutState");
      }
    }
  }, [setLocation]);

  const { data, isLoading } = useQuery<SessionInfo>({
    queryKey: ["/api/payments/stripe/session", sessionId],
    enabled: !!sessionId,
  });

  const getServiceName = (item: { serviceType: string; tier?: string }) => {
    switch (item.serviceType) {
      case "verification":
        return "Identity Verification";
      case "incorporation":
        return "Company Incorporation";
      case "registered_office":
        return item.tier === "office_plus_mail" 
          ? "Registered Office (Office + Mail)" 
          : "Registered Office (Office Only)";
      default:
        return item.serviceType;
    }
  };

  const getNextSteps = () => {
    const context = data?.session?.contextJson || {};
    const lineItems = data?.session?.lineItems || [];
    
    const hasVerification = lineItems.some(i => i.serviceType === "verification");
    const hasIncorporation = lineItems.some(i => i.serviceType === "incorporation");
    const hasRegisteredOffice = lineItems.some(i => i.serviceType === "registered_office");

    const steps: Array<{ title: string; description: string; link: string }> = [];

    if (hasVerification) {
      steps.push({
        title: "Complete Identity Verification",
        description: "Upload your identity documents to verify your account",
        link: "/founder/identity",
      });
    }

    if (hasIncorporation && context.applicationId) {
      steps.push({
        title: "Continue Your Application",
        description: "Complete the remaining steps for your company incorporation",
        link: `/applications/${context.applicationId}`,
      });
    }

    if (hasRegisteredOffice) {
      steps.push({
        title: "View Registered Office",
        description: "Your registered office address is now active",
        link: "/founder/registered-office",
      });
    }

    if (steps.length === 0) {
      steps.push({
        title: "Go to Dashboard",
        description: "View your services and continue your journey",
        link: "/founder/dashboard",
      });
    }

    return steps;
  };

  if (hasSecondStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Step 1 Complete!</h1>
          <p className="text-muted-foreground mb-4">Your one-time payment was successful.</p>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-foreground">Redirecting to subscription checkout...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Processing your payment...</p>
        </div>
      </div>
    );
  }

  const lineItems = data?.session?.lineItems || [];
  const nextSteps = getNextSteps();

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Payment Successful</h1>
          <p className="text-muted-foreground mt-2">
            Thank you for your payment. Your services have been activated.
          </p>
        </div>

        {lineItems.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Services Purchased</CardTitle>
              <CardDescription>These services are now active on your account</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {lineItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="text-foreground">{getServiceName(item)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>Continue your journey with Celion One</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextSteps.map((step, idx) => (
              <Link key={idx} href={step.link}>
                <div 
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover-elevate cursor-pointer"
                  data-testid={`link-next-step-${idx}`}
                >
                  <div>
                    <h3 className="font-medium text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            ))}
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
