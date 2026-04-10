import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Sparkles,
  Lock,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  isKybPipelineVerified?: boolean;
  identitySource?: string | null;
  bvnNinVerified?: boolean;
}

function formatNgn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function FreeBiometricCapture({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      toast({ title: "Camera error", description: "Unable to access camera. Please allow camera permissions and try again.", variant: "destructive" });
    }
  }, [toast]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);
    // Stop camera stream
    const stream = videoRef.current.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
    setStreaming(false);
  }, []);

  const biometricMutation = useMutation({
    mutationFn: async (base64: string) => {
      return apiRequest("POST", "/api/founder/identity-verification/biometric", {
        imageBase64: base64,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/checkout/verification-info"] });
      toast({ title: "Biometric submitted!", description: "Your selfie is being processed. We'll notify you when verification is complete." });
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const submit = () => {
    if (!captured) return;
    // Strip the data URL prefix to get pure base64
    const base64 = captured.replace(/^data:image\/\w+;base64,/, "");
    biometricMutation.mutate(base64);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" data-testid="alert-biometric-submitted">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-700 dark:text-green-400">Selfie submitted — processing</p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">You'll receive an email once verification is complete (usually within minutes).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!streaming && !captured && (
        <Button onClick={startCamera} className="w-full" data-testid="button-start-camera">
          <Camera className="h-4 w-4 mr-2" /> Start Camera
        </Button>
      )}

      {streaming && (
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden border border-border bg-black">
            <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted />
          </div>
          <p className="text-xs text-muted-foreground text-center">Position your face clearly in the frame, then capture</p>
          <Button onClick={capture} className="w-full" data-testid="button-capture-selfie">
            <Camera className="h-4 w-4 mr-2" /> Capture Selfie
          </Button>
        </div>
      )}

      {captured && (
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden border border-border">
            <img src={captured} alt="Captured selfie" className="w-full max-h-64 object-cover" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setCaptured(null); startCamera(); }} className="flex-1" data-testid="button-retake-selfie">
              Retake
            </Button>
            <Button onClick={submit} disabled={biometricMutation.isPending} className="flex-1" data-testid="button-submit-selfie">
              {biometricMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : "Submit Selfie"}
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

interface PersonalProfileSnippet {
  fullName: string | null;
  phone: string | null;
  hasNin: boolean;
  hasBvn: boolean;
  hasIdDocument: boolean;
  hasPassportPhoto: boolean;
  kybPrefilled?: boolean;
}

export default function IdentityVerificationPage() {
  const { user } = useAuth();
  const [selfieSuccess, setSelfieSuccess] = useState(false);

  const { data: verificationInfo, isLoading } = useQuery<VerificationInfo>({
    queryKey: ["/api/checkout/verification-info"],
  });

  const { data: profile } = useQuery<PersonalProfileSnippet>({
    queryKey: ["/api/profile/personal"],
  });

  const founderVerified = verificationInfo?.founderVerified ?? false;
  const people = verificationInfo?.people ?? [];
  const allVerified = verificationInfo?.unverifiedCount === 0;
  const daysUntilExpiry = verificationInfo?.founderDaysUntilExpiry ?? null;
  const founderExpiresAt = verificationInfo?.founderExpiresAt;
  const verificationExpired = verificationInfo?.founderVerificationStatus === "expired";
  const verificationExpiringSoon = founderVerified && daysUntilExpiry !== null && daysUntilExpiry <= 30;
  const isKybPipelineVerified = verificationInfo?.isKybPipelineVerified ?? false;

  const prereqs = [
    {
      key: "fullName",
      label: "Full legal name",
      // kybPrefilled auto-satisfies only KYB-populated identity fields (name/phone/NIN/BVN)
      done: !!(profile?.kybPrefilled || profile?.fullName),
      anchor: "/profile#personal-info",
    },
    {
      key: "phone",
      label: "Phone number",
      done: !!(profile?.kybPrefilled || profile?.phone),
      anchor: "/profile#personal-info",
    },
    {
      key: "identity",
      label: "NIN or BVN",
      done: !!(profile?.kybPrefilled || profile?.hasNin || profile?.hasBvn),
      anchor: "/profile#identity-docs",
    },
    {
      key: "idDoc",
      label: "Government ID document uploaded",
      // ID doc and selfie must be based on actual completion — kybPrefilled does not auto-satisfy these
      done: !!profile?.hasIdDocument,
      anchor: "/profile#identity-docs",
    },
    {
      key: "selfie",
      label: "Biometric passport photo",
      done: !!(profile?.hasPassportPhoto || founderVerified),
      anchor: "/profile#biometric",
    },
  ];
  const prereqsComplete = prereqs.every(p => p.done);

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

        {/* Prerequisites checklist — hidden once fully verified */}
        {!isLoading && !allVerified && !selfieSuccess && profile && (
          <Card data-testid="card-prerequisites">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {prereqsComplete
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <Info className="h-4 w-4 text-muted-foreground" />}
                Profile Prerequisites
              </CardTitle>
              <CardDescription>
                {prereqsComplete
                  ? "All profile requirements are met. You can proceed with verification."
                  : "Complete the following in your profile before verifying your identity."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2" data-testid="list-prerequisites">
                {prereqs.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-3" data-testid={`prereq-item-${p.key}`}>
                    <span className="flex items-center gap-2 text-sm">
                      {p.done
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        : <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                      <span className={p.done ? "text-foreground" : "text-muted-foreground"}>{p.label}</span>
                    </span>
                    {!p.done && (
                      <Link href={p.anchor} className="text-xs text-primary underline underline-offset-2 whitespace-nowrap" data-testid={`link-prereq-${p.key}`}>
                        Complete →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* KYB pipeline banner — shown when BVN/NIN already verified via company registration */}
        {!isLoading && isKybPipelineVerified && !founderVerified && !selfieSuccess && (
          <Alert className="border-primary/40 bg-primary/5 dark:bg-primary/10" data-testid="alert-kyb-pipeline">
            <Sparkles className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">You are also listed as a director — one step remaining</AlertTitle>
            <AlertDescription>
              Your BVN/NIN and AML check were completed automatically during your company registration because you were listed as a director. Complete your biometric selfie below using the <strong>Start Camera</strong> button on your{" "}
              <Link href="/profile#biometric" className="underline font-medium">Personal Profile</Link> — no payment required.
            </AlertDescription>
          </Alert>
        )}

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
        ) : !isLoading && !isKybPipelineVerified ? (
          /* Standard paid verification path — shown only for non-KYB founders */
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

        {/* Free biometric selfie card for KYB-pipeline founders */}
        {!isLoading && isKybPipelineVerified && !founderVerified && (
          <Card className="border-primary/30" data-testid="card-free-biometric">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Biometric Selfie
                    <Badge variant="outline" className="text-primary border-primary/40 bg-primary/5 text-xs gap-1">
                      <Lock className="h-3 w-3" /> Free
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Take a quick liveness selfie to complete your identity verification — no payment required
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FreeBiometricCapture onSuccess={() => setSelfieSuccess(true)} />
            </CardContent>
          </Card>
        )}

        {/* Standard biometric selfie status card */}
        {!isLoading && !isKybPipelineVerified && (
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
            <div className={`flex items-center justify-between p-3 rounded-lg border ${verificationExpired ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : verificationExpiringSoon ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20' : isKybPipelineVerified && !founderVerified ? 'border-primary/30 bg-primary/5' : 'border-border'}`} data-testid="row-founder-status">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  verificationExpired ? 'bg-red-100 dark:bg-red-900/50' :
                  founderVerified ? 'bg-green-100 dark:bg-green-900/50' :
                  isKybPipelineVerified ? 'bg-primary/10' :
                  'bg-yellow-100 dark:bg-yellow-900/50'
                }`}>
                  {verificationExpired ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : founderVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : isKybPipelineVerified ? (
                    <Sparkles className="h-4 w-4 text-primary" />
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
                  {isKybPipelineVerified && !founderVerified && (
                    <p className="text-xs text-primary/80 mt-0.5">BVN/NIN verified — selfie required to complete</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={verificationExpired ? "destructive" : founderVerified ? "default" : isKybPipelineVerified ? "outline" : "secondary"}
                  className={isKybPipelineVerified && !founderVerified ? "border-primary/40 text-primary" : ""}
                  data-testid="badge-founder-verified"
                >
                  {verificationExpired ? "Expired" : founderVerified ? "Verified" : isKybPipelineVerified ? "BVN/NIN ✓" : "Pending"}
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
                <span>Founders who registered an existing company have their BVN/NIN verified automatically — the biometric selfie is free</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Other founders pay a one-time {verificationInfo?.verificationFeePerPerson ? formatNgn(verificationInfo.verificationFeePerPerson) : "₦10,000"} fee, added to checkout</span>
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
          </CardContent>
        </Card>

        {/* Two-path clarity card — always shown to reduce confusion */}
        <Card className="border-border/60" data-testid="card-selfie-paths">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Where to take your biometric selfie</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                You (the account holder)
              </p>
              <p className="text-sm text-muted-foreground">
                Complete your selfie on your{" "}
                <Link href="/profile#biometric" className="text-primary underline underline-offset-2">Personal Profile page</Link>.
                Use the <strong>Start Camera</strong> button in the "Verify My Identity — Biometric Selfie" section. The selfie is captured directly in your browser — no email link needed.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Directors & shareholders without an account
              </p>
              <p className="text-sm text-muted-foreground">
                They receive an email with a secure link they can open on any device, including their phone. The link is valid for 48 hours. If their link expires, contact support to request a new one.
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
