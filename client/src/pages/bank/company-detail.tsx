import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, ArrowLeft, LogOut, Loader2, CheckCircle, XCircle, Clock,
  FileText, User, MapPin, Send, AlertCircle, Users, ShieldCheck, UserCircle, Download
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function formatBankDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type BankSession = {
  email: string;
  bankPartnerId: number;
  bankName?: string;
};

type Director = {
  name?: string;
  role?: string;
  ninVerified?: boolean;
  bvnVerified?: boolean;
  biometricStatus?: string;
  amlIsHit?: boolean | null;
};

type Shareholder = {
  name: string;
  shares?: number;
  percentage?: number;
};

type ChecklistItem = {
  id?: string;
  label: string;
  required?: boolean;
  status?: string;
};

type Company = {
  id: number;
  companyName?: string;
  companyType?: string;
  rcNumber?: string;
  tinNumber?: string;
  existingCompanyStatus?: string;
  incorporationDate?: string;
  shareCapital?: string;
  businessActivities?: string[];
  registeredAddress?: Record<string, string>;
  operatingAddress?: Record<string, string>;
  directors?: Director[];
  shareholders?: Shareholder[];
  checklistItems?: ChecklistItem[];
  smileKybResult?: Record<string, unknown>;
  kybVerified?: boolean;
  cellionCertRef?: string;
  dispatchedAt?: string;
  bankDocuments?: BankDocument[];
  platformPeople?: PlatformPerson[];
  founderProfile?: FounderProfileData | null;
};

type BankDocument = {
  id: number;
  filename: string;
  docType?: string;
  category?: string;
  mimeType?: string;
  sizeBytes?: number;
  shareWithBank: boolean;
  source?: string;
};

type PlatformPersonProfile = {
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  occupation: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  idType: string | null;
  hasSignature: boolean;
};

type PlatformPerson = {
  id: number;
  inviteEmail: string | null;
  role: string | null;
  sharesAllocated: number | null;
  shareClass: string | null;
  sharePercentage: number | null;
  personUserId: string | null;
  profile: PlatformPersonProfile | null;
  isIdentityVerified: boolean | null;
};

type FounderProfileData = {
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  occupation: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  idType: string | null;
  hasSignature: boolean;
  isIdentityVerified: boolean;
};

type DocRequest = {
  id: number;
  companyProfileId: number;
  bankPartnerId: number;
  documentsRequested: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  fulfilledAt?: string | null;
};

function VerificationIcon({ value, trueLabel = "Verified", falseLabel = "Not Verified", pendingLabel = "Pending" }: {
  value?: boolean | null;
  trueLabel?: string;
  falseLabel?: string;
  pendingLabel?: string;
}) {
  if (value === true) return <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="h-3.5 w-3.5" />{trueLabel}</span>;
  if (value === false) return <span className="flex items-center gap-1 text-red-600 text-xs"><XCircle className="h-3.5 w-3.5" />{falseLabel}</span>;
  return <span className="flex items-center gap-1 text-muted-foreground text-xs"><Clock className="h-3.5 w-3.5" />{pendingLabel}</span>;
}

function docStatusColor(status?: string) {
  if (!status || status === "missing") return "text-red-500";
  if (status === "submitted" || status === "approved" || status === "provided") return "text-green-600";
  if (status === "pending_review") return "text-yellow-600";
  return "text-muted-foreground";
}

