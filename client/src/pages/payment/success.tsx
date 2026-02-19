import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function PaymentSuccessPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    sessionStorage.removeItem("checkoutState");
  }, []);

  const nextSteps = [
    {
      title: "View Your Applications",
      description: "Check the status of your company incorporation applications",
      link: "/founder/dashboard",
    },
    {
      title: "Complete Identity Verification",
      description: "Upload your identity documents if you haven't already",
      link: "/founder/identity",
    },
  ];

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Payment Successful</h1>
          <p className="text-muted-foreground mt-2">
            Thank you for your payment. Your services will be activated once the transaction is confirmed.
          </p>
        </div>

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
