import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import {
  Users,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Plus,
  Upload,
  Copy,
  Search,
  Eye,
  Settings,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Link2,
  Shield,
} from "lucide-react";
import type { KycOrganisation, KycVerificationRequest, KycVerificationTemplate } from "@shared/schema";

interface OrgWithStats extends KycOrganisation {
  members: any[];
  stats: {
    total: number;
    pending: number;
    underReview: number;
    verified: number;
    rejected: number;
    expired: number;
    riskGreen: number;
    riskAmber: number;
    riskRed: number;
  };
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

const riskColors: Record<string, string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function OrgDashboard() {
  const params = useParams<{ id: string }>();
  const orgId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const [newReqType, setNewReqType] = useState<string>("individual");
  const [newReqName, setNewReqName] = useState("");
  const [newReqEmail, setNewReqEmail] = useState("");
  const [newReqTemplateId, setNewReqTemplateId] = useState<string>("");
  const [newReqPayment, setNewReqPayment] = useState<string>("organisation");
  const [newReqNotes, setNewReqNotes] = useState("");

  const { data: org, isLoading: orgLoading } = useQuery<OrgWithStats>({
    queryKey: ["/api/kyc-service/organisations", orgId],
  });

  const { data: requests, isLoading: requestsLoading } = useQuery<KycVerificationRequest[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"],
  });

