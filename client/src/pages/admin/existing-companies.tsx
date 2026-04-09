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
  Clock,
  FileText,
  User,
  AlertCircle,
} from "lucide-react";
import type { CompanyProfile } from "@shared/schema";

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_payment: "Pending Payment",
  pending_review: "Pending Review",
  documents_under_review: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_payment: "secondary",
  pending_review: "secondary",
  documents_under_review: "secondary",
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

// ── Document list ──────────────────────────────────────────────────────────────

interface ProfileDoc { docType: string; label: string; filePath?: string; uploadedAt?: string }

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminExistingCompaniesPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CompanyProfile | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

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

  const { data: detail, isLoading: detailLoading } = useQuery<CompanyProfile>({
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

  const reviewableStatuses = ["pending_review", "documents_under_review"];

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
                        <Button variant="ghost" size="sm" onClick={() => setSelected(p)} data-testid={`button-view-${p.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Detail Drawer / Dialog ── */}
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

                {/* KYB Result (admin only) */}
                {detail.smileKybResult && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Smile ID KYB Result</p>
                    {Object.entries(detail.smileKybResult as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span>
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* TIN Result */}
                {detail.smileTinResult && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TIN Verification Result</p>
                    {Object.entries(detail.smileTinResult as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span>
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Registered Address */}
                {detail.registeredAddress && (
                  <div>
                    <p className="text-sm font-medium mb-1">Registered Address</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        (detail.registeredAddress as any).line1,
                        (detail.registeredAddress as any).line2,
                        (detail.registeredAddress as any).city,
                        (detail.registeredAddress as any).state,
                      ].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}

                {/* Operating Address */}
                {detail.operatingAddress && (
                  <div>
                    <p className="text-sm font-medium mb-1">Operating Address</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        (detail.operatingAddress as any).line1,
                        (detail.operatingAddress as any).line2,
                        (detail.operatingAddress as any).city,
                        (detail.operatingAddress as any).state,
                      ].filter(Boolean).join(", ")}
                    </p>
                  </div>
                )}

                {/* Directors */}
                {Array.isArray(detail.directors) && detail.directors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Directors / Officers</p>
                    <div className="space-y-2">
                      {(detail.directors as { name: string; role?: string; email?: string }[]).map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{d.name}</span>
                          {d.role && <Badge variant="outline" className="text-xs">{d.role}</Badge>}
                          {d.email && <span className="text-muted-foreground text-xs">{d.email}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploaded Documents */}
                {Array.isArray(detail.profileDocuments) && detail.profileDocuments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Uploaded Documents</p>
                    <div className="space-y-1.5">
                      {(detail.profileDocuments as ProfileDoc[]).map(doc => (
                        <div key={doc.docType} className="flex items-center gap-2 text-sm">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{doc.label}</span>
                          <Badge variant="secondary" className="text-xs ml-auto">Uploaded</Badge>
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
            {reviewableStatuses.includes(selected.existingCompanyStatus || "") && (
              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="destructive"
                  onClick={() => { setShowRejectDialog(true); }}
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
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

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
    </DashboardLayout>
  );
}
