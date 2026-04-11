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
  FileText, User, MapPin, Send, AlertCircle, Users, ShieldCheck, UserCircle
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
  cellionCertRef?: string;
  dispatchedAt?: string;
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
  if (status === "submitted" || status === "approved") return "text-green-600";
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
      toast({ title: "Request submitted", description: "Your document request has been sent to Cellion One admins." });
      setDocRequestOpen(false);
      setDocumentsRequested("");
      setReason("");
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
  const requiredDocs = checklistItems.filter(c => c.required);
  const completedRequired = requiredDocs.filter(c => c.status === "submitted" || c.status === "approved");
  const complianceScore = requiredDocs.length > 0 ? Math.round((completedRequired.length / requiredDocs.length) * 100) : null;
  const kybPassed = company.smileKybResult && (company.smileKybResult as Record<string, unknown>).ResultCode === "1012";
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
          <CardContent>
            {shareholders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No shareholder information available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium">Name</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Shares</th>
                      <th className="text-right py-2 text-xs text-muted-foreground font-medium">Ownership</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareholders.map((s, i) => (
                      <tr key={i} className="border-b last:border-0" data-testid={`row-shareholder-${i}`}>
                        <td className="py-2 font-medium">{s.name}</td>
                        <td className="py-2 text-right text-muted-foreground">{s.shares != null ? s.shares.toLocaleString() : "—"}</td>
                        <td className="py-2 text-right">{s.percentage != null ? `${s.percentage.toFixed(2)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
          <CardContent>
            {directors.length === 0 ? (
              <p className="text-muted-foreground text-sm">No director information available.</p>
            ) : (
              <div className="space-y-4">
                {directors.map((d, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2" data-testid={`card-director-${i}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{d.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{d.role || "Director"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Identity</p>
                        <VerificationIcon
                          value={d.ninVerified === true || d.bvnVerified === true}
                          trueLabel={d.ninVerified ? "NIN Verified" : "BVN Verified"}
                          falseLabel="Not Verified"
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
