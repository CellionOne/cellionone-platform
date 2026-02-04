import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, HelpCircle } from "lucide-react";

export default function PaymentCancelPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 mb-4">
            <XCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Payment Cancelled</h1>
          <p className="text-muted-foreground mt-2">
            Your payment was cancelled. No charges have been made.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What would you like to do?</CardTitle>
            <CardDescription>You can try again or return to the dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => window.history.back()}
              data-testid="button-try-again"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setLocation("/founder/dashboard")}
              data-testid="button-go-dashboard"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              If you experienced issues with payment or have questions about our services, 
              please contact our support team.
            </p>
            <div className="text-sm">
              <p className="text-foreground">Email: support@celion.one</p>
              <p className="text-foreground">Phone: +234 800 CELION (235466)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
