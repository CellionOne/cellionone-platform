import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Eye,
  Ban,
  PlayCircle,
  CreditCard,
  FileText,
  DollarSign,
  Plus,
  Minus,
  Receipt,
  Zap,
  Copy,
  KeyRound,
} from "lucide-react";

interface KycStats {
  totalOrgs: number;
  activeOrgs: number;
  totalRequests: number;
  verified: number;
  pending: number;
  rejected: number;
  paidVerifications: number;
}

interface KycOrgWithStats {
  id: number;
  name: string;
  slug: string;
  category: string;
  clientType: string;
  contactEmail: string;
  status: string;
  createdAt: string;
  totalRequests: number;
  verifiedRequests: number;
  pendingRequests: number;
  memberCount: number;
}

interface KycOrgDetail {
  id: number;
  name: string;
  slug: string;
  category: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  members: { id: number; role: string; inviteEmail: string; inviteStatus: string }[];
  stats: {
    total: number;
    pending: number;
    underReview: number;
    verified: number;
    rejected: number;
    expired: number;
  };
  recentRequests: {
    id: number;
    type: string;
    status: string;
    subjectName: string;
    subjectEmail: string;
    createdAt: string;
  }[];
}

interface BillingRequest {
  id: number;
  organisationId: number;
  requestedBy: string;
  companyName: string;
  companyEmail: string;
  estimatedMonthlyVolume: string;
  message: string | null;
  status: string;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  orgName: string | null;
}

interface BillingAccount {
  id: number;
  organisationId: number;
  billingMode: string;
  creditBalance: number;
  invoiceEmail: string | null;
  invoiceCompanyName: string | null;
  invoiceAddress: string | null;
  paymentTermsDays: number | null;
  creditLimit: number | null;
  isActive: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  orgName: string | null;
  clientType: string | null;
}

type ProvisionStep = "select-type" | "fill-details" | "success";
type ProvisionClientType = "organisation" | "application";

const PROVISION_PERMISSIONS = [
  { id: "verify:identity", label: "Instant ID Lookups (BVN, NIN, Licence, Voter ID, Passport, AML)", description: "Synchronous, instant results — 1 credit (₦5,000) per call" },
  { id: "verify:individual", label: "Individual Verification", description: "Full individual KYC with photo selfie and document checks — result via webhook (₦15,000/credit)" },
  { id: "verify:supplier", label: "Supplier Verification", description: "Corporate entity + key persons KYC — result in ~1 business day (₦75,000/credit)" },
] as const;

interface KycInvoice {
  id: number;
  billingAccountId: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[] | null;
  subtotal: number;
  total: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paystackReference: string | null;
  sentAt: string | null;
  createdAt: string;
  orgName: string | null;
}

