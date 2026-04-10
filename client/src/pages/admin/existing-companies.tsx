import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  User,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Send,
  Trash2,
} from "lucide-react";
import type { CompanyProfile, ProfileChecklistItem } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddressRecord { line1?: string; line2?: string; city?: string; state?: string }
interface DirectorRecord {
  name: string;
  role?: string;
  email?: string;
  bvn?: string;
  nin?: string;
  bvnVerified?: boolean;
  ninVerified?: boolean;
  amlIsHit?: boolean;
  amlHitTypes?: string[];
  biometricStatus?: 'pending_selfie' | 'completed' | 'failed';
}
interface DirectorVerificationEntry {
  name: string;
  bvnPassed?: boolean;
  ninPassed?: boolean;
  amlClear?: boolean;
  amlStatus?: 'clear' | 'hit' | 'error' | 'pending';
  amlCheckError?: string;
  amlHitTypes?: string[];
}
interface VerificationReport {
  kybPassed?: boolean;
  kybResultText?: string;
  kybFailReason?: string;
  kybDirectorMismatches?: string[];
  kybSubmitted?: { rcNumber?: string; companyName?: string };
  kybMatched?: { registryName?: string; status?: string; type?: string; rcNumber?: string; registrationDate?: string };
  tinPassed?: boolean;
  tinResultText?: string;
  tinFailReason?: string;
  tinSubmitted?: { tinNumber?: string };
  tinMatched?: { found?: boolean; registryName?: string; status?: string };
  directorsReport?: DirectorVerificationEntry[];
  autoApproved?: boolean;
  completedAt?: string;
}
interface CompanyProfileDetail extends Omit<CompanyProfile, 'verificationReport'> {
  checklistItems?: ProfileChecklistItem[];
  verificationReport?: VerificationReport | null;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_payment: "Pending Payment",
  pending_review: "Pending Review",
  documents_under_review: "Under Review",
  under_review: "Auto-Flagged for Review",
  verified: "Verified",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_payment: "secondary",
  pending_review: "secondary",
  documents_under_review: "secondary",
  under_review: "destructive",
  verified: "default",
  rejected: "destructive",
};

function StatusBadgeLocal({ status }: { status: string | null }) {
  const label = STATUS_LABELS[status || ""] || status || "—";
  const variant = STATUS_VARIANTS[status || ""] || "outline";
  return (
    <Badge variant={variant} className={status === "verified" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : ""}>
      {label}
    </Badge>
  );
}

const DOC_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  missing: "outline",
  provided: "secondary",
  accepted: "default",
  rejected: "destructive",
};

