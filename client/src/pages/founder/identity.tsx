import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  CheckCircle2,
  Info,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function IdentityVerificationPage() {
  const { user } = useAuth();
  const isVerified = user?.identityVerified === true;

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Identity Verification" }]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-identity-title">Identity Verification</h1>
          <p className="text-muted-foreground">
            One-time verification required before placing orders
          </p>
        </div>

        {isVerified ? (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" data-testid="card-verified">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle>Identity Verified</CardTitle>
                    <Badge variant="default" data-testid="badge-verified">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  </div>
                  <CardDescription className="mt-1" data-testid="text-verified-desc">
                    Your identity has been verified. You can now place orders and submit service requests.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card data-testid="card-not-verified">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Verify Your Identity</CardTitle>
                    <CardDescription>
                      A one-time identity verification fee is required before you can place orders
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Verification Fee</span>
                    <span className="font-bold text-lg">{"\u20A6"}5,000</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This one-time fee covers identity verification via Smile ID. It will be automatically
                    added to your first order at checkout.
                  </p>
                </div>

                <Link href="/founder/checkout">
                  <Button className="w-full" data-testid="button-go-to-checkout">
                    Go to Services & Checkout <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How Verification Works</AlertTitle>
              <AlertDescription>
                When you place your first order, the verification fee is automatically included.
                Once payment is confirmed, your identity will be verified and you can access all platform features.
                The verification fee is a one-time charge and will not be applied to future orders.
              </AlertDescription>
            </Alert>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What is Identity Verification?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Confirms your identity for regulatory compliance in Nigeria</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Powered by Smile ID, a trusted African identity verification provider</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Only required once - subsequent orders do not include verification fees</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Protects both you and the legal professionals processing your requests</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