export default function BankCompanyDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [docRequestOpen, setDocRequestOpen] = useState(false);
  const [documentsRequested, setDocumentsRequested] = useState("");
  const [reason, setReason] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery<BankSession>({
    queryKey: ["/api/bank-portal/me"],
    retry: false,
  });

  const { data: company, isLoading: companyLoading } = useQuery<Company>({
    queryKey: ["/api/bank-portal/companies", id],
    queryFn: async () => {
      const res = await fetch(`/api/bank-portal/companies/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!session && !!id,
  });

  const { data: docRequests } = useQuery<DocRequest[]>({
    queryKey: ["/api/bank-portal/companies", id, "doc-requests"],
    queryFn: async () => {
      const res = await fetch(`/api/bank-portal/companies/${id}/doc-requests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session && !!id && !!company,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/bank-portal/logout"); },
    onSuccess: () => { queryClient.clear(); setLocation("/bank/login"); },
    onError: () => { queryClient.clear(); setLocation("/bank/login"); },
  });

  const docRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bank-portal/companies/${id}/doc-requests`, {
        documentsRequested,
        reason: reason || undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request submitted", description: "The founder has been notified and will share the required documents in the vault." });
      setDocRequestOpen(false);
      setDocumentsRequested("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/bank-portal/companies", id, "doc-requests"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (sessionLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    setLocation("/bank/login");
    return null;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Company not found or not dispatched to your bank.</p>
        <Button asChild variant="outline">
          <Link href="/bank/companies">Back to Companies</Link>
        </Button>
      </div>
    );
  }

  const directors = Array.isArray(company.directors) ? company.directors : [];
  const shareholders = Array.isArray(company.shareholders) ? company.shareholders : [];
  const checklistItems = Array.isArray(company.checklistItems) ? company.checklistItems : [];
  const bankDocuments = Array.isArray(company.bankDocuments) ? company.bankDocuments : [];
  const platformPeople = Array.isArray(company.platformPeople) ? company.platformPeople : [];
  const platformDirectors = platformPeople.filter(p => p.role === "director" || p.role === "director_shareholder");
  const platformShareholders = platformPeople.filter(p => p.role === "shareholder" || p.role === "director_shareholder");

  const loadSignature = (personId?: string) => {
    const proxyUrl = personId
      ? `/api/bank-portal/companies/${id}/people/${personId}/signature/image`
      : `/api/bank-portal/companies/${id}/founder/signature/image`;
    setSignatureUrl(proxyUrl);
    setSignatureOpen(true);
  };

  const handleSignatureError = () => {
    setSignatureOpen(false);
    setSignatureUrl(null);
    toast({ title: "Signature unavailable", description: "Could not load signature specimen. The founder may need to re-upload their signature.", variant: "destructive" });
  };

  const downloadDocument = async (docId: number, filename: string, source?: string) => {
    try {
      const endpoint = source === "checklist"
        ? `/api/bank-portal/companies/${id}/checklist-documents/${docId}/download`
        : `/api/bank-portal/companies/${id}/documents/${docId}/download`;
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Download failed", description: err.error || "Could not generate download link.", variant: "destructive" });
        return;
      }
      const { downloadUrl } = await res.json();
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } catch {
      toast({ title: "Download failed", description: "Could not generate download link.", variant: "destructive" });
    }
  };
  const requiredDocs = checklistItems.filter(c => c.required);
  const completedRequired = requiredDocs.filter(c => c.status === "submitted" || c.status === "approved" || c.status === "provided");
  const complianceScore = requiredDocs.length > 0 ? Math.round((completedRequired.length / requiredDocs.length) * 100) : null;
  const kybPassed = company.kybVerified === true ||
    (company.smileKybResult && (company.smileKybResult as Record<string, unknown>).ResultCode === "1012");
  const directorsVerified = directors.length > 0 && directors.every(d => d.ninVerified || d.bvnVerified);
  const amlClear = directors.length > 0 && directors.every(d => d.amlIsHit === false);
  const registeredAddr = company.registeredAddress
    ? [company.registeredAddress.line1, company.registeredAddress.city, company.registeredAddress.state].filter(Boolean).join(", ")
    : "—";
  const operatingAddr = company.operatingAddress
    ? [company.operatingAddress.line1, company.operatingAddress.city, company.operatingAddress.state].filter(Boolean).join(", ")
    : "—";

  const statusColors: Record<string, string> = {
    verified: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">Cellion One — Bank Portal</p>
              <p className="text-xs text-muted-foreground mt-0.5">{session.bankName || `Partner #${session.bankPartnerId}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild data-testid="button-bank-account">
              <Link href="/bank/account">
                <UserCircle className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Account</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-bank-logout"
            >
              {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/bank/companies">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{company.companyName || "—"}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {company.existingCompanyStatus && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[company.existingCompanyStatus] || "bg-gray-100 text-gray-700"}`}>
                  {company.existingCompanyStatus.replace(/_/g, " ").toUpperCase()}
                </span>
              )}
              {company.dispatchedAt && (
                <span className="text-xs text-muted-foreground">
                  Dispatched {format(new Date(company.dispatchedAt), "d MMM yyyy")}
                </span>
              )}
            </div>
          </div>
          <Dialog open={docRequestOpen} onOpenChange={setDocRequestOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-request-documents">
                <Send className="h-4 w-4 mr-2" />
                Request Documents
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Additional Documents</DialogTitle>
                <DialogDescription>
                  Describe the documents you need. Cellion One admins will be notified and will follow up with you.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="docs-requested">Documents Needed</Label>
                  <Textarea
                    id="docs-requested"
                    placeholder="e.g. Board resolution, utility bill, audited financial statements..."
                    rows={4}
                    value={documentsRequested}
                    onChange={e => setDocumentsRequested(e.target.value)}
                    data-testid="textarea-documents-requested"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g. Required for account opening assessment"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    data-testid="input-doc-request-reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDocRequestOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => docRequestMutation.mutate()}
                  disabled={docRequestMutation.isPending || documentsRequested.trim().length < 5}
                  data-testid="button-submit-doc-request"
                >
                  {docRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Company Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { label: "Company Name", value: company.companyName },
                { label: "Company Type", value: company.companyType },
                { label: "RC Number", value: company.rcNumber },
                { label: "TIN", value: company.tinNumber },
                {
                  label: "Incorporation Date",
                  value: company.incorporationDate ? format(new Date(company.incorporationDate), "d MMMM yyyy") : undefined,
                },
                { label: "Share Capital", value: company.shareCapital },
                {
                  label: "Business Activities",
                  value: Array.isArray(company.businessActivities) ? company.businessActivities.join(", ") : company.businessActivities,
                },
                { label: "Registered Address", value: registeredAddr },
                { label: "Operating Address", value: operatingAddr },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
                  <dd className="font-medium mt-0.5">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Signature Modal */}
        <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Signature Specimen</DialogTitle>
              <DialogDescription>This signature is provided for identity verification purposes only. Access is logged.</DialogDescription>
            </DialogHeader>
            {signatureUrl && (
              <div className="flex justify-center py-4">
                <img src={signatureUrl} alt="Signature specimen" className="max-h-48 border rounded" onError={handleSignatureError} />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Founder Profile */}
        {company.founderProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle className="h-4 w-4" />
                Founder Profile
                {company.founderProfile.isIdentityVerified && (
                  <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 border-0 text-xs">Identity Verified</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Full Name", value: company.founderProfile.fullName },
                  { label: "Phone", value: company.founderProfile.phone },
                  { label: "Date of Birth", value: company.founderProfile.dateOfBirth },
                  { label: "Nationality", value: company.founderProfile.nationality },
                  { label: "Occupation", value: company.founderProfile.occupation },
                  { label: "Address", value: [company.founderProfile.addressLine1, company.founderProfile.city, company.founderProfile.state].filter(Boolean).join(", ") || undefined },
                  { label: "ID Type", value: company.founderProfile.idType },
                ].filter(r => r.value).map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
                    <dd className="font-medium mt-0.5">{value}</dd>
                  </div>
                ))}
              </dl>
              {company.founderProfile.hasSignature && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadSignature()}
                    data-testid="button-view-founder-signature"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    View Signature
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">Access to this signature specimen is audited.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* KYB Result */}
        {company.smileKybResult && Object.keys(company.smileKybResult).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-4 w-4" />
                KYB Verification Result (Smile ID)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {Object.entries(company.smileKybResult).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground text-xs uppercase tracking-wide">{k.replace(/_/g, " ")}</dt>
                    <dd className="font-medium mt-0.5">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Compliance Readiness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Compliance Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {kybPassed
                  ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  : <Clock className="h-5 w-5 text-yellow-500 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">KYB Verification</p>
                  <p className="text-xs text-muted-foreground">{kybPassed ? "Passed (Smile ID)" : company.smileKybResult ? "Checked — not passed" : "Pending"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {directorsVerified
                  ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  : directors.length === 0
                    ? <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                    : <XCircle className="h-5 w-5 text-yellow-500 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">Director Identity</p>
                  <p className="text-xs text-muted-foreground">
                    {directors.length === 0 ? "No directors on record" : directorsVerified ? "All directors verified" : `${directors.filter(d => d.ninVerified || d.bvnVerified).length}/${directors.length} verified`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {amlClear
                  ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  : directors.length === 0
                    ? <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                    : <Clock className="h-5 w-5 text-yellow-500 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">AML Screening</p>
                  <p className="text-xs text-muted-foreground">
                    {directors.length === 0 ? "No directors on record" : amlClear ? "All directors clear" : "Pending or incomplete"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {complianceScore === 100
                  ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  : complianceScore !== null && complianceScore >= 70
                    ? <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
                    : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">Required Documents</p>
                  <p className="text-xs text-muted-foreground">
                    {complianceScore === null ? "No required documents defined" : `${completedRequired.length}/${requiredDocs.length} submitted (${complianceScore}%)`}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shareholders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Shareholders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform shareholders */}
            {platformShareholders.length > 0 && (
              <div>
                {(shareholders.length > 0) && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Platform-Registered</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs text-muted-foreground font-medium">Name</th>
                        <th className="text-left py-2 text-xs text-muted-foreground font-medium">Role</th>
                        <th className="text-right py-2 text-xs text-muted-foreground font-medium">Shares</th>
                        <th className="text-right py-2 text-xs text-muted-foreground font-medium">%</th>
                        <th className="text-right py-2 text-xs text-muted-foreground font-medium">Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformShareholders.map((p, i) => (
                        <tr key={p.id} className="border-b last:border-0" data-testid={`row-platform-shareholder-${i}`}>
                          <td className="py-2 font-medium">{p.profile?.fullName || p.inviteEmail || "—"}</td>
                          <td className="py-2 text-muted-foreground text-xs">{p.role === "director_shareholder" ? "Dir & SH" : "SH"}</td>
                          <td className="py-2 text-right text-muted-foreground">{p.sharesAllocated != null ? p.sharesAllocated.toLocaleString() : "—"}</td>
                          <td className="py-2 text-right">{p.sharePercentage != null ? `${p.sharePercentage}%` : "—"}</td>
                          <td className="py-2 text-right">
                            {p.isIdentityVerified
                              ? <span className="text-green-600 text-xs">✓</span>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CAC-sourced shareholders */}
            {shareholders.length > 0 && (() => {
              const hasShareData = shareholders.some(s => s.shares != null || s.percentage != null);
              return (
                <div>
                  {platformShareholders.length > 0 && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">CAC-Sourced</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Name</th>
                          {hasShareData && <th className="text-right py-2 text-xs text-muted-foreground font-medium">Shares</th>}
                          {hasShareData && <th className="text-right py-2 text-xs text-muted-foreground font-medium">Ownership</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {shareholders.map((s, i) => (
                          <tr key={i} className="border-b last:border-0" data-testid={`row-shareholder-${i}`}>
                            <td className="py-2 font-medium">{s.name}</td>
                            {hasShareData && <td className="py-2 text-right text-muted-foreground">{s.shares != null ? s.shares.toLocaleString() : "—"}</td>}
                            {hasShareData && <td className="py-2 text-right">{s.percentage != null ? `${s.percentage.toFixed(2)}%` : "—"}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!hasShareData && company.shareCapital && (
                    <p className="text-xs text-muted-foreground mt-2">Total authorised share capital: {company.shareCapital}. Individual allocation not captured during registration.</p>
                  )}
                  {!hasShareData && !company.shareCapital && (
                    <p className="text-xs text-muted-foreground mt-2">Individual share allocation was not captured during registration.</p>
                  )}
                </div>
              );
            })()}

            {shareholders.length === 0 && platformShareholders.length === 0 && (
              <p className="text-muted-foreground text-sm">No shareholder information available.</p>
            )}
          </CardContent>
        </Card>

        {/* Directors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Directors & Officers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform-registered directors (with full profile data) */}
            {platformDirectors.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Platform-Registered</p>
                {platformDirectors.map((p, i) => (
                  <div key={p.id} className="border rounded-lg p-4 space-y-3" data-testid={`card-platform-director-${i}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{p.profile?.fullName || p.inviteEmail || "—"}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted-foreground">{p.role === "director_shareholder" ? "Director & Shareholder" : p.role}</p>
                          {p.isIdentityVerified && <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 border-0">Identity Verified</Badge>}
                        </div>
                      </div>
                    </div>
                    {p.profile && (
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        {p.profile.phone && <div><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{p.profile.phone}</dd></div>}
                        {p.profile.dateOfBirth && <div><dt className="text-muted-foreground">Date of Birth</dt><dd className="font-medium">{p.profile.dateOfBirth}</dd></div>}
                        {p.profile.nationality && <div><dt className="text-muted-foreground">Nationality</dt><dd className="font-medium">{p.profile.nationality}</dd></div>}
                        {p.profile.occupation && <div><dt className="text-muted-foreground">Occupation</dt><dd className="font-medium">{p.profile.occupation}</dd></div>}
                        {p.profile.idType && <div><dt className="text-muted-foreground">ID Type</dt><dd className="font-medium">{p.profile.idType}</dd></div>}
                        {(p.sharesAllocated || p.sharePercentage) && <div><dt className="text-muted-foreground">Shareholding</dt><dd className="font-medium">{p.sharePercentage != null ? `${p.sharePercentage}%` : `${(p.sharesAllocated || 0).toLocaleString()} shares`}</dd></div>}
                      </dl>
                    )}
                    {p.profile?.hasSignature && p.personUserId && (
                      <div className="pt-2 border-t flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadSignature(p.personUserId!)}
                          data-testid={`button-view-person-signature-${p.id}`}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1.5" />
                          View Signature
                        </Button>
                        <p className="text-xs text-muted-foreground">Access is audited.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* CAC-sourced directors */}
            {directors.length > 0 && (
              <div className="space-y-3">
                {platformDirectors.length > 0 && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CAC-Sourced</p>}
                {directors.map((d, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2" data-testid={`card-director-${i}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{d.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{d.role || "Director"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">NIN</p>
                        <VerificationIcon
                          value={d.ninVerified === true ? true : undefined}
                          trueLabel="Verified"
                          falseLabel="Not verified"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">BVN</p>
                        <VerificationIcon
                          value={d.bvnVerified === true ? true : undefined}
                          trueLabel="Verified"
                          falseLabel="Not verified"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Biometric</p>
                        <VerificationIcon
                          value={d.biometricStatus === "completed" ? true : d.biometricStatus === "failed" ? false : undefined}
                          trueLabel="Match"
                          falseLabel="Failed"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">AML</p>
                        <VerificationIcon
                          value={d.amlIsHit === false ? true : d.amlIsHit === true ? false : undefined}
                          trueLabel="Clear"
                          falseLabel="HIT"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {directors.length === 0 && platformDirectors.length === 0 && (
              <p className="text-muted-foreground text-sm">No director information available.</p>
            )}
          </CardContent>
        </Card>

        {/* Document Audit */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Document Audit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checklistItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">No document records available.</p>
            ) : (
              <div className="divide-y">
                {checklistItems.map((item, i) => (
                  <div key={i} className="py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.required && <p className="text-xs text-muted-foreground">Required</p>}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${docStatusColor(item.status)}`}>
                      {(item.status || "missing").replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Downloadable Documents Shared by Founder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              Founder-Shared Documents
            </CardTitle>
            <CardDescription>
              Documents the company founder has explicitly shared with your bank for download.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bankDocuments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No documents have been shared by the founder yet.</p>
            ) : (
              <div className="divide-y">
                {bankDocuments.map((doc) => (
                  <div key={`${doc.source ?? "vault"}-${doc.id}`} className="py-3 flex items-center justify-between gap-3" data-testid={`row-bankdoc-${doc.source ?? "vault"}-${doc.id}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {[doc.docType, doc.sizeBytes ? formatBankDocSize(doc.sizeBytes) : null].filter(Boolean).join(" \u2022 ")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadDocument(doc.id, doc.filename, doc.source)}
                      data-testid={`button-download-bankdoc-${doc.id}`}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Requests */}
        {docRequests && docRequests.length > 0 && (
          <Card data-testid="card-doc-requests">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                My Document Requests
              </CardTitle>
              <CardDescription>
                Document requests submitted by your bank for this company.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {docRequests.map(req => (
                  <div key={req.id} className="py-3 first:pt-0 last:pb-0" data-testid={`row-doc-request-${req.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{req.documentsRequested}</p>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">Reason: {req.reason}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Submitted {format(new Date(req.createdAt), "dd MMM yyyy")}
                          {req.fulfilledAt && ` · Fulfilled ${format(new Date(req.fulfilledAt), "dd MMM yyyy")}`}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          req.status === "fulfilled"
                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 shrink-0"
                            : req.status === "actioned"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 shrink-0"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 shrink-0"
                        }
                      >
                        {req.status === "fulfilled" ? "Fulfilled" : req.status === "actioned" ? "Actioned" : "Open"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attestation */}
        {company.cellionCertRef && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attestation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                <span className="text-muted-foreground">Certificate Reference: </span>
                <span className="font-medium">{company.cellionCertRef}</span>
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center pb-4">
          This dossier was generated by Cellion One. The information is provided for bank due diligence purposes only.
        </p>
      </main>
    </div>
  );
}
