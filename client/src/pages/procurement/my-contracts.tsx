import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { FileSignature, ArrowRight, Filter } from "lucide-react";

interface Contract {
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
  awardedAt?: string;
  completedAt?: string;
  createdAt?: string;
  userRole?: string;
  buyerOrgName?: string;
  supplierOrgName?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  awarded: { label: "Awarded", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  delivered: { label: "Delivered", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

function ContractStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="secondary" className={`font-medium border-0 ${config.className}`} data-testid={`status-badge-${status}`}>
      {config.label}
    </Badge>
  );
}

function formatAmount(amount: number, currency: string = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount / 100);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

export default function MyContractsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/procurement/contracts"],
  });

  const filtered = (contracts || []).filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (roleFilter !== "all" && c.userRole !== roleFilter) return false;
    return true;
  });

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement", href: "/procurement/marketplace" }, { label: "Contracts" }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-contracts-title">Contracts</h1>
            <p className="text-muted-foreground text-sm">Manage your procurement contracts</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-role-filter">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="buyer">Buyer</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="No contracts found"
            description={contracts && contracts.length > 0 ? "Try adjusting your filters." : "Contracts appear here when bids are awarded."}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Awarded</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((contract) => (
                    <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                      <TableCell className="font-medium" data-testid={`text-contract-number-${contract.id}`}>
                        {contract.contractNumber}
                      </TableCell>
                      <TableCell data-testid={`text-counterparty-${contract.id}`}>
                        {contract.userRole === "buyer"
                          ? (contract.supplierOrgName || `Org #${contract.supplierOrgId}`)
                          : (contract.buyerOrgName || `Org #${contract.buyerOrgId}`)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-0" data-testid={`badge-role-${contract.id}`}>
                          {contract.userRole === "buyer" ? "Buyer" : "Supplier"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium" data-testid={`text-amount-${contract.id}`}>
                        {formatAmount(contract.totalAmount, contract.currency)}
                      </TableCell>
                      <TableCell>
                        <ContractStatusBadge status={contract.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm" data-testid={`text-date-${contract.id}`}>
                        {formatDate(contract.awardedAt)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild data-testid={`button-view-contract-${contract.id}`}>
                          <Link href={`/procurement/contracts/${contract.id}`}>
                            View
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
