import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  CheckCircle2,
  Info,
  ArrowRight,
  Users,
  Clock,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface VerificationInfo {
  founderVerified: boolean;
  people: { id: number; email: string; role: string; isVerified: boolean; inviteStatus: string }[];
  unverifiedCount: number;
  verificationFeePerPerson: number;
  totalVerificationFee: number;
}

function formatNgn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function IdentityVerificationPage() {
  const { user } = useAuth();

  const { data: verificationInfo, isLoading } = useQuery<VerificationInfo>({
    queryKey: ["/api/checkout/verification-info"],
  });

  const founderVerified = verificationInfo?.founderVerified ?? false;
  const people = verificationInfo?.people ?? [];
  const allVerified = verificationInfo?.unverifiedCount === 0;

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Identity Verification" }]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-identity-title">Identity Verification</h1>
          <p className="text-muted-foreground">
            Verification is required for all key persons before placing orders
          </p>
        </div>

        {allVerified && !isLoading ? (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" data-testid="card-all-verified">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle>All Identities Verified</CardTitle>
                    <Badge variant="default" data-testid="badge-verified">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  </div>
                  <CardDescription className="mt-1" data-testid="text-verified-desc">
                    All key persons have been verified. You can place orders and submit service requests.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ) : !isLoading ? (
          <>
            <Card data-testid="card-not-verified">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Verify Identities</CardTitle>
                    <CardDescription>
                      Each key person (you + directors/shareholders) requires a one-time verification fee
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Verification Fee (per person)</span>
                    <span className="font-bold text-lg">{formatNgn(verificationInfo?.verificationFeePerPerson || 1000000)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Persons needing verification</span>
                    <span className="font-semibold">{verificationInfo?.unverifiedCount || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">Total Verification Fee</span>
                    <span className="font-bold text-lg text-primary">{formatNgn(verificationInfo?.totalVerificationFee || 0)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This fee will be automatically added to your next order at checkout.
                  </p>
                </div>

                <Link href="/founder/checkout">
                  <Button className="w-full" data-testid="button-go-to-checkout">
                    Go to Services & Checkout <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        ) : null}

        <Card data-testid="card-verification-status">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Verification Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid="row-founder-status">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${founderVerified ? 'bg-green-100 dark:bg-green-900/50' : 'bg-yellow-100 dark:bg-yellow-900/50'}`}>
                  {founderVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">You (Founder)</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Badge variant={founderVerified ? "default" : "secondary"} data-testid="badge-founder-verified">
                {founderVerified ? "Verified" : "Pending"}
              </Badge>
            </div>

            {people.map(person => (
              <div key={person.id} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`row-person-status-${person.id}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    person.isVerified ? 'bg-green-100 dark:bg-green-900/50' :
                    person.inviteStatus === 'pending' ? 'bg-gray-100 dark:bg-gray-900/50' :
                    'bg-yellow-100 dark:bg-yellow-900/50'
                  }`}>
                    {person.isVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : person.inviteStatus === 'pending' ? (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{person.email}</p>
                    <p className="text-xs text-muted-foreground">{formatRole(person.role)}</p>
                  </div>
                </div>
                <Badge variant={person.isVerified ? "default" : person.inviteStatus === 'pending' ? "outline" : "secondary"} data-testid={`badge-person-verified-${person.id}`}>
                  {person.isVerified ? "Verified" : person.inviteStatus === 'pending' ? "Invite Pending" : "Pending"}
                </Badge>
              </div>
            ))}

            {people.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No directors or shareholders added yet.{" "}
                <Link href="/founder/company-people" className="text-primary hover:underline">
                  Add company people
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How Verification Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Each key person (founder, directors, shareholders) must be individually verified</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>The verification fee is {formatNgn(1000000)} per person, added to your checkout</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Verification is one-time — once verified, no future fees apply for that person</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Protects both you and the legal professionals processing your requests</span>
              </li>
            </ul>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-medium mb-2">Why do we charge for verification?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your {formatNgn(1000000)} verification fee covers a comprehensive 4-step identity check powered by Smile ID, a trusted third-party provider. This includes: (1) BVN/NIN validation against national databases, (2) government-issued ID document authenticity verification, (3) biometric selfie with liveness detection to confirm you are who you claim to be, and (4) AML and sanctions screening. These checks are required to comply with Nigerian regulatory standards and to give banks, the CAC, and other third parties full confidence in your identity.
              </p>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            Directors and shareholders you've invited must create their account and complete their
            profile before they can be verified. You can manage your company people from the{" "}
            <Link href="/founder/company-people" className="text-primary hover:underline font-medium">
              Directors & Shareholders
            </Link>{" "}
            page.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}