function DocStatusBadge({ status }: { status: string | null }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Missing";
  const variant = DOC_STATUS_VARIANTS[status || "missing"] || "outline";
  return (
    <Badge variant={variant} className={status === "accepted" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs" : "text-xs"}>
      {label}
    </Badge>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface BankPartner { id: number; name: string; }

export default function AdminExistingCompaniesPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CompanyProfile | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [selectedBankPartnerId, setSelectedBankPartnerId] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyProfile | null>(null);
  const [docReviewItemId, setDocReviewItemId] = useState<number | null>(null);
  const [docReviewNotes, setDocReviewNotes] = useState("");

  const { data: bankPartners = [] } = useQuery<BankPartner[]>({
    queryKey: ["/api/admin/banking-partners"],
  });

  const queryKey = statusFilter === "all"
    ? ["/api/admin/existing-companies"]
    : ["/api/admin/existing-companies", statusFilter];

  const { data: profiles, isLoading } = useQuery<CompanyProfile[]>({
    queryKey,
    queryFn: async () => {
      const url = statusFilter === "all"
        ? "/api/admin/existing-companies"
        : `/api/admin/existing-companies?status=${statusFilter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery<CompanyProfileDetail>({
    queryKey: ["/api/admin/existing-companies", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const res = await fetch(`/api/admin/existing-companies/${selected!.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const res = await apiRequest("POST", `/api/admin/existing-companies/${id}/approve`, { notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Company approved", description: "The company has been marked as verified." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/existing-companies"] });
      setShowApproveDialog(false);
      setSelected(null);
      setApproveNotes("");
    },
    onError: () => toast({ title: "Error", description: "Failed to approve.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: number; reason: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/admin/existing-companies/${id}/reject`, { reason, notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Company rejected", description: "The founder will be notified by email." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/existing-companies"] });
      setShowRejectDialog(false);
      setSelected(null);
      setRejectReason("");
      setRejectNotes("");
    },
    onError: () => toast({ title: "Error", description: "Failed to reject.", variant: "destructive" }),
  });

  const docReviewMutation = useMutation({
    mutationFn: async ({ profileId, itemId, status, reviewerNotes }: { profileId: number; itemId: number; status: string; reviewerNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/existing-companies/${profileId}/checklist-items/${itemId}`, { status, reviewerNotes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/existing-companies", selected?.id] });
      setDocReviewItemId(null);
      setDocReviewNotes("");
    },
    onError: () => toast({ title: "Error", description: "Failed to update document status.", variant: "destructive" }),
  });

  const dispatchMutation = useMutation({
    mutationFn: async ({ companyProfileId, bankPartnerId }: { companyProfileId: number; bankPartnerId: number }) => {
      const res = await apiRequest("POST", "/api/admin/bank-dispatches", { companyProfileId, bankPartnerId });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to dispatch dossier");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dossier dispatched", description: "The bank has been emailed the company dossier and given portal access." });
      setShowDispatchDialog(false);
      setSelectedBankPartnerId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-dispatches"] });
    },
    onError: (e: Error) => toast({ title: "Dispatch failed", description: e.message, variant: "destructive" }),
  });

  const { data: bankPreview, isLoading: bankPreviewLoading } = useQuery<{
    companyName: string; rcNumber?: string; companyType?: string; existingCompanyStatus?: string;
    directorCount: number; verifiedDirectors: number; checklistTotal: number; checklistSubmitted: number; kybStatus: string;
  }>({
    queryKey: ["/api/admin/company-profiles", selected?.id, "bank-preview"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/company-profiles/${selected!.id}/bank-preview`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch preview");
      return res.json();
    },
    enabled: showDispatchDialog && !!selected?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/existing-companies/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile deleted", description: "The company profile has been permanently removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/existing-companies"] });
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setSelected(null);
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const reviewableStatuses = ["pending_review", "documents_under_review", "under_review"];

  const formatAddress = (addr: AddressRecord | null | undefined): string => {
    if (!addr) return "—";
    return [addr.line1, addr.line2, addr.city, addr.state].filter(Boolean).join(", ") || "—";
  };

  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Existing Companies" }]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Existing Company Verifications</h1>
            <p className="text-muted-foreground text-sm">Review and verify existing company profiles submitted by founders.</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="under_review">Auto-Flagged for Review</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="documents_under_review">Under Review</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending_payment">Pending Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : !profiles?.length ? (
              <EmptyState icon={Building2} title="No companies found" description="No existing company profiles match the selected filter." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>RC Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(p => (
                    <TableRow key={p.id} data-testid={`row-company-${p.id}`}>
                      <TableCell className="font-medium">{p.companyName}</TableCell>
                      <TableCell className="text-muted-foreground">{p.rcNumber || "—"}</TableCell>
                      <TableCell>{p.companyType || "—"}</TableCell>
                      <TableCell><StatusBadgeLocal status={p.existingCompanyStatus} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-GB") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {p.existingCompanyStatus === 'under_review' && (p as CompanyProfile & { verificationReport?: unknown }).verificationReport && (
                            <Button variant="ghost" size="sm" className="text-amber-700 dark:text-amber-400" onClick={() => setSelected(p)} data-testid={`button-report-${p.id}`}>
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Verification Report
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setSelected(p)} data-testid={`button-view-${p.id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Review
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setDeleteTarget(p); setShowDeleteConfirm(true); }}
                            data-testid={`button-delete-${p.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Detail Dialog ── */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {selected.companyName}
              </DialogTitle>
              <DialogDescription>
                RC {selected.rcNumber || "—"} · <StatusBadgeLocal status={selected.existingCompanyStatus} />
              </DialogDescription>
            </DialogHeader>

            {detailLoading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : detail ? (
              <div className="space-y-5">
                {/* Company Details */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Company Type</span><span>{detail.companyType || "—"}</span>
                  <span className="text-muted-foreground">TIN</span><span>{detail.tinNumber || "—"}</span>
                  <span className="text-muted-foreground">Share Capital</span><span>{detail.shareCapital || "—"}</span>
                  <span className="text-muted-foreground">Incorporation Date</span>
                  <span>{detail.incorporationDate ? new Date(detail.incorporationDate).toLocaleDateString("en-GB") : "—"}</span>
                </div>

                {/* Automated Verification Report — shown when pipeline has run */}
                {detail.verificationReport && (
                  <div className={`rounded-lg border p-3 space-y-3 ${(detail.verificationReport as VerificationReport).autoApproved ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automated Verification Report</p>
                      {(detail.verificationReport as VerificationReport).autoApproved
                        ? <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">All Checks Passed</Badge>
                        : <Badge variant="destructive" className="text-xs">Manual Review Required</Badge>
                      }
                    </div>

                    {/* KYB check — submitted vs matched */}
                    {(() => {
                      const vr = detail.verificationReport as VerificationReport;
                      return (
                        <div className="rounded border bg-background p-2.5 space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {vr.kybPassed
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                              : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            <span className="font-semibold">CAC KYB:</span>
                            <span className="text-muted-foreground">{vr.kybResultText || (vr.kybPassed ? "Passed" : "Failed")}</span>
                            {!vr.kybPassed && vr.kybFailReason && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono">{vr.kybFailReason}</span>
                            )}
                          </div>
                          {vr.kybDirectorMismatches && vr.kybDirectorMismatches.length > 0 && (
                            <p className="ml-5 text-xs text-destructive">Directors not in CAC: {vr.kybDirectorMismatches.join(', ')}</p>
                          )}
                          {(vr.kybSubmitted || vr.kybMatched) && (
                            <div className="grid grid-cols-2 gap-2 ml-5 text-xs text-muted-foreground">
                              {vr.kybSubmitted && (
                                <div>
                                  <p className="font-medium text-foreground/70 mb-0.5">Submitted</p>
                                  {vr.kybSubmitted.rcNumber && <p>RC: {vr.kybSubmitted.rcNumber}</p>}
                                  {vr.kybSubmitted.companyName && <p>Name: {vr.kybSubmitted.companyName}</p>}
                                </div>
                              )}
                              {vr.kybMatched && (
                                <div>
                                  <p className="font-medium text-foreground/70 mb-0.5">Registry Match</p>
                                  {vr.kybMatched.registryName && <p>Name: {vr.kybMatched.registryName}</p>}
                                  {vr.kybMatched.type && <p>Type: {vr.kybMatched.type}</p>}
                                  {vr.kybMatched.status && <p>Status: {vr.kybMatched.status}</p>}
                                  {vr.kybMatched.registrationDate && <p>Reg. Date: {vr.kybMatched.registrationDate}</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* TIN check — submitted vs matched */}
                    {(() => {
                      const vr = detail.verificationReport as VerificationReport;
                      return (
                        <div className="rounded border bg-background p-2.5 space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {vr.tinPassed
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                              : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            <span className="font-semibold">TIN / FIRS:</span>
                            <span className="text-muted-foreground">{vr.tinResultText || (vr.tinPassed ? "Passed" : "Failed")}</span>
                            {!vr.tinPassed && vr.tinFailReason && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono">{vr.tinFailReason}</span>
                            )}
                          </div>
                          {(vr.tinSubmitted || vr.tinMatched) && (
                            <div className="grid grid-cols-2 gap-2 ml-5 text-xs text-muted-foreground">
                              {vr.tinSubmitted && (
                                <div>
                                  <p className="font-medium text-foreground/70 mb-0.5">Submitted</p>
                                  {vr.tinSubmitted.tinNumber && <p>TIN: {vr.tinSubmitted.tinNumber}</p>}
                                </div>
                              )}
                              {vr.tinMatched && (
                                <div>
                                  <p className="font-medium text-foreground/70 mb-0.5">FIRS Match</p>
                                  {vr.tinMatched.registryName && <p>Name: {vr.tinMatched.registryName}</p>}
                                  {vr.tinMatched.status && <p>Status: {vr.tinMatched.status}</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Per-director results */}
                    {(detail.verificationReport as VerificationReport).directorsReport && (detail.verificationReport as VerificationReport).directorsReport!.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Director Checks</p>
                        {(detail.verificationReport as VerificationReport).directorsReport!.map((dr, i) => (
                          <div key={i} className="rounded-md border bg-background p-2 space-y-1">
                            <p className="text-xs font-medium">{dr.name}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {dr.bvnPassed !== undefined && (
                                <Badge variant={dr.bvnPassed ? "secondary" : "destructive"} className="text-xs">
                                  BVN: {dr.bvnPassed ? "Passed" : "Failed"}
                                </Badge>
                              )}
                              {dr.ninPassed !== undefined && (
                                <Badge variant={dr.ninPassed ? "secondary" : "destructive"} className="text-xs">
                                  NIN: {dr.ninPassed ? "Passed" : "Failed"}
                                </Badge>
                              )}
                              {(dr.amlClear !== undefined || dr.amlStatus) && (() => {
                                const status = dr.amlStatus || (dr.amlClear ? 'clear' : 'hit');
                                const variant = status === 'clear' ? 'secondary' : status === 'error' || status === 'hit' ? 'destructive' : 'outline';
                                const label = status === 'clear' ? 'AML Clear' : status === 'hit' ? `AML Hit — ${dr.amlHitTypes?.join(", ") || "Review"}` : status === 'error' ? `AML Error` : 'AML Pending';
                                return (
                                  <div className="space-y-0.5">
                                    <Badge variant={variant} className="text-xs">{label}</Badge>
                                    {(status === 'error') && dr.amlCheckError && (
                                      <p className="text-[10px] text-muted-foreground ml-0.5">{dr.amlCheckError}</p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(detail.verificationReport as VerificationReport).completedAt && (
                      <p className="text-xs text-muted-foreground">
                        Pipeline completed: {new Date((detail.verificationReport as VerificationReport).completedAt!).toLocaleString("en-GB")}
                      </p>
                    )}
                  </div>
                )}

                {/* KYB Result (admin raw data) */}
                {detail.smileKybResult && (
                  <details className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <summary className="text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none">Raw KYB Data (Smile ID)</summary>
                    <div className="mt-2 space-y-1">
                      {Object.entries(detail.smileKybResult as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span>
                          <span>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* TIN Result */}
                {detail.smileTinResult && (
                  <details className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <summary className="text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none">Raw TIN Data (Smile ID)</summary>
                    <div className="mt-2 space-y-1">
                      {Object.entries(detail.smileTinResult as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span>
                          <span>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Addresses */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Registered Address</p>
                    <p className="text-sm text-muted-foreground">{formatAddress(detail.registeredAddress as AddressRecord)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Operating Address</p>
                    <p className="text-sm text-muted-foreground">{formatAddress(detail.operatingAddress as AddressRecord)}</p>
                  </div>
                </div>

                {/* Directors */}
                {Array.isArray(detail.directors) && detail.directors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Directors / Officers</p>
                    <div className="space-y-2">
                      {(detail.directors as DirectorRecord[]).map((d, i) => (
                        <div key={i} className="rounded-md border p-2.5 space-y-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{d.name}</span>
                            {d.role && <Badge variant="outline" className="text-xs">{d.role}</Badge>}
                            {d.email && <span className="text-muted-foreground text-xs">{d.email}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {d.bvn && (
                              <Badge variant={d.bvnVerified === true ? "secondary" : d.bvnVerified === false ? "destructive" : "outline"} className="text-xs">
                                BVN: {d.bvnVerified === true ? "Verified" : d.bvnVerified === false ? "Failed" : "Pending"}
                              </Badge>
                            )}
                            {d.nin && (
                              <Badge variant={d.ninVerified === true ? "secondary" : d.ninVerified === false ? "destructive" : "outline"} className="text-xs">
                                NIN: {d.ninVerified === true ? "Verified" : d.ninVerified === false ? "Failed" : "Pending"}
                              </Badge>
                            )}
                            {d.amlIsHit === true && (
                              <Badge variant="destructive" className="text-xs">
                                AML Hit: {d.amlHitTypes?.join(", ") || "Review Required"}
                              </Badge>
                            )}
                            {d.amlIsHit === false && (
                              <Badge variant="secondary" className="text-xs">AML Clear</Badge>
                            )}
                            {d.amlIsHit === undefined && (d.bvn || d.nin) && (
                              <Badge variant="outline" className="text-xs">AML Pending</Badge>
                            )}
                            {d.biometricStatus === 'completed' && (
                              <Badge variant="secondary" className="text-xs">Biometric Done</Badge>
                            )}
                            {d.biometricStatus === 'pending_selfie' && (
                              <Badge variant="outline" className="text-xs">Biometric: Awaiting Selfie</Badge>
                            )}
                            {d.biometricStatus === 'failed' && (
                              <Badge variant="destructive" className="text-xs">Biometric Failed</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Document Checklist — per-doc accept/reject */}
                {Array.isArray(detail.checklistItems) && detail.checklistItems.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Document Checklist</p>
                    <div className="space-y-2">
                      {detail.checklistItems.map(item => (
                        <div key={item.id} className={`rounded-lg border p-3 space-y-2 ${item.status === "accepted" ? "border-green-500/40 bg-green-500/5" : item.status === "rejected" ? "border-destructive/40 bg-destructive/5" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate">{item.label}</span>
                              {item.required && <span className="text-red-500 text-xs">*</span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <DocStatusBadge status={item.status} />
                              {item.filePath && item.status === "provided" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-green-600 hover:text-green-700"
                                    onClick={() => docReviewMutation.mutate({ profileId: detail.id, itemId: item.id, status: "accepted" })}
                                    disabled={docReviewMutation.isPending}
                                    data-testid={`button-accept-doc-${item.id}`}
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-destructive hover:text-destructive"
                                    onClick={() => setDocReviewItemId(item.id)}
                                    disabled={docReviewMutation.isPending}
                                    data-testid={`button-reject-doc-${item.id}`}
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {item.status === "accepted" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-muted-foreground"
                                  onClick={() => docReviewMutation.mutate({ profileId: detail.id, itemId: item.id, status: "provided" })}
                                  disabled={docReviewMutation.isPending}
                                  data-testid={`button-undo-accept-doc-${item.id}`}
                                >
                                  Undo
                                </Button>
                              )}
                            </div>
                          </div>
                          {item.reviewerNotes && (
                            <p className="text-xs text-muted-foreground pl-5">{item.reviewerNotes}</p>
                          )}
                          {docReviewItemId === item.id && (
                            <div className="space-y-2 pl-5">
                              <Textarea
                                value={docReviewNotes}
                                onChange={e => setDocReviewNotes(e.target.value)}
                                placeholder="Reason for rejection (shown to founder)…"
                                rows={2}
                                className="text-sm"
                                data-testid={`input-doc-reject-notes-${item.id}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => docReviewMutation.mutate({ profileId: detail.id, itemId: item.id, status: "rejected", reviewerNotes: docReviewNotes || undefined })}
                                  disabled={docReviewMutation.isPending}
                                  data-testid={`button-confirm-reject-doc-${item.id}`}
                                >
                                  Confirm Rejection
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setDocReviewItemId(null); setDocReviewNotes(""); }}>Cancel</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection Reason */}
                {detail.rejectionReason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{detail.rejectionReason}</p>
                  </div>
                )}

                {/* Admin Notes */}
                {detail.adminReviewNotes && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Notes</p>
                    <p className="text-sm mt-1">{detail.adminReviewNotes}</p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Actions */}
            <DialogFooter className="gap-2 pt-2 flex-wrap">
              {bankPartners.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => { setSelectedBankPartnerId(""); setShowDispatchDialog(true); }}
                  disabled={dispatchMutation.isPending}
                  data-testid="button-send-to-bank"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Send to Bank
                </Button>
              )}
              {reviewableStatuses.includes(selected.existingCompanyStatus || "") && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    data-testid="button-reject-company"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => setShowApproveDialog(true)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    data-testid="button-approve-company"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Approve & Verify
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Send to Bank Dialog ── */}
      <Dialog open={showDispatchDialog} onOpenChange={setShowDispatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Bank</DialogTitle>
            <DialogDescription>
              Review the dossier summary before emailing it to a bank partner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Dossier preview block */}
            {bankPreviewLoading ? (
              <div className="flex items-center justify-center py-3">
                <Eye className="h-4 w-4 animate-pulse text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading dossier summary…</span>
              </div>
            ) : bankPreview ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm" data-testid="block-dossier-preview">
                <p className="font-semibold text-base">{bankPreview.companyName}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>RC Number</span><span className="text-foreground">{bankPreview.rcNumber || "—"}</span>
                  <span>Type</span><span className="text-foreground">{bankPreview.companyType || "—"}</span>
                  <span>KYB Status</span><span className={`font-medium ${bankPreview.kybStatus === "VERIFIED" ? "text-green-600" : "text-amber-600"}`}>{bankPreview.kybStatus}</span>
                  <span>Verification</span><span className={`font-medium ${bankPreview.existingCompanyStatus === "verified" ? "text-green-600" : "text-amber-600"}`}>{(bankPreview.existingCompanyStatus || "").toUpperCase().replace(/_/g, " ") || "—"}</span>
                  <span>Directors</span><span className="text-foreground">{bankPreview.directorCount} ({bankPreview.verifiedDirectors} verified)</span>
                  <span>Documents</span><span className="text-foreground">{bankPreview.checklistSubmitted}/{bankPreview.checklistTotal} submitted</span>
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Select bank partner</Label>
              <Select value={selectedBankPartnerId} onValueChange={setSelectedBankPartnerId}>
                <SelectTrigger data-testid="select-bank-partner">
                  <SelectValue placeholder="Choose a bank…" />
                </SelectTrigger>
                <SelectContent>
                  {bankPartners.map(bp => (
                    <SelectItem key={bp.id} value={String(bp.id)}>{bp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The dossier will be emailed to all registered email addresses for the selected bank partner.
                Bank staff will also be able to view it in the bank portal.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispatchDialog(false)}>Cancel</Button>
            <Button
              onClick={() => selected && selectedBankPartnerId && dispatchMutation.mutate({
                companyProfileId: selected.id,
                bankPartnerId: parseInt(selectedBankPartnerId),
              })}
              disabled={dispatchMutation.isPending || !selectedBankPartnerId}
              data-testid="button-confirm-dispatch"
            >
              {dispatchMutation.isPending ? "Dispatching…" : <>
                <Send className="h-4 w-4 mr-1.5" />
                Dispatch Dossier
              </>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Approve Dialog ── */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Company</DialogTitle>
            <DialogDescription>
              Approving will mark this company as Verified and notify the founder via email. Post-incorporation services will unlock immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Internal notes (optional)</Label>
            <Textarea
              value={approveNotes}
              onChange={e => setApproveNotes(e.target.value)}
              placeholder="Any notes about the review…"
              rows={3}
              data-testid="input-approve-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button
              onClick={() => approveMutation.mutate({ id: selected!.id, notes: approveNotes || undefined })}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving…" : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Company</DialogTitle>
            <DialogDescription>
              The founder will be notified by email with the rejection reason and asked to re-submit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection reason (shown to founder) *</Label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. The uploaded CAC Status Report is outdated. Please provide a report dated within the last 6 months."
                rows={3}
                data-testid="input-reject-reason"
              />
            </div>
            <div>
              <Label>Internal notes (not shown to founder)</Label>
              <Textarea
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="Any internal notes…"
                rows={2}
                data-testid="input-reject-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ id: selected!.id, reason: rejectReason, notes: rejectNotes || undefined })}
              disabled={rejectMutation.isPending || rejectReason.trim().length < 10}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting…" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={open => { if (!open) { setShowDeleteConfirm(false); setDeleteTarget(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete Company Profile
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the profile for <strong>{deleteTarget?.companyName}</strong> (RC {deleteTarget?.rcNumber || "—"}).
              All associated checklist items and director verification records will also be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
