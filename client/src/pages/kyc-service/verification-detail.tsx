import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  User,
  Building2,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowLeft,
  Send,
  Users,
  Link2,
  Copy,
  Search,
  AlertTriangle,
  Fingerprint,
  Camera,
  MapPin,
  Phone,
  Calendar,
  Layers,
} from "lucide-react";
import type { KycVerificationRequest, KycSupplierProfile, KycSubmittedDocument, KycSupplierPerson, KycDocumentRequirement } from "@shared/schema";

interface VerifiedIdentityProfile {
  fullName?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  idTypesVerified?: string[] | null;
  dataSource?: string | null;
  hasGovernmentPhoto?: boolean;
  capturedAt?: string | null;
}

interface VerificationDetail extends KycVerificationRequest {
  documents: KycSubmittedDocument[];
  supplierProfile: KycSupplierProfile | null;
  people: KycSupplierPerson[];
  requirements: KycDocumentRequirement[];
  orgName: string;
  verifiedIdentity?: VerifiedIdentityProfile | null;
}

const statusLabels: Record<string, string> = {
  pending_invite: "Pending Invite",
  pending_payment: "Pending Payment",
  in_progress: "In Progress",
  documents_submitted: "Docs Submitted",
  under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
  expired: "Expired",
};

const statusColors: Record<string, string> = {
  pending_invite: "bg-muted text-muted-foreground",
  pending_payment: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  documents_submitted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  under_review: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-muted text-muted-foreground",
};

