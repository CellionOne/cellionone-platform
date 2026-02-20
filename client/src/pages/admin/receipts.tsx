import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Receipt,
  Search,
  Filter,
  Plus,
  XCircle,
  CheckCircle2,
  Ban,
} from "lucide-react";
import type { VerificationReceipt, CompanyApplication } from "@shared/schema";

interface ReceiptWithApplication extends VerificationReceipt {
  companyName?: string;
}

export default function AdminReceipts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithApplication | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  
  const [newReceipt, setNewReceipt] = useState({
    applicationId: "",
    scope: "incorporation",
    receiptNumber: "",
    issuedBy: "celion",
  });

  const { data: receipts, isLoading } = useQuery<ReceiptWithApplication[]>({
    queryKey: ["/api/admin/receipts"],
  });

  const { data: applications } = useQuery<CompanyApplication[]>({
    queryKey: ["/api/admin/applications"],
  });

  const issueMutation = useMutation({
    mutationFn: async (data: typeof newReceipt) => {
      return apiRequest("POST", "/api/admin/receipts", {
        applicationId: parseInt(data.applicationId),
        scope: data.scope,
        receiptNumber: data.receiptNumber,
        issuedBy: data.issuedBy,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/receipts"] });
      toast({ title: "Receipt issued successfully" });
      setIssueDialogOpen(false);
      setNewReceipt({
        applicationId: "",
        scope: "incorporation",
        receiptNumber: "",
        issuedBy: "celion",
      });
    },
    onError: () => {
      toast({ title: "Failed to issue receipt", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      return apiRequest("POST", `/api/admin/receipts/${id}/revoke`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/receipts"] });
      toast({ title: "Receipt revoked successfully" });
      setRevokeDialogOpen(false);
      setSelectedReceipt(null);
      setRevokeReason("");
    },
    onError: () => {
      toast({ title: "Failed to revoke receipt", variant: "destructive" });
    },
  });

  const filteredReceipts = receipts?.filter((receipt) => {
    const matchesSearch = !searchQuery || 
      receipt.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.applicationId?.toString().includes(searchQuery) ||
      receipt.companyName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && !receipt.revokedAt) ||
      (statusFilter === "revoked" && receipt.revokedAt);
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      identity: "Identity Verification",
      incorporation: "Incorporation",
      post_incorporation: "Post Incorporation",
      document_bundle: "Document Bundle",
    };
    return labels[scope] || scope;
  };

  return (
    <DashboardLayout 
      role="admin" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Receipts" }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Verification Receipts</h1>
            <p className="text-muted-foreground">
              Issue and manage verification receipts for completed applications
            </p>
          </div>
          <Button onClick={() => setIssueDialogOpen(true)} data-testid="button-issue-receipt">
            <Plus className="h-4 w-4 mr-2" />
            Issue Receipt
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by receipt number, company, or application ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Receipts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !filteredReceipts?.length ? (
          <EmptyState
            icon={Receipt}
            title="No receipts found"
            description="Issue receipts for completed applications to track verification status."
          />
        ) : (
          <div className="grid gap-4">
            {filteredReceipts.map((receipt) => (
              <Card key={receipt.id} data-testid={`receipt-${receipt.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                        receipt.revokedAt ? "bg-destructive/10" : "bg-primary/10"
                      }`}>
                        <Receipt className={`h-6 w-6 ${
                          receipt.revokedAt ? "text-destructive" : "text-primary"
                        }`} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">
                            {receipt.receiptNumber || `Receipt #${receipt.id}`}
                          </h3>
                          <Badge variant={receipt.revokedAt ? "destructive" : "default"}>
                            {receipt.revokedAt ? "Revoked" : "Active"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getScopeLabel(receipt.scope || "")}
                        </p>
                        <div className="text-sm text-muted-foreground">
                          <span>Application #{receipt.applicationId}</span>
                          {receipt.companyName && (
                            <>
                              <span> &bull; </span>
                              <span>{receipt.companyName}</span>
                            </>
                          )}
                        </div>
                        {receipt.revokedAt && receipt.revocationReason && (
                          <p className="text-sm text-destructive mt-2">
                            Revoked: {receipt.revocationReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0">
                      <div className="text-sm text-muted-foreground">
                        Issued: {formatDate(receipt.issuedAt)}
                      </div>
                      {!receipt.revokedAt && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedReceipt(receipt);
                            setRevokeDialogOpen(true);
                          }}
                          data-testid={`button-revoke-${receipt.id}`}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Verification Receipt</DialogTitle>
            <DialogDescription>
              Create a new verification receipt for a completed application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="applicationId">Application</Label>
              <Select 
                value={newReceipt.applicationId} 
                onValueChange={(value) => setNewReceipt({ ...newReceipt, applicationId: value })}
              >
                <SelectTrigger data-testid="select-application">
                  <SelectValue placeholder="Select an application" />
                </SelectTrigger>
                <SelectContent>
                  {applications?.filter(app => app.status === "completed").map((app) => (
                    <SelectItem key={app.id} value={app.id.toString()}>
                      #{app.id} - {app.companyName1 || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select 
                value={newReceipt.scope} 
                onValueChange={(value) => setNewReceipt({ ...newReceipt, scope: value })}
              >
                <SelectTrigger data-testid="select-scope">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="identity">Identity Verification</SelectItem>
                  <SelectItem value="incorporation">Incorporation</SelectItem>
                  <SelectItem value="post_incorporation">Post Incorporation</SelectItem>
                  <SelectItem value="document_bundle">Document Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input
                id="receiptNumber"
                placeholder="e.g., CAC/IT/NO-123456"
                value={newReceipt.receiptNumber}
                onChange={(e) => setNewReceipt({ ...newReceipt, receiptNumber: e.target.value })}
                data-testid="input-receipt-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuedBy">Issued By</Label>
              <Select 
                value={newReceipt.issuedBy} 
                onValueChange={(value) => setNewReceipt({ ...newReceipt, issuedBy: value })}
              >
                <SelectTrigger data-testid="select-issued-by">
                  <SelectValue placeholder="Select issuer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="celion">Cellion One</SelectItem>
                  <SelectItem value="lawyer_proxy">Lawyer Proxy</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => issueMutation.mutate(newReceipt)}
              disabled={!newReceipt.applicationId || !newReceipt.receiptNumber || issueMutation.isPending}
              data-testid="button-confirm-issue"
            >
              {issueMutation.isPending ? <LoadingSpinner size="sm" /> : "Issue Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Receipt</DialogTitle>
            <DialogDescription>
              This will permanently mark the receipt as revoked. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="revokeReason">Reason for Revocation</Label>
            <Textarea
              id="revokeReason"
              placeholder="Explain why this receipt is being revoked..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="mt-2"
              data-testid="input-revoke-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedReceipt) {
                  revokeMutation.mutate({ id: selectedReceipt.id, reason: revokeReason });
                }
              }}
              disabled={!revokeReason || revokeMutation.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeMutation.isPending ? <LoadingSpinner size="sm" /> : "Revoke Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