export default function AdminKycOverview() {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ orgId: number; action: "active" | "suspended"; orgName: string; fromStatus?: string } | null>(null);
  const [approveDialog, setApproveDialog] = useState<BillingRequest | null>(null);
  const [rejectDialog, setRejectDialog] = useState<BillingRequest | null>(null);
  const [creditLimitInput, setCreditLimitInput] = useState("1000");
  const [rejectNotes, setRejectNotes] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<BillingAccount | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [billingModeDialog, setBillingModeDialog] = useState<BillingAccount | null>(null);
  const [selectedBillingMode, setSelectedBillingMode] = useState<"prepaid" | "invoiced" | "exempt">("prepaid");
  const [markPaidDialog, setMarkPaidDialog] = useState<KycInvoice | null>(null);
  const [paystackRef, setPaystackRef] = useState("");

  // Provision API client dialog
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionStep, setProvisionStep] = useState<ProvisionStep>("select-type");
  const [provisionClientType, setProvisionClientType] = useState<ProvisionClientType>("organisation");
  const [provisionName, setProvisionName] = useState("");
  const [provisionEmail, setProvisionEmail] = useState("");
  const [provisionBillingMode, setProvisionBillingMode] = useState<"prepaid" | "exempt" | "invoiced">("prepaid");
  const [provisionPermissions, setProvisionPermissions] = useState<string[]>(["verify:individual"]);
  const [provisionKeyName, setProvisionKeyName] = useState("");
  const [provisionResult, setProvisionResult] = useState<{ key: string; orgName: string; orgId: number; billingMode: string } | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  function resetProvisionDialog() {
    setProvisionStep("select-type");
    setProvisionClientType("organisation");
    setProvisionName("");
    setProvisionEmail("");
    setProvisionBillingMode("prepaid");
    setProvisionPermissions(["verify:individual"]);
    setProvisionKeyName("");
    setProvisionResult(null);
    setKeyCopied(false);
  }

  const { data: stats, isLoading: statsLoading } = useQuery<KycStats>({
    queryKey: ["/api/admin/kyc/stats"],
  });

  const { data: orgs, isLoading: orgsLoading } = useQuery<KycOrgWithStats[]>({
    queryKey: ["/api/admin/kyc/organisations"],
  });

  const { data: orgDetail, isLoading: detailLoading } = useQuery<KycOrgDetail>({
    queryKey: ["/api/admin/kyc/organisations", selectedOrgId],
    enabled: !!selectedOrgId,
  });

  const { data: billingRequests, isLoading: billingRequestsLoading } = useQuery<BillingRequest[]>({
    queryKey: ["/api/admin/kyc/billing-requests"],
  });

  const { data: billingAccounts, isLoading: billingAccountsLoading } = useQuery<BillingAccount[]>({
    queryKey: ["/api/admin/kyc/billing-accounts"],
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<KycInvoice[]>({
    queryKey: ["/api/admin/kyc/invoices"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orgId, status, fromStatus, notes }: { orgId: number; status: string; fromStatus?: string; notes?: string }) => {
      if (fromStatus === "pending_review") {
        const action = status === "active" ? "approve" : "reject";
        await apiRequest("POST", `/api/admin/kyc-orgs/${orgId}/review`, { action, ...(notes ? { notes } : {}) });
      } else {
        await apiRequest("PATCH", `/api/admin/kyc/organisations/${orgId}/status`, { status });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/organisations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/stats"] });
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/organisations", selectedOrgId] });
      }
      toast({ title: "Status updated", description: "Organisation status has been updated." });
      setConfirmAction(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ reqId, creditLimit }: { reqId: number; creditLimit: number }) => {
      await apiRequest("PATCH", `/api/admin/kyc/billing-requests/${reqId}`, {
        action: "approve",
        creditLimit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/billing-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/billing-accounts"] });
      toast({ title: "Request approved", description: "Organisation has been switched to invoiced billing." });
      setApproveDialog(null);
      setCreditLimitInput("1000");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve request.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ reqId, notes }: { reqId: number; notes: string }) => {
      await apiRequest("PATCH", `/api/admin/kyc/billing-requests/${reqId}`, {
        action: "reject",
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/billing-requests"] });
      toast({ title: "Request rejected", description: "Billing request has been rejected." });
      setRejectDialog(null);
      setRejectNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reject request.", variant: "destructive" });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ orgId, amount, reason }: { orgId: number; amount: number; reason: string }) => {
      await apiRequest("PATCH", `/api/admin/kyc/organisations/${orgId}/billing`, {
        creditAdjustment: amount,
        adjustmentReason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/billing-accounts"] });
      toast({ title: "Credits adjusted", description: "Credit balance has been updated." });
      setAdjustDialog(null);
      setAdjustAmount("");
      setAdjustReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to adjust credits.", variant: "destructive" });
    },
  });

  const billingModeMutation = useMutation({
    mutationFn: async ({ orgId, billingMode }: { orgId: number; billingMode: "prepaid" | "invoiced" | "exempt" }) => {
      await apiRequest("PATCH", `/api/admin/kyc/organisations/${orgId}/billing`, { billingMode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/billing-accounts"] });
      toast({ title: "Billing mode updated", description: `Organisation billing mode has been changed to ${selectedBillingMode}.` });
      setBillingModeDialog(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update billing mode.", variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ invoiceId, paystackReference }: { invoiceId: number; paystackReference?: string }) => {
      await apiRequest("PATCH", `/api/admin/kyc/invoices/${invoiceId}/mark-paid`, {
        paystackReference: paystackReference || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/invoices"] });
      toast({ title: "Invoice marked as paid", description: "Invoice payment has been recorded." });
      setMarkPaidDialog(null);
      setPaystackRef("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to mark invoice as paid.", variant: "destructive" });
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      clientType: "organisation" | "application";
      contactEmail: string;
      billingMode: "prepaid" | "exempt" | "invoiced";
      permissions: string[];
      keyName?: string;
    }) => {
      const res = await apiRequest("POST", "/api/admin/kyc/provision-client", payload);
      return res.json() as Promise<{ key: string; org: { id: number; name: string }; billingAccount: { billingMode: string } }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/organisations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/billing-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/stats"] });
      setProvisionResult({
        key: data.key,
        orgName: data.org.name,
        orgId: data.org.id,
        billingMode: data.billingAccount.billingMode,
      });
      setProvisionStep("success");
    },
    onError: (error: any) => {
      toast({ title: "Provisioning failed", description: error.message || "Failed to provision API client.", variant: "destructive" });
    },
  });

  const isLoading = statsLoading || orgsLoading;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amountKobo: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amountKobo / 100);
  };

  const pendingRequests = billingRequests?.filter(r => r.status === "pending") || [];

  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "KYC Oversight" }]}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-kyc-oversight-title">KYC Oversight</h1>
          <p className="text-muted-foreground">Monitor KYC organisations, verification requests, and platform metrics</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Organisations</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-orgs">{stats?.totalOrgs || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.activeOrgs || 0} active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Verification Requests</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-requests">{stats?.totalRequests || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.pending || 0} pending</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-verified-count">{stats?.verified || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.rejected || 0} rejected</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Paid Verifications</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-paid-verifications">{stats?.paidVerifications || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="organisations" className="space-y-4">
              <TabsList>
                <TabsTrigger value="organisations" data-testid="tab-organisations">Organisations</TabsTrigger>
                <TabsTrigger value="billing-requests" data-testid="tab-billing-requests">
                  Billing Requests
                  {pendingRequests.length > 0 && (
                    <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="billing-accounts" data-testid="tab-billing-accounts">Billing Accounts</TabsTrigger>
                <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
              </TabsList>

              <TabsContent value="organisations">
                <div className="flex items-center justify-between mb-4">
                  <div />
                  <Button
                    onClick={() => { resetProvisionDialog(); setProvisionOpen(true); }}
                    data-testid="button-new-api-client"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    New API Client
                  </Button>
                </div>
                {!orgs || orgs.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No KYC Organisations"
                    description="No organisations have been created yet."
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Organisations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Organisation</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Members</TableHead>
                            <TableHead>Requests</TableHead>
                            <TableHead>Verified</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orgs.map((org) => (
                            <TableRow key={org.id} data-testid={`row-kyc-org-${org.id}`}>
                              <TableCell>
                                <div className="flex items-start gap-2">
                                  <div>
                                    <p className="font-medium">{org.name}</p>
                                    <p className="text-xs text-muted-foreground">{org.contactEmail}</p>
                                  </div>
                                  {org.clientType === "application" && (
                                    <Badge className="shrink-0 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-0 text-xs" data-testid={`badge-client-type-${org.id}`}>
                                      <Zap className="h-3 w-3 mr-1" />
                                      Application
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{org.category}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={org.status === "active" ? "default" : org.status === "pending_review" ? "secondary" : "destructive"}
                                  className={org.status === "pending_review" ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300" : ""}
                                  data-testid={`badge-status-${org.id}`}
                                >
                                  {org.status === "pending_review" ? "Pending Review" : org.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{org.memberCount}</TableCell>
                              <TableCell>{org.totalRequests}</TableCell>
                              <TableCell>{org.verifiedRequests}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatDate(org.createdAt)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setSelectedOrgId(org.id)}
                                    data-testid={`button-view-org-${org.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {org.status === "pending_review" ? (
                                    <>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        onClick={() => setConfirmAction({ orgId: org.id, action: "active", orgName: org.name, fromStatus: "pending_review" })}
                                        data-testid={`button-approve-org-${org.id}`}
                                        title="Approve"
                                      >
                                        <PlayCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => setConfirmAction({ orgId: org.id, action: "suspended", orgName: org.name, fromStatus: "pending_review" })}
                                        data-testid={`button-reject-org-${org.id}`}
                                        title="Reject"
                                      >
                                        <Ban className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : org.status === "active" ? (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setConfirmAction({ orgId: org.id, action: "suspended", orgName: org.name })}
                                      data-testid={`button-suspend-org-${org.id}`}
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setConfirmAction({ orgId: org.id, action: "active", orgName: org.name })}
                                      data-testid={`button-reactivate-org-${org.id}`}
                                    >
                                      <PlayCircle className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="billing-requests">
                {billingRequestsLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : !billingRequests || billingRequests.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No Billing Requests"
                    description="No invoiced billing requests have been submitted yet."
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Invoiced Billing Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Organisation</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Est. Volume</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billingRequests.map((req) => (
                            <TableRow key={req.id} data-testid={`row-billing-request-${req.id}`}>
                              <TableCell className="font-medium">{req.orgName || `Org #${req.organisationId}`}</TableCell>
                              <TableCell>{req.companyName}</TableCell>
                              <TableCell>
                                <span className="text-sm">{req.companyEmail}</span>
                              </TableCell>
                              <TableCell>{req.estimatedMonthlyVolume}</TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                                  {req.message || "-"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    req.status === "approved" ? "default" :
                                    req.status === "rejected" ? "destructive" : "secondary"
                                  }
                                  data-testid={`badge-request-status-${req.id}`}
                                >
                                  {req.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(req.createdAt)}
                              </TableCell>
                              <TableCell>
                                {req.status === "pending" ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setApproveDialog(req);
                                        setCreditLimitInput("1000");
                                      }}
                                      data-testid={`button-approve-request-${req.id}`}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setRejectDialog(req);
                                        setRejectNotes("");
                                      }}
                                      data-testid={`button-reject-request-${req.id}`}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    {req.reviewedAt ? formatDate(req.reviewedAt) : "-"}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="billing-accounts">
                {billingAccountsLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : !billingAccounts || billingAccounts.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No Billing Accounts"
                    description="No billing accounts have been created yet."
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Billing Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Organisation</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Credits</TableHead>
                            <TableHead>Credit Limit</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billingAccounts.map((account) => (
                            <TableRow key={account.id} data-testid={`row-billing-account-${account.id}`}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{account.orgName || `Org #${account.organisationId}`}</span>
                                  {account.clientType === "application" && (
                                    <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-0 text-xs" data-testid={`badge-billing-client-type-${account.id}`}>
                                      <Zap className="h-3 w-3 mr-1" />
                                      Application
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={
                                    account.billingMode === "exempt"
                                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0"
                                      : account.billingMode === "invoiced"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0"
                                      : ""
                                  }
                                  data-testid={`badge-billing-mode-${account.id}`}
                                >
                                  {account.billingMode === "exempt" ? "Exempt" : account.billingMode === "invoiced" ? "Invoiced" : "Prepaid"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono" data-testid={`text-credit-balance-${account.id}`}>
                                  {account.creditBalance}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono">
                                  {account.creditLimit != null ? account.creditLimit : "-"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={account.isActive ? "default" : "destructive"}
                                  data-testid={`badge-account-status-${account.id}`}
                                >
                                  {account.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(account.createdAt)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setAdjustDialog(account);
                                      setAdjustAmount("");
                                      setAdjustReason("");
                                    }}
                                    data-testid={`button-adjust-credits-${account.id}`}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Adjust
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setBillingModeDialog(account);
                                      setSelectedBillingMode(account.billingMode as "prepaid" | "invoiced" | "exempt");
                                    }}
                                    data-testid={`button-set-billing-mode-${account.id}`}
                                  >
                                    <CreditCard className="h-4 w-4 mr-1" />
                                    Mode
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="invoices">
                {invoicesLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : !invoices || invoices.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No Invoices"
                    description="No invoices have been generated yet."
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Organisation</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((invoice) => (
                            <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                              <TableCell className="font-mono text-sm" data-testid={`text-invoice-number-${invoice.id}`}>
                                {invoice.invoiceNumber}
                              </TableCell>
                              <TableCell className="font-medium">
                                {invoice.orgName || "-"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                              </TableCell>
                              <TableCell className="font-mono" data-testid={`text-invoice-total-${invoice.id}`}>
                                {formatCurrency(invoice.total)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    invoice.status === "paid" ? "default" :
                                    invoice.status === "overdue" ? "destructive" :
                                    invoice.status === "sent" ? "secondary" : "outline"
                                  }
                                  data-testid={`badge-invoice-status-${invoice.id}`}
                                >
                                  {invoice.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(invoice.dueDate)}
                              </TableCell>
                              <TableCell>
                                {invoice.status !== "paid" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setMarkPaidDialog(invoice);
                                      setPaystackRef("");
                                    }}
                                    data-testid={`button-mark-paid-${invoice.id}`}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Mark Paid
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={!!selectedOrgId} onOpenChange={(open) => { if (!open) setSelectedOrgId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : orgDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {orgDetail.name}
                  <Badge variant={orgDetail.status === "active" ? "default" : "destructive"}>
                    {orgDetail.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{orgDetail.contactEmail} | {orgDetail.category}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-detail-total">{orgDetail.stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Requests</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-detail-verified">{orgDetail.stats.verified}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-detail-pending">{orgDetail.stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>

              {orgDetail.members.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Members ({orgDetail.members.length})</h4>
                  <div className="space-y-1">
                    {orgDetail.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{m.inviteEmail}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{m.role.replace("org_", "")}</Badge>
                          <Badge variant={m.inviteStatus === "accepted" ? "default" : "secondary"}>
                            {m.inviteStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orgDetail.recentRequests.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Recent Requests</h4>
                  <div className="space-y-2">
                    {orgDetail.recentRequests.slice(0, 10).map((req) => (
                      <div key={req.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{req.subjectName}</p>
                          <p className="text-xs text-muted-foreground">{req.type} | {formatDate(req.createdAt)}</p>
                        </div>
                        <Badge variant={
                          req.status === "verified" ? "default" :
                          req.status === "rejected" ? "destructive" : "secondary"
                        }>
                          {req.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) { setConfirmAction(null); setRejectNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "suspended"
                ? (confirmAction?.fromStatus === "pending_review" ? "Reject Organisation" : "Suspend Organisation")
                : (confirmAction?.fromStatus === "pending_review" ? "Approve Organisation" : "Reactivate Organisation")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "suspended"
                ? (confirmAction?.fromStatus === "pending_review"
                    ? `Are you sure you want to reject "${confirmAction?.orgName}"? The organisation will not be able to use KYC or Procurement features.`
                    : `Are you sure you want to suspend "${confirmAction?.orgName}"? This will prevent them from creating new verification requests.`)
                : (confirmAction?.fromStatus === "pending_review"
                    ? `Approve "${confirmAction?.orgName}" and grant access to all KYC Service and Procurement features. A confirmation email will be sent to the organisation.`
                    : `Are you sure you want to reactivate "${confirmAction?.orgName}"?`)}
            </DialogDescription>
          </DialogHeader>
          {confirmAction?.action === "suspended" && confirmAction?.fromStatus === "pending_review" && (
            <div className="py-2">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Rejection reason <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Explain why this organisation is being rejected..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                data-testid="textarea-reject-notes"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmAction(null); setRejectNotes(""); }} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === "suspended" ? "destructive" : "default"}
              onClick={() => {
                if (confirmAction) {
                  const notes = confirmAction.action === "suspended" && confirmAction.fromStatus === "pending_review" && rejectNotes.trim()
                    ? rejectNotes.trim()
                    : undefined;
                  statusMutation.mutate({ orgId: confirmAction.orgId, status: confirmAction.action, fromStatus: confirmAction.fromStatus, notes });
                }
              }}
              disabled={statusMutation.isPending}
              data-testid="button-confirm-action"
            >
              {statusMutation.isPending ? "Updating..."
                : confirmAction?.action === "suspended"
                  ? (confirmAction?.fromStatus === "pending_review" ? "Reject" : "Suspend")
                  : (confirmAction?.fromStatus === "pending_review" ? "Approve" : "Reactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!approveDialog} onOpenChange={(open) => { if (!open) setApproveDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Invoiced Billing</DialogTitle>
            <DialogDescription>
              Approve invoiced billing for {approveDialog?.orgName || approveDialog?.companyName}. This will switch the organisation to invoiced billing and activate API access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Company:</span>
                <p className="font-medium" data-testid="text-approve-company">{approveDialog?.companyName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{approveDialog?.companyEmail}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Est. Monthly Volume:</span>
                <p className="font-medium">{approveDialog?.estimatedMonthlyVolume}</p>
              </div>
            </div>
            {approveDialog?.message && (
              <div className="text-sm">
                <span className="text-muted-foreground">Message:</span>
                <p className="mt-1">{approveDialog.message}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="credit-limit">Monthly Credit Limit</Label>
              <Input
                id="credit-limit"
                type="number"
                min="1"
                value={creditLimitInput}
                onChange={(e) => setCreditLimitInput(e.target.value)}
                data-testid="input-credit-limit"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of verifications allowed per month before the account is paused.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (approveDialog) {
                  approveMutation.mutate({
                    reqId: approveDialog.id,
                    creditLimit: parseInt(creditLimitInput) || 1000,
                  });
                }
              }}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) setRejectDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Billing Request</DialogTitle>
            <DialogDescription>
              Reject the invoiced billing request from {rejectDialog?.orgName || rejectDialog?.companyName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-notes">Rejection Notes</Label>
              <Textarea
                id="reject-notes"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                className="resize-none"
                data-testid="input-reject-notes"
              />
              <p className="text-xs text-muted-foreground">
                Provide a reason for the rejection. This will be visible to the organisation.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectDialog) {
                  rejectMutation.mutate({
                    reqId: rejectDialog.id,
                    notes: rejectNotes || "Request rejected by admin",
                  });
                }
              }}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustDialog} onOpenChange={(open) => { if (!open) setAdjustDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits</DialogTitle>
            <DialogDescription>
              Manually adjust credits for {adjustDialog?.orgName || `Org #${adjustDialog?.organisationId}`}.
              Current balance: {adjustDialog?.creditBalance ?? 0} credits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adjust-amount">Credit Adjustment</Label>
              <Input
                id="adjust-amount"
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                data-testid="input-adjust-amount"
              />
              <p className="text-xs text-muted-foreground">
                Use a positive number to add credits, negative to remove.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Textarea
                id="adjust-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="resize-none"
                data-testid="input-adjust-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)} data-testid="button-cancel-adjust">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const amount = parseInt(adjustAmount);
                if (adjustDialog && !isNaN(amount) && amount !== 0 && adjustReason.trim()) {
                  adjustMutation.mutate({
                    orgId: adjustDialog.organisationId,
                    amount,
                    reason: adjustReason.trim(),
                  });
                } else {
                  toast({ title: "Validation Error", description: "Please provide a valid amount and reason.", variant: "destructive" });
                }
              }}
              disabled={adjustMutation.isPending}
              data-testid="button-confirm-adjust"
            >
              {adjustMutation.isPending ? "Adjusting..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!billingModeDialog} onOpenChange={(open) => { if (!open) setBillingModeDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Billing Mode</DialogTitle>
            <DialogDescription>
              Change the billing mode for {billingModeDialog?.orgName || `Org #${billingModeDialog?.organisationId}`}.
              Current mode: <span className="font-medium capitalize">{billingModeDialog?.billingMode}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Billing Mode</Label>
              <div className="flex flex-col gap-2">
                {(["prepaid", "invoiced", "exempt"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedBillingMode(mode)}
                    className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                      selectedBillingMode === mode
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    data-testid={`option-billing-mode-${mode}`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedBillingMode === mode ? "border-primary" : "border-muted-foreground"
                    }`}>
                      {selectedBillingMode === mode && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{mode}</p>
                      <p className="text-xs text-muted-foreground">
                        {mode === "prepaid" && "Organisation buys credits upfront. API calls deduct from balance."}
                        {mode === "invoiced" && "Organisation is invoiced monthly. No credit balance needed."}
                        {mode === "exempt" && "No charges applied. API calls are free. Usage is still logged for internal tracking."}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {selectedBillingMode === "exempt" && (
              <div className="rounded-md border border-purple-200 bg-purple-50 dark:border-purple-800/40 dark:bg-purple-900/20 p-3 text-sm text-purple-800 dark:text-purple-300">
                Exempt mode grants complimentary API access. All verification calls will be logged at ₦0 for internal cost tracking. Use this for first-party or trusted partner applications.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingModeDialog(null)} data-testid="button-cancel-billing-mode">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (billingModeDialog) {
                  billingModeMutation.mutate({ orgId: billingModeDialog.organisationId, billingMode: selectedBillingMode });
                }
              }}
              disabled={billingModeMutation.isPending || selectedBillingMode === billingModeDialog?.billingMode}
              data-testid="button-confirm-billing-mode"
            >
              {billingModeMutation.isPending ? "Updating..." : "Update Mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!markPaidDialog} onOpenChange={(open) => { if (!open) setMarkPaidDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              Mark invoice {markPaidDialog?.invoiceNumber} ({formatCurrency(markPaidDialog?.total || 0)}) as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paystack-ref">Paystack Reference (optional)</Label>
              <Input
                id="paystack-ref"
                value={paystackRef}
                onChange={(e) => setPaystackRef(e.target.value)}
                data-testid="input-paystack-ref"
              />
              <p className="text-xs text-muted-foreground">
                Optional payment reference from Paystack or other payment method.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialog(null)} data-testid="button-cancel-mark-paid">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (markPaidDialog) {
                  markPaidMutation.mutate({
                    invoiceId: markPaidDialog.id,
                    paystackReference: paystackRef || undefined,
                  });
                }
              }}
              disabled={markPaidMutation.isPending}
              data-testid="button-confirm-mark-paid"
            >
              {markPaidMutation.isPending ? "Processing..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provision API Client dialog */}
      <Dialog open={provisionOpen} onOpenChange={(open) => { if (!open) { setProvisionOpen(false); resetProvisionDialog(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          {provisionStep === "select-type" && (
            <>
              <DialogHeader>
                <DialogTitle>New API Client</DialogTitle>
                <DialogDescription>
                  Choose the type of API client to provision. Both types get an API key immediately — no review required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setProvisionClientType("organisation"); setProvisionBillingMode("prepaid"); }}
                  className={`flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors ${
                    provisionClientType === "organisation" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                  data-testid="option-client-type-organisation"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium text-sm">Organisation</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    An external business client — fintech, bank, or corporate. Defaults to prepaid billing.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => { setProvisionClientType("application"); setProvisionBillingMode("exempt"); }}
                  className={`flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors ${
                    provisionClientType === "application" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                  data-testid="option-client-type-application"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-sky-600" />
                    <span className="font-medium text-sm">Application</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A first-party or trusted partner integration. Defaults to billing-exempt access.
                  </p>
                </button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProvisionOpen(false)} data-testid="button-cancel-provision">Cancel</Button>
                <Button onClick={() => setProvisionStep("fill-details")} data-testid="button-provision-next">
                  Next
                </Button>
              </DialogFooter>
            </>
          )}

          {provisionStep === "fill-details" && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  {provisionClientType === "application" ? (
                    <><Zap className="h-5 w-5 text-sky-600" /> New Application</>
                  ) : (
                    <><Building2 className="h-5 w-5" /> New Organisation</>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Fill in the details. An API key will be generated immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 pr-1">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="provision-name">{provisionClientType === "application" ? "Application Name" : "Organisation Name"} *</Label>
                    <Input
                      id="provision-name"
                      value={provisionName}
                      onChange={(e) => setProvisionName(e.target.value)}
                      placeholder={provisionClientType === "application" ? "e.g. Cellion Internal Checker" : "e.g. FastCash Microfinance"}
                      data-testid="input-provision-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provision-email">Contact Email *</Label>
                    <Input
                      id="provision-email"
                      type="email"
                      value={provisionEmail}
                      onChange={(e) => setProvisionEmail(e.target.value)}
                      placeholder="contact@example.com"
                      data-testid="input-provision-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provision-key-name">API Key Name</Label>
                    <Input
                      id="provision-key-name"
                      value={provisionKeyName}
                      onChange={(e) => setProvisionKeyName(e.target.value)}
                      placeholder={provisionClientType === "application" ? "App Key" : "Default Key"}
                      data-testid="input-provision-key-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Mode</Label>
                    <div className="flex flex-col gap-2">
                      {(["prepaid", "exempt", "invoiced"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setProvisionBillingMode(mode)}
                          className={`flex items-center gap-3 rounded-md border p-2.5 text-left transition-colors ${
                            provisionBillingMode === mode ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                          }`}
                          data-testid={`option-provision-billing-${mode}`}
                        >
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            provisionBillingMode === mode ? "border-primary" : "border-muted-foreground"
                          }`}>
                            {provisionBillingMode === mode && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium capitalize">{mode}</p>
                            <p className="text-xs text-muted-foreground">
                              {mode === "prepaid" && "Client buys credits upfront."}
                              {mode === "exempt" && "No charges. Free access with usage logging."}
                              {mode === "invoiced" && "Monthly invoiced billing."}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions *</Label>
                    <div className="space-y-2">
                      {PROVISION_PERMISSIONS.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-start gap-3 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50"
                          data-testid={`label-permission-${perm.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={provisionPermissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setProvisionPermissions((prev) => [...prev, perm.id]);
                              } else {
                                setProvisionPermissions((prev) => prev.filter((p) => p !== perm.id));
                              }
                            }}
                            className="mt-0.5"
                            data-testid={`checkbox-permission-${perm.id}`}
                          />
                          <div>
                            <p className="text-sm font-medium">{perm.label}</p>
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="shrink-0 pt-2">
                <Button variant="outline" onClick={() => setProvisionStep("select-type")} data-testid="button-provision-back">Back</Button>
                <Button
                  onClick={() => {
                    if (!provisionName.trim() || !provisionEmail.trim() || provisionPermissions.length === 0) {
                      toast({ title: "Missing fields", description: "Please fill in name, email, and select at least one permission.", variant: "destructive" });
                      return;
                    }
                    provisionMutation.mutate({
                      name: provisionName.trim(),
                      clientType: provisionClientType,
                      contactEmail: provisionEmail.trim(),
                      billingMode: provisionBillingMode,
                      permissions: provisionPermissions,
                      keyName: provisionKeyName.trim() || undefined,
                    });
                  }}
                  disabled={provisionMutation.isPending}
                  data-testid="button-provision-create"
                >
                  {provisionMutation.isPending ? "Provisioning..." : "Create & Generate Key"}
                </Button>
              </DialogFooter>
            </>
          )}

          {provisionStep === "success" && provisionResult && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  API Client Ready
                </DialogTitle>
                <DialogDescription>
                  <strong>{provisionResult.orgName}</strong> has been provisioned with a <span className="capitalize">{provisionResult.billingMode}</span> billing account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Copy this key now — it will never be shown again.</p>
                  <p>Hand it directly to the client. Store it securely.</p>
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all" data-testid="text-generated-api-key">
                      {provisionResult.key}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(provisionResult.key);
                        setKeyCopied(true);
                        setTimeout(() => setKeyCopied(false), 2000);
                      }}
                      data-testid="button-copy-api-key"
                    >
                      {keyCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <p className="font-medium text-sm">Next steps</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Hand the API key to the client to include in all requests as <code className="bg-muted px-1 rounded">X-API-Key</code></li>
                    <li>Ask the client to purchase credits from their billing dashboard before making calls</li>
                    <li>Share the API docs link below so they can integrate quickly</li>
                  </ul>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  asChild
                  data-testid="button-view-api-docs"
                >
                  <a href="/api-docs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    View API Documentation →
                  </a>
                </Button>
                <Button
                  onClick={() => { setProvisionOpen(false); resetProvisionDialog(); }}
                  data-testid="button-provision-done"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