const docStatusColors: Record<string, string> = {
  uploaded: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  extracted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const riskIcons: Record<string, typeof ShieldCheck> = {
  green: ShieldCheck,
  amber: ShieldAlert,
  red: ShieldX,
};

const riskColors: Record<string, string> = {
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};

export default function VerificationDetailPage() {
  const params = useParams<{ id: string; reqId: string }>();
  const orgId = params.id;
  const reqId = params.reqId;
  const { toast } = useToast();

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"verified" | "rejected">("verified");
  const [reviewNotes, setReviewNotes] = useState("");
  const [docReviewDialog, setDocReviewDialog] = useState<{ docId: number; action: "accepted" | "rejected" } | null>(null);
  const [docReviewNote, setDocReviewNote] = useState("");

  const { data: detail, isLoading } = useQuery<VerificationDetail>({
    queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests", reqId],
  });

  // Fetch government photo as a blob URL when available — access is audit-logged server-side
  const { data: governmentPhotoBlobUrl } = useQuery<string | null>({
    queryKey: ["/api/kyc-service/identity-data", reqId, "photo"],
    queryFn: async () => {
      if (!detail?.verifiedIdentity?.hasGovernmentPhoto) return null;
      const res = await fetch(`/api/kyc-service/identity-data/${reqId}/photo`, { credentials: "include" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    enabled: !!detail?.verifiedIdentity?.hasGovernmentPhoto,
    staleTime: 4 * 60 * 1000,
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { status: string; reviewNotes?: string; documentReviews?: any[] }) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}/verification-requests/${reqId}/review`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests", reqId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      setReviewDialogOpen(false);
      setReviewNotes("");
      toast({ title: "Review submitted" });
    },
    onError: (error: Error) => {
      toast({ title: "Review failed", description: error.message, variant: "destructive" });
    },
  });

  const docReviewMutation = useMutation({
    mutationFn: async (data: { documentReviews: any[] }) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}/verification-requests/${reqId}/review`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests", reqId] });
      setDocReviewDialog(null);
      setDocReviewNote("");
      toast({ title: "Document reviewed" });
    },
    onError: (error: Error) => {
      toast({ title: "Review failed", description: error.message, variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/verification-requests/${reqId}/resend-invite`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation resent" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to resend", description: error.message, variant: "destructive" });
    },
  });

  function handleOverallReview() {
    reviewMutation.mutate({
      status: reviewAction,
      reviewNotes: reviewNotes || undefined,
    });
  }

  function handleDocReview() {
    if (!docReviewDialog) return;
    docReviewMutation.mutate({
      documentReviews: [{
        documentId: docReviewDialog.docId,
        status: docReviewDialog.action,
        reviewNote: docReviewNote || undefined,
      }],
    });
  }

  function copyVerificationLink(token: string) {
    const link = `${window.location.origin}/kyc/verify/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Link copied", description: "Verification link copied to clipboard." });
    }).catch(() => {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
    });
  }

  if (isLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!detail) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Not Found" }]}>
        <EmptyState title="Request not found" description="The verification request doesn't exist or you don't have access." />
      </DashboardLayout>
    );
  }

  const RiskIcon = detail.riskScore ? riskIcons[detail.riskScore] || ShieldCheck : null;
  const verificationLink = `${window.location.origin}/kyc/verify/${detail.inviteToken}`;
  const isExpiringSoon = detail.expiresAt && new Date(detail.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  const isExpired = detail.expiresAt && new Date(detail.expiresAt) < new Date();

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "KYC Service", href: "/kyc/orgs" },
        { label: detail.orgName || "Organisation", href: `/kyc/org/${orgId}` },
        { label: detail.subjectName },
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href={`/kyc/org/${orgId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-subject-name">{detail.subjectName}</h1>
              <p className="text-sm text-muted-foreground">{detail.subjectEmail}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detail.status === "pending_invite" && (
              <Button variant="outline" onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending} data-testid="button-resend-invite">
                <Send className="h-4 w-4 mr-2" />
                {resendMutation.isPending ? "Sending..." : "Resend Invite"}
              </Button>
            )}
            {(detail.status === "documents_submitted" || detail.status === "under_review") && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setReviewAction("rejected"); setReviewDialogOpen(true); }}
                  data-testid="button-reject"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => { setReviewAction("verified"); setReviewDialogOpen(true); }}
                  data-testid="button-approve"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-subject-info">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {detail.type === "individual" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                Subject Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Type</span>
                <p className="text-sm font-medium">{detail.type === "individual" ? "Individual" : "Supplier"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Status</span>
                <div className="mt-1">
                  <Badge variant="secondary" className={`border-0 ${statusColors[detail.status] || ""}`} data-testid="badge-request-status">
                    {statusLabels[detail.status] || detail.status}
                  </Badge>
                </div>
              </div>
              {detail.riskScore && RiskIcon && (
                <div>
                  <span className="text-xs text-muted-foreground">Risk Score</span>
                  <div className="flex items-center gap-2 mt-1">
                    <RiskIcon className={`h-5 w-5 ${riskColors[detail.riskScore] || ""}`} />
                    <span className={`text-sm font-medium ${riskColors[detail.riskScore] || ""}`} data-testid="text-risk-score">
                      {detail.riskScore.charAt(0).toUpperCase() + detail.riskScore.slice(1)}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground">Payment</span>
                <p className="text-sm">{detail.paymentResponsibility === "organisation" ? "Organisation pays" : "Subject pays"} — {detail.paymentStatus}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Expires</span>
                <p className="text-sm">{detail.expiresAt ? new Date(detail.expiresAt).toLocaleDateString() : "-"}</p>
              </div>
              {detail.notes && (
                <div>
                  <span className="text-xs text-muted-foreground">Notes</span>
                  <p className="text-sm">{detail.notes}</p>
                </div>
              )}
              {detail.reviewNotes && (
                <div>
                  <span className="text-xs text-muted-foreground">Review Notes</span>
                  <p className="text-sm">{detail.reviewNotes}</p>
                </div>
              )}
              {detail.selfRegistered && (
                <Badge variant="secondary" className="border-0" data-testid="badge-self-registered">Self-registered</Badge>
              )}
            </CardContent>
          </Card>

          {detail.type === "supplier" && detail.supplierProfile && (
            <Card className="md:col-span-2" data-testid="card-supplier-profile">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Company Name</span>
                    <p className="text-sm font-medium" data-testid="text-company-name">{detail.supplierProfile.companyName}</p>
                  </div>
                  {detail.supplierProfile.rcNumber && (
                    <div>
                      <span className="text-xs text-muted-foreground">RC Number</span>
                      <p className="text-sm">{detail.supplierProfile.rcNumber}</p>
                    </div>
                  )}
                  {detail.supplierProfile.tinNumber && (
                    <div>
                      <span className="text-xs text-muted-foreground">TIN</span>
                      <p className="text-sm">{detail.supplierProfile.tinNumber}</p>
                    </div>
                  )}
                  {detail.supplierProfile.industryCategory && (
                    <div>
                      <span className="text-xs text-muted-foreground">Industry</span>
                      <p className="text-sm">{detail.supplierProfile.industryCategory}</p>
                    </div>
                  )}
                  {detail.supplierProfile.yearEstablished && (
                    <div>
                      <span className="text-xs text-muted-foreground">Year Established</span>
                      <p className="text-sm">{detail.supplierProfile.yearEstablished}</p>
                    </div>
                  )}
                  {detail.supplierProfile.headOfficeAddress && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-muted-foreground">Address</span>
                      <p className="text-sm">{detail.supplierProfile.headOfficeAddress}</p>
                    </div>
                  )}
                  <Separator className="sm:col-span-2" />
                  <div>
                    <span className="text-xs text-muted-foreground">Contact Person</span>
                    <p className="text-sm">{detail.supplierProfile.contactPersonName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Contact Email</span>
                    <p className="text-sm">{detail.supplierProfile.contactPersonEmail}</p>
                  </div>
                  {detail.supplierProfile.bankName && (
                    <>
                      <Separator className="sm:col-span-2" />
                      <div>
                        <span className="text-xs text-muted-foreground">Bank</span>
                        <p className="text-sm">{detail.supplierProfile.bankName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Account</span>
                        <p className="text-sm">{detail.supplierProfile.bankAccountName} - {detail.supplierProfile.bankAccountNumber}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {detail.type === "individual" && (
            <Card className="md:col-span-2" data-testid="card-individual-info">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Individual Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Name</span>
                    <p className="text-sm font-medium">{detail.subjectName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Email</span>
                    <p className="text-sm">{detail.subjectEmail}</p>
                  </div>
                  {detail.termsAcceptedAt && (
                    <div>
                      <span className="text-xs text-muted-foreground">Terms Accepted</span>
                      <p className="text-sm">{new Date(detail.termsAcceptedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Verified Identity Profile ──────────────────────────────────────── */}
        {detail.verifiedIdentity && (
          <Card className="border-green-200 dark:border-green-800" data-testid="card-verified-identity">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                <Fingerprint className="h-4 w-4" />
                Verified Identity Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {detail.verifiedIdentity.fullName && (
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Verified Name</span>
                      <p className="text-sm font-medium" data-testid="text-verified-name">{detail.verifiedIdentity.fullName}</p>
                    </div>
                  </div>
                )}
                {detail.verifiedIdentity.dateOfBirth && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Date of Birth</span>
                      <p className="text-sm" data-testid="text-verified-dob">{detail.verifiedIdentity.dateOfBirth}</p>
                    </div>
                  </div>
                )}
                {detail.verifiedIdentity.gender && (
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Gender</span>
                      <p className="text-sm capitalize" data-testid="text-verified-gender">{detail.verifiedIdentity.gender}</p>
                    </div>
                  </div>
                )}
                {detail.verifiedIdentity.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Phone</span>
                      <p className="text-sm" data-testid="text-verified-phone">{detail.verifiedIdentity.phone}</p>
                    </div>
                  </div>
                )}
                {detail.verifiedIdentity.address && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">Address</span>
                      <p className="text-sm" data-testid="text-verified-address">{detail.verifiedIdentity.address}</p>
                    </div>
                  </div>
                )}
                {detail.verifiedIdentity.idTypesVerified && (detail.verifiedIdentity.idTypesVerified as string[]).length > 0 && (
                  <div className="flex items-start gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">ID Types Verified</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(detail.verifiedIdentity.idTypesVerified as string[]).map((t: string) => (
                          <span key={t} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full" data-testid={`badge-id-type-${t}`}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {detail.verifiedIdentity.hasGovernmentPhoto && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block mb-1 flex items-center gap-1"><Camera className="h-3 w-3" /> Government Photo <span className="text-green-600 dark:text-green-400">(access logged)</span></span>
                    {governmentPhotoBlobUrl ? (
                      <img
                        src={governmentPhotoBlobUrl}
                        alt="Government ID photo"
                        className="rounded border max-h-40 max-w-full object-contain bg-muted"
                        data-testid="img-government-photo"
                      />
                    ) : (
                      <div className="h-24 w-32 rounded border bg-muted flex items-center justify-center" data-testid="img-government-photo-loading">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Source: <span className="capitalize">{(detail.verifiedIdentity.dataSource || "").replace(/_/g, " ")}</span>
                  {detail.verifiedIdentity.capturedAt && (
                    <> &bull; Captured {new Date(detail.verifiedIdentity.capturedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-hosted-link">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Hosted Verification Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isExpired ? (
                <div className="flex items-center gap-2 text-destructive text-sm" data-testid="text-link-expired">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  This verification request has expired. Create a new request to generate a fresh link.
                </div>
              ) : (
                <>
                  {isExpiringSoon && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="text-link-expiring-soon">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      Link expires {new Date(detail.expiresAt!).toLocaleDateString()} — resend to renew.
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Share this link with the subject to allow them to complete their verification without needing a separate email invitation.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted/50 border rounded-md px-3 py-2 text-xs font-mono truncate" data-testid="text-verification-link">
                      {verificationLink}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyVerificationLink(detail.inviteToken)}
                      data-testid="button-copy-verification-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-aml-status">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                AML & Sanctions Screening
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.riskScore ? (
                <>
                  <div className="flex items-center gap-3">
                    {detail.riskScore === 'green' ? (
                      <ShieldCheck className="h-8 w-8 text-green-600 flex-shrink-0" />
                    ) : detail.riskScore === 'amber' ? (
                      <ShieldAlert className="h-8 w-8 text-amber-600 flex-shrink-0" />
                    ) : (
                      <ShieldX className="h-8 w-8 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-semibold ${riskColors[detail.riskScore] || ""}`} data-testid="text-aml-risk">
                        {detail.riskScore === 'green' ? 'Clear — No Matches Found' :
                         detail.riskScore === 'amber' ? 'Review Required — Possible Match' :
                         'High Risk — Potential Sanctions Match'}
                      </p>
                      {detail.reviewedAt && (
                        <p className="text-xs text-muted-foreground">
                          Screened {new Date(detail.reviewedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {detail.reviewNotes && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Reviewer Notes</p>
                      <p className="text-sm">{detail.reviewNotes}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center" data-testid="text-aml-pending">
                  <ShieldCheck className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    AML screening will be completed during review.
                  </p>
                  {['pending_invite', 'pending_payment', 'in_progress', 'documents_submitted'].includes(detail.status) && (
                    <Badge variant="secondary" className="border-0">Pending Submission</Badge>
                  )}
                  {detail.status === 'under_review' && (
                    <Badge variant="secondary" className="border-0 bg-orange-100 text-orange-700">Under Review</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-documents">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents ({detail.documents?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!detail.documents || detail.documents.length === 0) ? (
              <EmptyState icon={FileText} title="No documents uploaded" description="The subject has not uploaded any documents yet." />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Requirement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Extracted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.documents.map((doc) => {
                      const requirement = detail.requirements?.find(r => r.id === doc.requirementId);
                      return (
                        <TableRow key={doc.id} data-testid={`row-doc-${doc.id}`}>
                          <TableCell>
                            <p className="text-sm font-medium">{doc.fileName}</p>
                            {doc.detectedDocumentType && (
                              <p className="text-xs text-muted-foreground">Detected: {doc.detectedDocumentType}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{requirement?.documentName || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`border-0 ${docStatusColors[doc.status] || ""}`} data-testid={`badge-doc-status-${doc.id}`}>
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {doc.expiryDate ? (
                              <span className="text-sm">{new Date(doc.expiryDate).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {doc.extractionConfirmed ? (
                              <Badge variant="secondary" className="border-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Confirmed</Badge>
                            ) : doc.extractedData ? (
                              <Badge variant="secondary" className="border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Extracted</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {doc.status !== "accepted" && doc.status !== "rejected" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDocReviewDialog({ docId: doc.id, action: "accepted" })}
                                    data-testid={`button-accept-doc-${doc.id}`}
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDocReviewDialog({ docId: doc.id, action: "rejected" })}
                                    data-testid={`button-reject-doc-${doc.id}`}
                                  >
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {detail.type === "supplier" && (
          <Card data-testid="card-people">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Directors & Significant Persons ({detail.people?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!detail.people || detail.people.length === 0) ? (
                <EmptyState icon={Users} title="No persons added" description="No directors or significant persons have been added to this request." />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.people.map((person) => (
                        <TableRow key={person.id} data-testid={`row-person-${person.id}`}>
                          <TableCell className="font-medium text-sm">{person.fullName}</TableCell>
                          <TableCell className="text-sm">{person.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="border-0">{person.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {person.requiresVerification ? "Required" : "Not Required"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`border-0 ${
                                person.verificationStatus === "verified"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : person.verificationStatus === "failed"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : person.verificationStatus === "in_progress"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              data-testid={`badge-person-status-${person.id}`}
                            >
                              {person.verificationStatus.replace(/_/g, " ")}
                            </Badge>
                            {person.individualRequestId && (
                              <Link href={`/kyc/org/${orgId}/requests/${person.individualRequestId}`}>
                                <Button variant="ghost" size="sm" className="ml-2" data-testid={`link-person-request-${person.id}`}>
                                  <Eye className="h-3 w-3 mr-1" /> View
                                </Button>
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {detail.status === "verified" && (
          <Card data-testid="card-certificate">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Audit Certificate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                This verification has been approved. You can download the audit certificate for your compliance files.
              </p>
              <Button variant="outline" data-testid="button-download-certificate">
                <Download className="h-4 w-4 mr-2" />
                Download Certificate
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "verified" ? "Approve" : "Reject"} Verification</DialogTitle>
            <DialogDescription>
              {reviewAction === "verified"
                ? "Approve this verification request. This will mark the subject as verified."
                : "Reject this verification request. Please provide a reason."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Review Notes {reviewAction === "rejected" && "(required)"}</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={reviewAction === "rejected" ? "Reason for rejection..." : "Optional notes..."}
                data-testid="input-review-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button
              variant={reviewAction === "rejected" ? "destructive" : "default"}
              onClick={handleOverallReview}
              disabled={reviewMutation.isPending || (reviewAction === "rejected" && !reviewNotes)}
              data-testid="button-submit-review"
            >
              {reviewMutation.isPending ? "Submitting..." : reviewAction === "verified" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!docReviewDialog} onOpenChange={() => setDocReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{docReviewDialog?.action === "accepted" ? "Accept" : "Reject"} Document</DialogTitle>
            <DialogDescription>
              {docReviewDialog?.action === "accepted"
                ? "Accept this document as valid."
                : "Reject this document. Please provide a reason."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note {docReviewDialog?.action === "rejected" && "(required)"}</Label>
              <Textarea
                value={docReviewNote}
                onChange={(e) => setDocReviewNote(e.target.value)}
                placeholder={docReviewDialog?.action === "rejected" ? "Reason for rejection..." : "Optional note..."}
                data-testid="input-doc-review-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocReviewDialog(null)}>Cancel</Button>
            <Button
              variant={docReviewDialog?.action === "rejected" ? "destructive" : "default"}
              onClick={handleDocReview}
              disabled={docReviewMutation.isPending || (docReviewDialog?.action === "rejected" && !docReviewNote)}
              data-testid="button-submit-doc-review"
            >
              {docReviewMutation.isPending ? "Submitting..." : docReviewDialog?.action === "accepted" ? "Accept" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
