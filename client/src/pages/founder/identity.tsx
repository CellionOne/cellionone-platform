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
  Link2,
  AlertTriangle,
  CalendarClock,
  Camera,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface VerificationInfo {
  founderVerified: boolean;
  people: { id: number; email: string; role: string; isVerified: boolean; inviteStatus: string }[];
  unverifiedCount: number;
  verificationFeePerPerson: number;
  totalVerificationFee: number;
  hasPaidVerification?: boolean;
  founderVerificationStatus?: string;
  founderExpiresAt?: string | null;
  founderDaysUntilExpiry?: number | null;
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
  const daysUntilExpiry = verificationInfo?.founderDaysUntilExpiry ?? null;
  const founderExpiresAt = verificationInfo?.founderExpiresAt;
  const verificationExpired = verificationInfo?.founderVerificationStatus === "expired";
  const verificationExpiringSoon = founderVerified && daysUntilExpiry !== null && daysUntilExpiry <= 30;

  function formatExpiryDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

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

        {!isLoading && verificationExpired && (
          <Alert variant="destructive" data-testid="alert-verification-expired">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Verification Expired</AlertTitle>
            <AlertDescription>
              Your identity verification expired on {formatExpiryDate(founderExpiresAt)}. You must re-verify to continue placing orders. Go to your{" "}
              <Link href="/profile" className="font-medium underline">
                Personal Profile
              </Link>{" "}
              to capture a new biometric selfie.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && verificationExpiringSoon && !verificationExpired && (
          <Alert className="border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 [&>svg]:text-yellow-600" data-testid="alert-verification-expiring">
            <CalendarClock className="h-4 w-4" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-300">Verification Expiring Soon</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
              Your identity verification expires on {formatExpiryDate(founderExpiresAt)} ({daysUntilExpiry} day{daysUntilExpiry === 1 ? "" : "s"} remaining). Renew now to avoid service disruption.
            </AlertDescription>
          </Alert>
        )}

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
                  <span className="font-bold text-lg">{verificationInfo?.verificationFeePerPerson ? formatNgn(verificationInfo.verificationFeePerPerson) : "—"}</span>
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
        ) : null}

        {/* Biometric selfie status — canonical step is on Personal Profile page */}
        {!isLoading && (
          <Card data-testid="card-biometric-step">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${founderVerified ? "bg-green-100 dark:bg-green-900/50" : "bg-primary/15"}`}>
                  {founderVerified ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Camera className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base">Step 3 of 4: Biometric Selfie</CardTitle>
                  <CardDescription>
                    {founderVerified
                      ? "Your biometric selfie has been captured and verified"
                      : "Capture your live selfie on your Personal Profile page"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {founderVerified ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" data-testid="alert-selfie-done">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Selfie complete</p>
                    <p className="text-xs text-green-600 dark:text-green-500">
                      Liveness confirmed. Your profile is verified.
                      {founderExpiresAt && ` Expires ${formatExpiryDate(founderExpiresAt)}.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your biometric selfie is captured directly on your Personal Profile page. This keeps all your identity information in one place.
                  </p>
                  <Link href="/profile#biometric">
                    <Button className="w-full" variant="outline" data-testid="button-go-to-selfie">
                      <Link2 className="h-4 w-4 mr-2" />
                      Go to Personal Profile to capture selfie
                    </Button>
                  </Link>
                  <p className="text-xs text-muted-foreground text-center">
                    Scroll to the "Verify My Identity — Biometric Selfie" section on your profile page
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-verification-status">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Verification Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`flex items-center justify-between p-3 rounded-lg border ${verificationExpired ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : verificationExpiringSoon ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20' : 'border-border'}`} data-testid="row-founder-status">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  verificationExpired ? 'bg-red-100 dark:bg-red-900/50' :
                  founderVerified ? 'bg-green-100 dark:bg-green-900/50' :
                  'bg-yellow-100 dark:bg-yellow-900/50'
                }`}>
                  {verificationExpired ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : founderVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">You (Founder)</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  {founderVerified && founderExpiresAt && (
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-founder-expiry-date">
                      Expires {formatExpiryDate(founderExpiresAt)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={verificationExpired ? "destructive" : founderVerified ? "default" : "secondary"}
                  data-testid="badge-founder-verified"
                >
                  {verificationExpired ? "Expired" : founderVerified ? "Verified" : "Pending"}
                </Badge>
                {verificationExpiringSoon && !verificationExpired && daysUntilExpiry !== null && (
                  <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50 dark:text-yellow-300 dark:border-yellow-700 dark:bg-yellow-950/30 text-xs" data-testid="badge-founder-expiry-warning">
                    {daysUntilExpiry}d remaining
                  </Badge>
                )}
              </div>
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
                <span>The verification fee is {verificationInfo?.verificationFeePerPerson ? formatNgn(verificationInfo.verificationFeePerPerson) : "a one-time fee"} per person, added to your checkout</span>
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
                Your {verificationInfo?.verificationFeePerPerson ? formatNgn(verificationInfo.verificationFeePerPerson) : "verification"} fee covers a comprehensive 4-step identity check powered by Cellion's verification engine. This includes: (1) BVN/NIN validation against national databases, (2) government-issued ID document authenticity verification, (3) biometric selfie with liveness detection to confirm you are who you claim to be, and (4) AML and sanctions screening. These checks are required to comply with Nigerian regulatory standards and to give banks, the CAC, and other third parties full confidence in your identity.
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
