import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useRoute } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileSignature,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  ThumbsUp,
  ThumbsDown,
  Shield,
  Receipt,
  ArrowLeft,
  Info,
  CircleDot,
  Building2,
  Calendar,
  DollarSign,
  Plus,
} from "lucide-react";

interface Milestone {
  id: number;
  contractId: number;
  title: string;
  description?: string;
  amount: number;
  dueDate?: string;
  status: string;
  evidence?: any;
  sortOrder: number;
  createdAt?: string;
}

interface ContractDetail {
  id: number;
  contractNumber: string;
  rfqId: number;
  bidId: number;
  buyerOrgId: number;
  supplierOrgId: number;
  totalAmount: number;
  currency: string;
  status: string;
  terms?: string;
  awardedByUserId?: string;
  awardedAt?: string;
  completedAt?: string;
  createdAt?: string;
  milestones: Milestone[];
  buyerOrgName?: string;
  supplierOrgName?: string;
  userRole?: string;
}

interface EscrowData {
  enabled: boolean;
  transactions: any[];
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  awarded: { label: "Awarded", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: FileSignature },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  delivered: { label: "Delivered", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: CheckCircle2 },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", icon: Clock },
};

const milestoneStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function formatAmount(amount: number, currency: string = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount / 100);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default function ContractDetailPage() {
  const [, navigate] = useLocation();
  const [matched, params] = useRoute("/procurement/contracts/:id");
  const contractId = params?.id;
  const { toast } = useToast();

  const [evidenceDialog, setEvidenceDialog] = useState<{ open: boolean; milestoneId: number | null }>({ open: false, milestoneId: null });
  const [evidenceText, setEvidenceText] = useState("");
  const [addMilestoneDialog, setAddMilestoneDialog] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", amount: "", dueDate: "" });
  const [disputeDialog, setDisputeDialog] = useState<{ open: boolean; escrowId: number | null }>({ open: false, escrowId: null });
  const [disputeReason, setDisputeReason] = useState("");

  const { data: contract, isLoading } = useQuery<ContractDetail>({
    queryKey: ["/api/procurement/contracts", contractId],
    enabled: !!contractId,
  });

  const { data: escrowData } = useQuery<EscrowData>({
    queryKey: ["/api/procurement/contracts", contractId, "escrow"],
    enabled: !!contractId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/procurement/contracts/${contractId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/contracts", contractId] });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/contracts"] });
      toast({ title: "Contract status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/procurement/contracts/${contractId}/milestones/${milestoneId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/contracts", contractId] });
      toast({ title: "Milestone updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update milestone", description: error.message, variant: "destructive" });
    },
  });

  const addMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/procurement/contracts/${contractId}/milestones`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/contracts", contractId] });
      setAddMilestoneDialog(false);
      setNewMilestone({ title: "", description: "", amount: "", dueDate: "" });
      toast({ title: "Milestone added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add milestone", description: error.message, variant: "destructive" });
    },
  });

  const fundEscrowMutation = useMutation({
    mutationFn: async ({ amount, milestoneId }: { amount: number; milestoneId?: number }) => {
      const res = await apiRequest("POST", `/api/procurement/contracts/${contractId}/escrow/fund`, { amount, milestoneId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to initialize payment");
      return data;
    },
    onSuccess: (data) => {
      if (data.paystackPaymentUrl) {
        window.location.href = data.paystackPaymentUrl;
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/procurement/contracts", contractId, "escrow"] });
        toast({ title: "Escrow created", description: "Fund the escrow to hold the payment securely." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to fund escrow", description: error.message, variant: "destructive" });
    },
  });

  const releaseEscrowMutation = useMutation({
    mutationFn: async (escrowId: number) => {
      const res = await apiRequest("POST", `/api/procurement/contracts/${contractId}/escrow/release`, { escrowId });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Release failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/contracts", contractId, "escrow"] });
      toast({ title: "Escrow released", description: "Funds have been released to the supplier." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to release", description: error.message, variant: "destructive" });
    },
  });

  const disputeEscrowMutation = useMutation({
    mutationFn: async ({ escrowId, reason }: { escrowId: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/procurement/contracts/${contractId}/escrow/dispute`, { escrowId, reason });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Dispute failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/contracts", contractId, "escrow"] });
      toast({ title: "Dispute raised", description: "Our team will review your dispute within 2 business days." });
      setDisputeDialog({ open: false, escrowId: null });
      setDisputeReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to raise dispute", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement", href: "/procurement/marketplace" }, { label: "Contracts", href: "/procurement/contracts" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!contract) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement", href: "/procurement/marketplace" }, { label: "Contracts", href: "/procurement/contracts" }, { label: "Not Found" }]}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileSignature className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Contract not found</h2>
          <Button variant="outline" asChild data-testid="button-back-contracts">
            <Link href="/procurement/contracts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contracts
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isBuyer = contract.userRole === "buyer";
  const isSupplier = contract.userRole === "supplier";
  const milestones = contract.milestones || [];
  const approvedMilestones = milestones.filter((m) => m.status === "approved").length;
  const progressPercent = milestones.length > 0 ? Math.round((approvedMilestones / milestones.length) * 100) : 0;
  const sConfig = statusConfig[contract.status] || statusConfig.awarded;

  function handleSubmitEvidence() {
    if (!evidenceDialog.milestoneId || !evidenceText.trim()) return;
    updateMilestoneMutation.mutate({
      milestoneId: evidenceDialog.milestoneId,
      data: { status: "submitted", evidence: { description: evidenceText } },
    });
    setEvidenceDialog({ open: false, milestoneId: null });
    setEvidenceText("");
  }

  function handleAddMilestone() {
    if (!newMilestone.title || !newMilestone.amount) return;
    addMilestoneMutation.mutate({
      title: newMilestone.title,
      description: newMilestone.description || undefined,
      amount: Math.round(parseFloat(newMilestone.amount) * 100),
      dueDate: newMilestone.dueDate || undefined,
    });
  }

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "Procurement", href: "/procurement/marketplace" },
        { label: "Contracts", href: "/procurement/contracts" },
        { label: contract.contractNumber },
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild data-testid="button-back">
            <Link href="/procurement/contracts">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl" data-testid="text-contract-number">{contract.contractNumber}</CardTitle>
                <CardDescription>Contract Details</CardDescription>
              </div>
              <Badge variant="secondary" className={`font-medium border-0 ${sConfig.className}`} data-testid="badge-contract-status">
                {sConfig.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Buyer</p>
                  <p className="text-sm font-medium" data-testid="text-buyer-org">{contract.buyerOrgName || `Org #${contract.buyerOrgId}`}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p className="text-sm font-medium" data-testid="text-supplier-org">{contract.supplierOrgName || `Org #${contract.supplierOrgId}`}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-sm font-medium" data-testid="text-total-amount">{formatAmount(contract.totalAmount, contract.currency)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Awarded</p>
                  <p className="text-sm font-medium" data-testid="text-awarded-date">{formatDate(contract.awardedAt)}</p>
                </div>
              </div>
            </div>

            {(isBuyer || isSupplier) && contract.status !== "completed" && contract.status !== "cancelled" && (
              <>
                <Separator className="my-4" />
                <div className="flex flex-wrap items-center gap-3">
                  {isBuyer && (contract.status === "delivered" || contract.status === "in_progress") && (
                    <Button
                      onClick={() => updateStatusMutation.mutate("completed")}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-complete-contract"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                  {contract.status !== "disputed" && (
                    <Button
                      variant="destructive"
                      onClick={() => updateStatusMutation.mutate("disputed")}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-dispute-contract"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Raise Dispute
                    </Button>
                  )}
                  <Button variant="outline" asChild data-testid="button-view-invoices">
                    <Link href={`/procurement/invoices`}>
                      <Receipt className="h-4 w-4 mr-2" />
                      View Invoices
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Milestones</CardTitle>
                <CardDescription>
                  {approvedMilestones} of {milestones.length} completed
                </CardDescription>
              </div>
              {isBuyer && contract.status !== "completed" && contract.status !== "cancelled" && (
                <Button variant="outline" size="sm" onClick={() => setAddMilestoneDialog(true)} data-testid="button-add-milestone">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Milestone
                </Button>
              )}
            </div>
            <Progress value={progressPercent} className="mt-2" data-testid="progress-milestones" />
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-milestones">No milestones defined</p>
            ) : (
              <div className="space-y-4">
                {milestones
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((milestone, index) => {
                    const mConfig = milestoneStatusConfig[milestone.status] || milestoneStatusConfig.pending;
                    return (
                      <div
                        key={milestone.id}
                        className="flex items-start gap-4 p-4 rounded-md border"
                        data-testid={`milestone-${milestone.id}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`rounded-full p-1.5 ${
                              milestone.status === "approved"
                                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                : milestone.status === "submitted"
                                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {milestone.status === "approved" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <CircleDot className="h-4 w-4" />
                            )}
                          </div>
                          {index < milestones.length - 1 && (
                            <div className="w-px h-8 bg-border" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm" data-testid={`text-milestone-title-${milestone.id}`}>
                                {milestone.title}
                              </p>
                              {milestone.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className={`font-medium border-0 ${mConfig.className}`} data-testid={`badge-milestone-status-${milestone.id}`}>
                              {mConfig.label}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span data-testid={`text-milestone-amount-${milestone.id}`}>
                              {formatAmount(milestone.amount, contract.currency)}
                            </span>
                            {milestone.dueDate && (
                              <span data-testid={`text-milestone-due-${milestone.id}`}>
                                Due: {formatDate(milestone.dueDate)}
                              </span>
                            )}
                          </div>
                          {milestone.evidence && (
                            <div className="mt-2 p-2 rounded bg-muted text-xs">
                              <p className="font-medium">Evidence submitted</p>
                              {typeof milestone.evidence === "object" && milestone.evidence.description && (
                                <p className="text-muted-foreground mt-0.5">{milestone.evidence.description}</p>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            {isSupplier && (milestone.status === "pending" || milestone.status === "in_progress" || milestone.status === "rejected") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEvidenceDialog({ open: true, milestoneId: milestone.id });
                                  setEvidenceText("");
                                }}
                                data-testid={`button-upload-evidence-${milestone.id}`}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Submit Evidence
                              </Button>
                            )}
                            {isBuyer && milestone.status === "submitted" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateMilestoneMutation.mutate({
                                      milestoneId: milestone.id,
                                      data: { status: "approved" },
                                    })
                                  }
                                  disabled={updateMilestoneMutation.isPending}
                                  data-testid={`button-approve-milestone-${milestone.id}`}
                                >
                                  <ThumbsUp className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    updateMilestoneMutation.mutate({
                                      milestoneId: milestone.id,
                                      data: { status: "rejected" },
                                    })
                                  }
                                  disabled={updateMilestoneMutation.isPending}
                                  data-testid={`button-reject-milestone-${milestone.id}`}
                                >
                                  <ThumbsDown className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Escrow Payments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {escrowData?.enabled ? (
              <div className="space-y-4">
                {escrowData.transactions && escrowData.transactions.length > 0 ? (
                  <div className="space-y-3">
                    {escrowData.transactions.map((tx: any, i: number) => {
                      const statusColors: Record<string, string> = {
                        pending: "bg-muted text-muted-foreground",
                        funded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                        released: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                        disputed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                        refunded: "bg-muted text-muted-foreground",
                      };
                      return (
                        <div key={tx.id || i} className="p-3 rounded-md border space-y-2" data-testid={`escrow-tx-${tx.id || i}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{formatAmount(tx.amount, tx.currency)}</p>
                            <Badge className={`border-0 ${statusColors[tx.status] || ""}`}>{tx.status}</Badge>
                          </div>
                          {tx.paystackPaymentUrl && tx.status === "pending" && (
                            <a
                              href={tx.paystackPaymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                              data-testid={`link-pay-escrow-${tx.id}`}
                            >
                              <Button size="sm" className="w-full" variant="default">
                                <DollarSign className="h-4 w-4 mr-1" />
                                Complete Payment via Paystack
                              </Button>
                            </a>
                          )}
                          {tx.fundedAt && (
                            <p className="text-xs text-muted-foreground">Funded: {new Date(tx.fundedAt).toLocaleDateString()}</p>
                          )}
                          {tx.status === "funded" && (isBuyer || isSupplier) && (
                            <div className="flex gap-2 flex-wrap">
                              {isBuyer && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => releaseEscrowMutation.mutate(tx.id)}
                                  disabled={releaseEscrowMutation.isPending}
                                  data-testid={`button-release-escrow-${tx.id}`}
                                >
                                  Release Funds
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDisputeDialog({ open: true, escrowId: tx.id })}
                                data-testid={`button-dispute-escrow-${tx.id}`}
                              >
                                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                Raise Dispute
                              </Button>
                            </div>
                          )}
                          {tx.disputeReason && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              Dispute: {tx.disputeReason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-escrow-transactions">No escrow transactions yet.</p>
                )}
                {isBuyer && contract.status !== "completed" && contract.status !== "cancelled" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      data-testid="button-fund-escrow"
                      disabled={fundEscrowMutation.isPending}
                      onClick={() => fundEscrowMutation.mutate({ amount: contract.totalAmount })}
                    >
                      {fundEscrowMutation.isPending ? (
                        <LoadingSpinner />
                      ) : (
                        <>
                          <DollarSign className="h-4 w-4 mr-1" />
                          Fund Full Contract Escrow
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-md bg-muted" data-testid="card-escrow-coming-soon">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Secure escrow payments coming soon</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Currently, payment arrangements are made directly between buyer and supplier.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={evidenceDialog.open} onOpenChange={(open) => setEvidenceDialog({ open, milestoneId: open ? evidenceDialog.milestoneId : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Evidence</DialogTitle>
            <DialogDescription>Provide evidence of milestone completion for buyer review.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Evidence Description</Label>
              <Textarea
                value={evidenceText}
                onChange={(e) => setEvidenceText(e.target.value)}
                placeholder="Describe the work completed, deliverables, etc."
                rows={4}
                data-testid="input-evidence-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceDialog({ open: false, milestoneId: null })} data-testid="button-cancel-evidence">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEvidence}
              disabled={!evidenceText.trim() || updateMilestoneMutation.isPending}
              data-testid="button-submit-evidence"
            >
              {updateMilestoneMutation.isPending ? "Submitting..." : "Submit Evidence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addMilestoneDialog} onOpenChange={setAddMilestoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
            <DialogDescription>Add a new milestone to this contract.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newMilestone.title}
                onChange={(e) => setNewMilestone((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Milestone title"
                data-testid="input-milestone-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newMilestone.description}
                onChange={(e) => setNewMilestone((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={3}
                data-testid="input-milestone-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (NGN)</Label>
              <Input
                type="number"
                step="0.01"
                value={newMilestone.amount}
                onChange={(e) => setNewMilestone((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-milestone-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newMilestone.dueDate}
                onChange={(e) => setNewMilestone((prev) => ({ ...prev, dueDate: e.target.value }))}
                data-testid="input-milestone-due-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMilestoneDialog(false)} data-testid="button-cancel-milestone">
              Cancel
            </Button>
            <Button
              onClick={handleAddMilestone}
              disabled={!newMilestone.title || !newMilestone.amount || addMilestoneMutation.isPending}
              data-testid="button-submit-milestone"
            >
              {addMilestoneMutation.isPending ? "Adding..." : "Add Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Escrow Dialog */}
      <Dialog
        open={disputeDialog.open}
        onOpenChange={(open) => setDisputeDialog({ open, escrowId: open ? disputeDialog.escrowId : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Escrow Dispute</DialogTitle>
            <DialogDescription>
              Describe the issue with this escrow transaction. Our team will review within 2 business days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason for dispute</Label>
            <Textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={4}
              data-testid="input-dispute-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialog({ open: false, escrowId: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disputeReason.trim().length < 10 || disputeEscrowMutation.isPending}
              onClick={() => {
                if (disputeDialog.escrowId && disputeReason.trim()) {
                  disputeEscrowMutation.mutate({ escrowId: disputeDialog.escrowId, reason: disputeReason.trim() });
                }
              }}
              data-testid="button-submit-dispute"
            >
              {disputeEscrowMutation.isPending ? "Submitting..." : "Submit Dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