  const { data: templates } = useQuery<KycVerificationTemplate[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "templates"],
  });

  const { data: sessionsData } = useQuery<{ sessions: any[] }>({
    queryKey: ["/api/kyc-service/orgs", orgId, "sessions"],
    queryFn: () => fetch(`/api/kyc-service/orgs/${orgId}/sessions`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: expiryData } = useQuery<{ alerts: any[]; count: number }>({
    queryKey: ["/api/kyc-service/orgs", orgId, "expiry-alerts"],
    queryFn: () => fetch(`/api/kyc-service/orgs/${orgId}/expiry-alerts`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: sanctionsData } = useQuery<{ logs: any[] }>({
    queryKey: ["/api/kyc-service/orgs", orgId, "sanctions-logs"],
    queryFn: () => fetch(`/api/kyc-service/orgs/${orgId}/sanctions-logs`, { credentials: "include" }).then(r => r.json()),
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/verification-requests`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"] });
      setNewRequestOpen(false);
      resetNewRequestForm();
      toast({ title: "Verification request created", description: "An invitation has been sent to the subject." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create request", description: error.message, variant: "destructive" });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/kyc-service/organisations/${orgId}/verification-requests/bulk`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"] });
      setBulkImportOpen(false);
      toast({ title: "Bulk import complete", description: `${data.created || 0} requests created.` });
    },
    onError: (error: Error) => {
      toast({ title: "Bulk import failed", description: error.message, variant: "destructive" });
    },
  });

  function resetNewRequestForm() {
    setNewReqType("individual");
    setNewReqName("");
    setNewReqEmail("");
    setNewReqTemplateId("");
    setNewReqPayment("organisation");
    setNewReqNotes("");
  }

  function handleCreateRequest() {
    createRequestMutation.mutate({
      type: newReqType,
      subjectName: newReqName,
      subjectEmail: newReqEmail,
      templateId: newReqTemplateId ? parseInt(newReqTemplateId) : undefined,
      paymentResponsibility: newReqPayment,
      notes: newReqNotes || undefined,
    });
  }

  function handleBulkImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    bulkImportMutation.mutate(formData);
  }

  function copyPortalLink(type: "employees" | "suppliers") {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/kyc/${org?.slug}/${type}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied", description: `${type === "employees" ? "Employee" : "Supplier"} portal link copied to clipboard.` });
  }

  const filteredRequests = (requests || []).filter((req) => {
    if (typeFilter !== "all" && req.type !== typeFilter) return false;
    if (statusFilter !== "all" && req.status !== statusFilter) return false;
    if (riskFilter !== "all" && req.riskScore !== riskFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return req.subjectName.toLowerCase().includes(q) || req.subjectEmail.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = org?.stats;

  if (orgLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!org) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Not Found" }]}>
        <EmptyState title="Organisation not found" description="The organisation you're looking for doesn't exist or you don't have access." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: org.name }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-org-name">{org.name}</h1>
            <p className="text-muted-foreground text-sm">{org.category} organisation</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" asChild data-testid="button-org-settings">
              <Link href={`/kyc/org/${orgId}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-bulk-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Import Employees</DialogTitle>
                  <DialogDescription>Upload a CSV file with name and email columns to create multiple verification requests.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBulkImport} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="csv-file">CSV File</Label>
                    <Input id="csv-file" name="file" type="file" accept=".csv" required data-testid="input-csv-file" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select name="type" defaultValue="individual">
                      <SelectTrigger data-testid="select-bulk-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Responsibility</Label>
                    <Select name="paymentResponsibility" defaultValue="organisation">
                      <SelectTrigger data-testid="select-bulk-payment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organisation">Organisation</SelectItem>
                        <SelectItem value="subject">Subject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={bulkImportMutation.isPending} data-testid="button-submit-bulk">
                      {bulkImportMutation.isPending ? "Importing..." : "Import"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-request">
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Verification Request</DialogTitle>
                  <DialogDescription>Send a verification request to an individual or supplier.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Verification Type</Label>
                    <Select value={newReqType} onValueChange={setNewReqType}>
                      <SelectTrigger data-testid="select-new-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="supplier">Supplier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject Name</Label>
                    <Input
                      value={newReqName}
                      onChange={(e) => setNewReqName(e.target.value)}
                      placeholder={newReqType === "supplier" ? "Company name" : "Full name"}
                      data-testid="input-subject-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject Email</Label>
                    <Input
                      type="email"
                      value={newReqEmail}
                      onChange={(e) => setNewReqEmail(e.target.value)}
                      placeholder="email@example.com"
                      data-testid="input-subject-email"
                    />
                  </div>
                  {templates && templates.filter(t => t.type === newReqType).length > 0 && (
                    <div className="space-y-2">
                      <Label>Template (optional)</Label>
                      <Select value={newReqTemplateId} onValueChange={setNewReqTemplateId}>
                        <SelectTrigger data-testid="select-template">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No template</SelectItem>
                          {templates.filter(t => t.type === newReqType).map(t => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Payment Responsibility</Label>
                    <Select value={newReqPayment} onValueChange={setNewReqPayment}>
                      <SelectTrigger data-testid="select-payment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organisation">Organisation pays</SelectItem>
                        <SelectItem value="subject">Subject pays</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      value={newReqNotes}
                      onChange={(e) => setNewReqNotes(e.target.value)}
                      placeholder="Any additional instructions..."
                      data-testid="input-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateRequest}
                    disabled={!newReqName || !newReqEmail || createRequestMutation.isPending}
                    data-testid="button-submit-request"
                  >
                    {createRequestMutation.isPending ? "Creating..." : "Create Request"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card data-testid="card-stat-total">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-total">{stats?.total ?? 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-pending">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-pending">{stats?.underReview ?? 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-verified">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-stat-verified">{stats?.verified ?? 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-rejected">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-stat-rejected">{stats?.rejected ?? 0}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-expired">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-expired">{stats?.expired ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-risk-distribution">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm text-muted-foreground">Green</span>
                <span className="text-lg font-bold" data-testid="text-risk-green">{stats?.riskGreen ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-muted-foreground">Amber</span>
                <span className="text-lg font-bold" data-testid="text-risk-amber">{stats?.riskAmber ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-sm text-muted-foreground">Red</span>
                <span className="text-lg font-bold" data-testid="text-risk-red">{stats?.riskRed ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {requests && (() => {
          const now = Date.now();
          const thirtyDays = now + 30 * 24 * 60 * 60 * 1000;
          const expiringSoon = requests.filter(r =>
            r.expiresAt && new Date(r.expiresAt).getTime() > now && new Date(r.expiresAt).getTime() < thirtyDays
            && !['verified', 'rejected', 'expired'].includes(r.status)
          );
          const expiredUnresolved = requests.filter(r =>
            r.expiresAt && new Date(r.expiresAt).getTime() <= now
            && !['verified', 'rejected'].includes(r.status)
          );
          if (expiringSoon.length === 0 && expiredUnresolved.length === 0) return null;
          return (
            <Card data-testid="card-expiry-alerts" className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Document Expiry Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {expiredUnresolved.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" data-testid={`alert-expired-${r.id}`}>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">{r.subjectName}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">Expired {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : ""}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/kyc/org/${orgId}/requests/${r.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
                {expiringSoon.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid={`alert-expiring-${r.id}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{r.subjectName}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Expires {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : ""}
                          {" "}({Math.ceil((new Date(r.expiresAt!).getTime() - now) / (1000 * 60 * 60 * 24))} days left)
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/kyc/org/${orgId}/requests/${r.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}

        <Card data-testid="card-portal-links">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Self-Registration Portal Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {org.employeePortalEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Employee Portal:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded-md" data-testid="text-employee-portal-link">
                    /kyc/{org.slug}/employees
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyPortalLink("employees")} data-testid="button-copy-employee-link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={`/kyc/${org.slug}/employees`} target="_blank" rel="noopener noreferrer" data-testid="link-employee-portal">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}
              {org.supplierPortalEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Supplier Portal:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded-md" data-testid="text-supplier-portal-link">
                    /kyc/{org.slug}/suppliers
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyPortalLink("suppliers")} data-testid="button-copy-supplier-link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={`/kyc/${org.slug}/suppliers`} target="_blank" rel="noopener noreferrer" data-testid="link-supplier-portal">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="requests" data-testid="dashboard-tabs">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="requests" data-testid="tab-requests">
              Requests
              {requests && requests.length > 0 && (
                <Badge variant="secondary" className="ml-2 border-0 text-xs">{requests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">
              Sessions
              {sessionsData?.sessions && sessionsData.sessions.length > 0 && (
                <Badge variant="secondary" className="ml-2 border-0 text-xs">{sessionsData.sessions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="monitoring" data-testid="tab-monitoring">
              Monitoring
              {expiryData && expiryData.count > 0 && (
                <Badge variant="destructive" className="ml-2 border-0 text-xs">{expiryData.count}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Verification Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending_invite">Pending Invite</SelectItem>
                      <SelectItem value="pending_payment">Pending Payment</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="documents_submitted">Docs Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-filter-risk">
                      <SelectValue placeholder="Risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="amber">Amber</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requestsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No verification requests"
                    description={requests?.length ? "No requests match your filters." : "Create your first verification request to get started."}
                    action={
                      !requests?.length ? (
                        <Button onClick={() => setNewRequestOpen(true)} data-testid="button-empty-new-request">
                          <Plus className="h-4 w-4 mr-2" />
                          New Request
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.map((req) => (
                          <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                            <TableCell>
                              <Badge variant="secondary" className="border-0" data-testid={`badge-type-${req.id}`}>
                                {req.type === "individual" ? "Individual" : "Supplier"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm" data-testid={`text-name-${req.id}`}>{req.subjectName}</p>
                                <p className="text-xs text-muted-foreground">{req.subjectEmail}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`border-0 ${statusColors[req.status] || ""}`} data-testid={`badge-status-${req.id}`}>
                                {statusLabels[req.status] || req.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {req.riskScore ? (
                                <Badge variant="secondary" className={`border-0 ${riskColors[req.riskScore] || ""}`} data-testid={`badge-risk-${req.id}`}>
                                  {req.riskScore.charAt(0).toUpperCase() + req.riskScore.slice(1)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" asChild data-testid={`button-view-${req.id}`}>
                                <Link href={`/kyc/org/${orgId}/requests/${req.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Hosted Verification Sessions
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {!sessionsData ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : sessionsData.sessions.length === 0 ? (
                  <EmptyState
                    icon={Link2}
                    title="No sessions yet"
                    description="Hosted sessions are created via the API. Each session generates a unique verification link for a subject."
                  />
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionsData.sessions.map((session: any) => {
                          const statusColor: Record<string, string> = {
                            pending: "bg-muted text-muted-foreground",
                            in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                            completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                            expired: "bg-muted text-muted-foreground",
                          };
                          return (
                            <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{session.subjectName}</p>
                                  <p className="text-xs text-muted-foreground">{session.subjectEmail}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={`border-0 capitalize ${statusColor[session.status] || ""}`} data-testid={`badge-session-status-${session.id}`}>
                                  {session.status.replace("_", " ")}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(session.expiresAt).toLocaleDateString()}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(session.createdAt).toLocaleDateString()}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {session.status === "pending" || session.status === "in_progress" ? (
                                  <Button variant="ghost" size="icon" onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/verify/${session.sessionToken}`);
                                    toast({ title: "Link copied", description: "Session link copied to clipboard." });
                                  }} data-testid={`button-copy-session-${session.id}`}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground px-2">—</span>
                                )}
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
          </TabsContent>

          <TabsContent value="monitoring" className="mt-4 space-y-4">
            <Card data-testid="card-doc-expiry-alerts">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Document Expiry Alerts
                  {expiryData && expiryData.count > 0 && (
                    <Badge variant="destructive" className="ml-1 border-0">{expiryData.count}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!expiryData ? (
                  <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : expiryData.alerts.length === 0 ? (
                  <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    All verified documents are valid — no expiry alerts.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expiryData.alerts.map((alert: any) => (
                      <div
                        key={alert.docId}
                        className={`flex items-center justify-between gap-4 p-3 rounded-lg border ${
                          alert.isExpired
                            ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                            : alert.isUrgent
                            ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                            : "border-yellow-100 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-950/10"
                        }`}
                        data-testid={`alert-doc-expiry-${alert.docId}`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {alert.isExpired ? (
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${alert.isUrgent ? "text-amber-500" : "text-yellow-500"}`} />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{alert.subjectName}</p>
                            <p className="text-xs text-muted-foreground truncate">{alert.docFileName}</p>
                            <p className={`text-xs font-medium mt-0.5 ${alert.isExpired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                              {alert.isExpired
                                ? `Expired ${Math.abs(alert.daysLeft)} day${Math.abs(alert.daysLeft) !== 1 ? "s" : ""} ago`
                                : `Expires in ${alert.daysLeft} day${alert.daysLeft !== 1 ? "s" : ""}`}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild className="shrink-0">
                          <Link href={`/kyc/org/${orgId}/requests/${alert.requestId}`}>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-sanctions-monitoring">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Sanctions & AML Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!sanctionsData ? (
                  <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : sanctionsData.logs.length === 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
                      <Shield className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                      No screening runs recorded yet. Automated weekly screening is managed by Cellion One.
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-muted text-xs text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Sanctions monitoring runs weekly when enabled by Cellion One admin. Contact <a href="mailto:service@cellionone.com" className="underline hover:text-foreground">service@cellionone.com</a> to activate.
                    </div>
                  </div>
                ) : (() => {
                  // Derive per-entity latest screening status (most recent log per subject)
                  const latestBySubject = Object.values(
                    sanctionsData.logs.reduce((acc: Record<string, any>, log: any) => {
                      if (!acc[log.subjectName] || new Date(log.createdAt) > new Date(acc[log.subjectName].createdAt)) {
                        acc[log.subjectName] = log;
                      }
                      return acc;
                    }, {} as Record<string, any>)
                  );
                  return (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Current Status per Entity</p>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Risk Score</TableHead>
                                <TableHead>Last Screened</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {latestBySubject.map((log: any) => (
                                <TableRow key={`latest-${log.id}`} data-testid={`row-sanctions-latest-${log.id}`}>
                                  <TableCell>
                                    <p className="text-sm font-medium">{log.subjectName}</p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      className={`border-0 ${log.screeningResult === "alert" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}
                                      data-testid={`badge-sanctions-latest-${log.id}`}
                                    >
                                      {log.screeningResult === "alert" ? "⚠ Alert" : "✓ Clear"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className={`text-sm font-medium capitalize ${log.newRiskScore === "red" ? "text-red-500" : log.newRiskScore === "amber" ? "text-amber-500" : "text-green-600"}`}>
                                      {log.newRiskScore || "—"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(log.createdAt).toLocaleDateString()}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Full Screening History</p>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Risk Change</TableHead>
                                <TableHead>Screened At</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sanctionsData.logs.map((log: any) => (
                                <TableRow key={log.id} data-testid={`row-sanctions-${log.id}`}>
                                  <TableCell>
                                    <p className="text-sm font-medium">{log.subjectName}</p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      className={`border-0 ${log.screeningResult === "alert" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}
                                      data-testid={`badge-sanctions-result-${log.id}`}
                                    >
                                      {log.screeningResult === "alert" ? "⚠ Alert" : "✓ Clear"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span className={`capitalize ${log.previousRiskScore === "red" ? "text-red-500" : log.previousRiskScore === "amber" ? "text-amber-500" : "text-green-500"}`}>
                                        {log.previousRiskScore || "—"}
                                      </span>
                                      <span>→</span>
                                      <span className={`capitalize ${log.newRiskScore === "red" ? "text-red-500" : log.newRiskScore === "amber" ? "text-amber-500" : "text-green-500"}`}>
                                        {log.newRiskScore || "—"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(log.createdAt).toLocaleDateString()}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
