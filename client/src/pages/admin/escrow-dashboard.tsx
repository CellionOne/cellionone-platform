import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Building2,
  RefreshCw,
  Unlock,
  RotateCcw,
  Banknote,
  Link2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EscrowAdminData {
  procurement: any[];
  api: any[];
  activeBankPartner: { id: number; name: string; feeRateBps: number } | null;
  summary: {
    procurementTotal: number;
    apiTotal: number;
    totalFunded: number;
    totalDisputed: number;
    totalBankCustodyFees: number;
    bankPartnerName: string | null;
  };
}

function formatAmount(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount / 100);
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  pending_payment: { label: "Pending Payment", variant: "outline" },
  funded: { label: "Funded", variant: "default" },
  pending_transfer: { label: "Transfer In Progress", variant: "default" },
  released: { label: "Released", variant: "secondary" },
  disputed: { label: "Disputed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "secondary" },
  expired: { label: "Expired", variant: "outline" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant} data-testid={`badge-status-${status}`}>{cfg.label}</Badge>;
}

export default function AdminEscrowDashboard() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "release" | "refund";
    track: "api" | "procurement";
    id: number;
    ref: string;
  } | null>(null);

  const { data, isLoading, refetch } = useQuery<EscrowAdminData>({
    queryKey: ["/api/admin/escrow"],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ type, track, id }: { type: "release" | "refund"; track: "api" | "procurement"; id: number }) => {
      const res = await apiRequest("POST", `/api/admin/escrow/${track}/${id}/${type}`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/escrow"] });
      toast({ title: "Action completed", description: "Escrow status updated successfully." });
      setConfirmDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (items: any[]) =>
    statusFilter === "all" ? items : items.filter(t => t.status === statusFilter);

  if (isLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  const summary = data?.summary;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-escrow-dashboard">Escrow Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage all procurement and API escrow transactions
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-escrow">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Procurement</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-procurement-count">{summary?.procurementTotal ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">API Escrow</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-api-count">{summary?.apiTotal ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Total Funded</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-funded-count">{summary?.totalFunded ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Disputed</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-disputed-count">{summary?.totalDisputed ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Bank Custody Fees Card */}
        {(summary?.totalBankCustodyFees ?? 0) > 0 || data?.activeBankPartner ? (
          <Card className={data?.activeBankPartner ? "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/10" : ""}>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Banknote className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      {data?.activeBankPartner
                        ? `Active custody partner: ${data.activeBankPartner.name}`
                        : `Cumulative custody fees — ${summary?.bankPartnerName || "former partner"}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {data?.activeBankPartner
                        ? `Fee carve-out: ${(data.activeBankPartner.feeRateBps / 100).toFixed(2)}% of principal on all new transactions. Cellion retains the remainder of the 1.5% service fee.`
                        : "These fees are carved from Cellion's service fee. Buyers were not charged extra."}
                    </p>
                    {(summary?.totalBankCustodyFees ?? 0) > 0 && (
                      <p className="text-sm font-bold mt-1 text-blue-700 dark:text-blue-400" data-testid="text-total-custody-fees">
                        Total custody fees recorded: {formatAmount(summary!.totalBankCustodyFees)}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href="/admin/banking-partners"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
                  data-testid="link-manage-bank-partners"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Manage Partners
                </a>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter by status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_payment">Pending Payment</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="funded">Funded</SelectItem>
              <SelectItem value="released">Released</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="api">
          <TabsList>
            <TabsTrigger value="api" data-testid="tab-api-escrow">
              API Escrow ({data?.api?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="procurement" data-testid="tab-procurement-escrow">
              Procurement ({data?.procurement?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* API Escrow Tab */}
          <TabsContent value="api" className="mt-4">
            {filtered(data?.api ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground" data-testid="text-no-api-escrow">
                    No API escrow transactions{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered(data?.api ?? []).map((tx: any) => (
                  <Card key={tx.id} data-testid={`card-api-escrow-${tx.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded" data-testid={`text-ref-${tx.id}`}>
                              {tx.reference}
                            </code>
                            <StatusBadge status={tx.status} />
                          </div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-lg font-bold text-primary" data-testid={`text-amount-${tx.id}`}>
                            {formatAmount(tx.amount, tx.currency)}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                            <span>Buyer: <span className="text-foreground">{tx.buyerName}</span></span>
                            <span>Beneficiary: <span className="text-foreground">{tx.beneficiaryName}</span></span>
                            <span>Org ID: {tx.orgId}</span>
                            <span>Created: {formatDate(tx.createdAt)}</span>
                            {tx.fundedAt && <span>Funded: {formatDate(tx.fundedAt)}</span>}
                            {tx.serviceFee > 0 && (
                              <span>
                                Service fee: <span className="text-foreground">{formatAmount(tx.serviceFee, tx.currency)}</span>
                              </span>
                            )}
                            {tx.bankCustodyFee > 0 && (
                              <span className="text-blue-600 dark:text-blue-400" data-testid={`text-bank-fee-api-${tx.id}`}>
                                Bank custody cut: {formatAmount(tx.bankCustodyFee, tx.currency)}
                              </span>
                            )}
                            {tx.bankCustodyFee > 0 && tx.serviceFee > 0 && (
                              <span className="col-span-2 text-green-600 dark:text-green-400">
                                Cellion net: {formatAmount(tx.serviceFee - tx.bankCustodyFee, tx.currency)} of {formatAmount(tx.serviceFee, tx.currency)} fee
                              </span>
                            )}
                            {tx.dvaAccountNumber && (
                              <span className="col-span-2 font-mono text-blue-600 dark:text-blue-400" data-testid={`text-dva-${tx.id}`}>
                                DVA: {tx.dvaAccountNumber} · {tx.dvaBankName ?? "—"}
                              </span>
                            )}
                            {tx.beneficiaryAccountNumber && (
                              <span className="col-span-2 font-mono text-xs" data-testid={`text-bene-acct-${tx.id}`}>
                                Seller A/C: {tx.beneficiaryAccountNumber} ({tx.beneficiaryBankCode}) — {tx.beneficiaryAccountName ?? "unverified"}
                              </span>
                            )}
                            {tx.paystackTransferReference && (
                              <span className="col-span-2 font-mono text-xs" data-testid={`text-transfer-ref-${tx.id}`}>
                                Transfer: {tx.paystackTransferReference}
                              </span>
                            )}
                            {tx.disputeReason && (
                              <span className="col-span-2 text-yellow-600 dark:text-yellow-400">
                                Dispute: {tx.disputeReason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {["funded", "disputed"].includes(tx.status) && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setConfirmDialog({ open: true, type: "release", track: "api", id: tx.id, ref: tx.reference })}
                              disabled={actionMutation.isPending}
                              data-testid={`button-release-api-${tx.id}`}
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1" />
                              Release
                            </Button>
                          )}
                          {["funded", "disputed", "pending_payment"].includes(tx.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDialog({ open: true, type: "refund", track: "api", id: tx.id, ref: tx.reference })}
                              disabled={actionMutation.isPending}
                              data-testid={`button-refund-api-${tx.id}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Refund
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Procurement Escrow Tab */}
          <TabsContent value="procurement" className="mt-4">
            {filtered(data?.procurement ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground" data-testid="text-no-procurement-escrow">
                    No procurement escrow transactions{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered(data?.procurement ?? []).map((tx: any) => (
                  <Card key={tx.id} data-testid={`card-proc-escrow-${tx.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">Contract #{tx.contractId}</span>
                            {tx.milestoneId && (
                              <span className="text-xs text-muted-foreground">· Milestone #{tx.milestoneId}</span>
                            )}
                            <StatusBadge status={tx.status} />
                          </div>
                          <p className="text-lg font-bold text-primary">
                            {formatAmount(tx.amount, tx.currency)}
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                            <span>Buyer Org: {tx.buyerOrgId}</span>
                            <span>Supplier Org: {tx.supplierOrgId}</span>
                            <span>Created: {formatDate(tx.createdAt)}</span>
                            {tx.fundedAt && <span>Funded: {formatDate(tx.fundedAt)}</span>}
                            {tx.serviceFee > 0 && (
                              <span>
                                Service fee: <span className="text-foreground">{formatAmount(tx.serviceFee, tx.currency)}</span>
                              </span>
                            )}
                            {tx.bankCustodyFee > 0 && (
                              <span className="text-blue-600 dark:text-blue-400" data-testid={`text-bank-fee-proc-${tx.id}`}>
                                Bank custody cut: {formatAmount(tx.bankCustodyFee, tx.currency)}
                              </span>
                            )}
                            {tx.bankCustodyFee > 0 && tx.serviceFee > 0 && (
                              <span className="col-span-2 text-green-600 dark:text-green-400">
                                Cellion net: {formatAmount(tx.serviceFee - tx.bankCustodyFee, tx.currency)} of {formatAmount(tx.serviceFee, tx.currency)} fee
                              </span>
                            )}
                            {tx.paystackReference && (
                              <span className="col-span-2 font-mono">Ref: {tx.paystackReference}</span>
                            )}
                            {tx.disputeReason && (
                              <span className="col-span-2 text-yellow-600 dark:text-yellow-400">
                                Dispute: {tx.disputeReason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {["funded", "disputed"].includes(tx.status) && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setConfirmDialog({ open: true, type: "release", track: "procurement", id: tx.id, ref: `Contract #${tx.contractId}` })}
                              disabled={actionMutation.isPending}
                              data-testid={`button-release-proc-${tx.id}`}
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1" />
                              Release
                            </Button>
                          )}
                          {["funded", "disputed", "pending"].includes(tx.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDialog({ open: true, type: "refund", track: "procurement", id: tx.id, ref: `Contract #${tx.contractId}` })}
                              disabled={actionMutation.isPending}
                              data-testid={`button-refund-proc-${tx.id}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Refund
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === "release" ? "Release Escrow Funds" : "Mark as Refunded"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "release"
                ? `Are you sure you want to release funds for ${confirmDialog?.ref}? This will mark the escrow as released.`
                : `Are you sure you want to mark ${confirmDialog?.ref} as refunded? This records that the funds were returned to the buyer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-action">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog) {
                  actionMutation.mutate({
                    type: confirmDialog.type,
                    track: confirmDialog.track,
                    id: confirmDialog.id,
                  });
                }
              }}
              disabled={actionMutation.isPending}
              data-testid="button-confirm-action"
            >
              {actionMutation.isPending ? <LoadingSpinner /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
