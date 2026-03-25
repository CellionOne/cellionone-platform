import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ClipboardCheck, Link2, Users, ShieldAlert, BarChart3,
  Code2, CreditCard, Settings2, CheckCircle2, XCircle, AlertTriangle,
  Eye, Copy, Plus, Trash2, UserPlus, Key, Webhook, ExternalLink,
  Shield, Menu, X, ShieldCheck, ShieldX, Clock, Search,
  RefreshCw, Download, ChevronRight, Zap, Terminal, Activity,
  Upload, Layers, FileText, Camera, ScanFace, Timer,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { KycOrganisation, KycVerificationRequest, KycOrgMember, KycApiKey, KycWebhookConfig, KycVerificationTemplate, KycDocumentRequirement } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgWithStats extends KycOrganisation {
  members: KycOrgMember[];
  stats: {
    total: number; pending: number; underReview: number;
    verified: number; rejected: number; expired: number;
    riskGreen: number; riskAmber: number; riskRed: number;
  };
}

type Section = "dashboard" | "verifications" | "sessions" | "users" | "monitoring" | "analytics" | "developers" | "billing" | "team" | "settings";

const STATUS_LABELS: Record<string, string> = {
  pending_invite: "Pending Invite", pending_payment: "Pending Payment",
  in_progress: "In Progress", documents_submitted: "Docs Submitted",
  under_review: "Under Review", verified: "Verified", rejected: "Rejected", expired: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  pending_invite: "bg-muted text-muted-foreground",
  pending_payment: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  documents_submitted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  under_review: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-muted text-muted-foreground",
};

// ─── Sidebar Config ──────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { id: "dashboard" as Section, label: "Dashboard", icon: LayoutDashboard },
      { id: "verifications" as Section, label: "Verifications", icon: ClipboardCheck },
      { id: "sessions" as Section, label: "Sessions", icon: Link2 },
      { id: "users" as Section, label: "Users", icon: Users },
      { id: "monitoring" as Section, label: "Monitoring", icon: ShieldAlert },
      { id: "analytics" as Section, label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Developers",
    items: [
      { id: "developers" as Section, label: "Developers", icon: Code2 },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "billing" as Section, label: "Billing", icon: CreditCard },
      { id: "team" as Section, label: "Team", icon: Users },
      { id: "settings" as Section, label: "Settings", icon: Settings2 },
    ],
  },
];

// ─── Portal Layout ────────────────────────────────────────────────────────────

function KycPortalSidebar({
  orgId, org, section, onNav, sidebarOpen, setSidebarOpen,
}: {
  orgId: string; org: OrgWithStats | undefined; section: Section;
  onNav: (s: Section) => void; sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void;
}) {
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 z-40 h-full w-56 border-r bg-card flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" data-testid="text-portal-org-name">{org?.name || "Loading..."}</p>
            <p className="text-xs text-muted-foreground capitalize">{org?.category || "organisation"}</p>
          </div>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
            data-testid="button-close-sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{group.label}</p>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { onNav(id); setSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors text-left",
                    section === id
                      ? "bg-primary/10 text-primary border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                  data-testid={`nav-${id}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t">
          <a href="/api-docs" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
            API Documentation
          </a>
        </div>
      </aside>
    </>
  );
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection({ orgId, org, onNav }: { orgId: string; org: OrgWithStats | undefined; onNav: (s: Section) => void }) {
  const { data: requests } = useQuery<KycVerificationRequest[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"],
  });
  const { data: billing } = useQuery<any>({
    queryKey: ["/api/kyc-service/organisations", orgId, "billing"],
  });

  const stats = org?.stats;
  const passRate = stats && stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0;
  const recentActivity = [...(requests || [])].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  ).slice(0, 10);
  const isNewOrg = !stats || stats.total === 0;

  const avgProcessingDays = (() => {
    const completed = (requests || []).filter(r => r.status === "verified" && r.createdAt && r.updatedAt);
    if (!completed.length) return null;
    const totalMs = completed.reduce((sum, r) => sum + (new Date(r.updatedAt!).getTime() - new Date(r.createdAt!).getTime()), 0);
    return Math.round(totalMs / completed.length / (1000 * 60 * 60 * 24));
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Overview of your KYC verification activity</p>
        </div>
      </div>

      {isNewOrg && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2 flex-1">
                <p className="font-semibold text-primary">Quick Start</p>
                <p className="text-sm text-muted-foreground">You haven't created any verifications yet. Get started by generating an API key and creating your first session.</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" asChild><a href="/api-docs">Read API Docs</a></Button>
                  <Button size="sm" variant="outline" onClick={() => onNav("developers")} data-testid="button-go-to-developers">Go to Developers</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: ClipboardCheck, color: "" },
          { label: "Pass Rate", value: `${passRate}%`, icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
          { label: "Avg Days to Result", value: avgProcessingDays !== null ? `${avgProcessingDays}d` : "—", icon: Clock, color: "text-blue-600 dark:text-blue-400" },
          { label: "Credits", value: billing?.creditBalance ?? "—", icon: CreditCard, color: "text-primary" },
          { label: "Under Review", value: stats?.underReview ?? 0, icon: ShieldAlert, color: "text-amber-600 dark:text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", color)} data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No verifications yet</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((req) => (
                  <div key={req.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{req.subjectName}</p>
                      <p className="text-xs text-muted-foreground">{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ""}</p>
                    </div>
                    <Badge variant="secondary" className={cn("border-0 shrink-0 text-xs", STATUS_COLORS[req.status] || "")}>
                      {STATUS_LABELS[req.status] || req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-2">
              {[
                { label: "Green", icon: ShieldCheck, color: "text-green-600 dark:text-green-400", value: stats?.riskGreen ?? 0, bg: "bg-green-100 dark:bg-green-900/20" },
                { label: "Amber", icon: ShieldAlert, color: "text-amber-600 dark:text-amber-400", value: stats?.riskAmber ?? 0, bg: "bg-amber-100 dark:bg-amber-900/20" },
                { label: "Red", icon: ShieldX, color: "text-red-600 dark:text-red-400", value: stats?.riskRed ?? 0, bg: "bg-red-100 dark:bg-red-900/20" },
              ].map(({ label, icon: Icon, color, value, bg }) => (
                <div key={label} className={cn("flex items-center justify-between p-3 rounded-lg", bg)}>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="text-sm font-medium">{label} Risk</span>
                  </div>
                  <span className={cn("text-lg font-bold", color)}>{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Verifications Section ────────────────────────────────────────────────────

function VerificationsSection({ orgId }: { orgId: string }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newType, setNewType] = useState("individual");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPayment, setNewPayment] = useState("organisation");
  const [newNotes, setNewNotes] = useState("");
  const [newTemplateId, setNewTemplateId] = useState("none");
  const { toast } = useToast();

  const { data: requests, isLoading } = useQuery<KycVerificationRequest[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"],
  });

  const { data: templates } = useQuery<KycVerificationTemplate[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/verification-requests`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"] });
      setNewOpen(false);
      setNewName(""); setNewEmail(""); setNewType("individual"); setNewNotes(""); setNewTemplateId("none");
      toast({ title: "Verification request created" });
    },
    onError: (e: Error) => toast({ title: "Failed to create request", description: e.message, variant: "destructive" }),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/kyc-service/organisations/${orgId}/verification-requests/bulk`, {
        method: "POST", body: formData, credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"] });
      setBulkOpen(false);
      toast({ title: "Bulk import complete", description: `${data.created ?? 0} requests created.` });
    },
    onError: (e: Error) => toast({ title: "Bulk import failed", description: e.message, variant: "destructive" }),
  });

  function handleBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    bulkImportMutation.mutate(new FormData(e.currentTarget));
  }

  const filtered = (requests || []).filter((r) => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (fromDate && r.createdAt && new Date(r.createdAt) < new Date(fromDate)) return false;
    if (toDate && r.createdAt && new Date(r.createdAt) > new Date(toDate + "T23:59:59")) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.subjectName.toLowerCase().includes(q) || r.subjectEmail.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Verifications</h2>
          <p className="text-sm text-muted-foreground">{requests?.length ?? 0} total verification requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} data-testid="button-bulk-import">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => setNewOpen(true)} data-testid="button-new-verification">
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" data-testid="input-search-verifications" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-type-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">From</span>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[140px] text-xs" data-testid="input-from-date" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">To</span>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[140px] text-xs" data-testid="input-to-date" />
            </div>
            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setFromDate(""); setToDate(""); }} data-testid="button-clear-dates">
                Clear dates
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No verifications" description={requests?.length ? "No results match your filters." : "Create your first verification request."} />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} data-testid={`row-verification-${r.id}`}>
                      <TableCell>
                        <p className="font-medium text-sm">{r.subjectName}</p>
                        <p className="text-xs text-muted-foreground">{r.subjectEmail}</p>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="border-0 capitalize">{r.type}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("border-0", STATUS_COLORS[r.status] || "")}>
                          {STATUS_LABELS[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild data-testid={`button-view-verification-${r.id}`}>
                          <Link href={`/kyc/org/${orgId}/requests/${r.id}`}><Eye className="h-4 w-4" /></Link>
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

      {/* New Request dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Verification Request</DialogTitle>
            <DialogDescription>Send a verification invitation to an individual or supplier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Type</Label>
              <Select value={newType} onValueChange={(v) => { setNewType(v); setNewTemplateId("none"); }}>
                <SelectTrigger data-testid="select-new-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={newType === "supplier" ? "Company name" : "Full name"} data-testid="input-new-name" />
            </div>
            <div className="space-y-2">
              <Label>Subject Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" data-testid="input-new-email" />
            </div>
            {templates && templates.filter(t => t.type === newType).length > 0 && (
              <div className="space-y-2">
                <Label>Template (optional)</Label>
                <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                  <SelectTrigger data-testid="select-template"><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template</SelectItem>
                    {templates.filter(t => t.type === newType).map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Payment Responsibility</Label>
              <Select value={newPayment} onValueChange={setNewPayment}>
                <SelectTrigger data-testid="select-payment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organisation">Organisation pays</SelectItem>
                  <SelectItem value="subject">Subject pays</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Any additional instructions..." data-testid="input-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate({
                type: newType, subjectName: newName, subjectEmail: newEmail,
                paymentResponsibility: newPayment,
                templateId: newTemplateId && newTemplateId !== "none" ? parseInt(newTemplateId) : undefined,
                notes: newNotes || undefined,
              })}
              disabled={!newName || !newEmail || createMutation.isPending}
              data-testid="button-submit-new-verification"
            >
              {createMutation.isPending ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Verifications</DialogTitle>
            <DialogDescription>Upload a CSV file with name and email columns to create multiple verification requests at once.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input id="csv-file" name="file" type="file" accept=".csv" required data-testid="input-csv-file" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select name="type" defaultValue="individual">
                <SelectTrigger data-testid="select-bulk-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Responsibility</Label>
              <Select name="paymentResponsibility" defaultValue="organisation">
                <SelectTrigger data-testid="select-bulk-payment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organisation">Organisation pays</SelectItem>
                  <SelectItem value="subject">Subject pays</SelectItem>
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
    </div>
  );
}

// ─── Sessions Section ─────────────────────────────────────────────────────────

const REQUIRED_STEP_OPTIONS = ["document", "biometric", "bvn", "nin", "aml"];

function SessionsSection({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [selectedSteps, setSelectedSteps] = useState<string[]>(["document", "biometric"]);
  const [expiresInHours, setExpiresInHours] = useState("72");

  const { data: sessionsData, isLoading } = useQuery<{ sessions: any[] }>({
    queryKey: ["/api/kyc-service/orgs", orgId, "sessions"],
    queryFn: () => fetch(`/api/kyc-service/orgs/${orgId}/sessions`, { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiRequest("POST", `/api/kyc-service/orgs/${orgId}/sessions`, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/orgs", orgId, "sessions"] });
      setCreateOpen(false); setSubjectName(""); setSubjectEmail(""); setSelectedSteps(["document", "biometric"]); setExpiresInHours("72");
      const link = data?.sessionLink || data?.session?.sessionToken ? `${window.location.origin}/kyc/session/${data.session?.sessionToken}` : null;
      if (link) {
        navigator.clipboard.writeText(link).catch(() => {});
        toast({ title: "Session created — link copied", description: link.slice(0, 60) + "…" });
      } else {
        toast({ title: "Session created" });
      }
    },
    onError: (e: Error) => toast({ title: "Failed to create session", description: e.message, variant: "destructive" }),
  });

  const SESSION_COLORS: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    expired: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Hosted Sessions</h2>
          <p className="text-sm text-muted-foreground">Shareable verification links for subjects who don't have a Cellion account</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-session">
          <Plus className="h-4 w-4 mr-2" />Create Session
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Hosted Session</DialogTitle>
            <DialogDescription>Generate a unique verification link for a subject. You can share the link directly — they don't need a Cellion account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Ada Obi" data-testid="input-session-name" />
              </div>
              <div className="space-y-2">
                <Label>Subject Email</Label>
                <Input type="email" value={subjectEmail} onChange={(e) => setSubjectEmail(e.target.value)} placeholder="ada@example.com" data-testid="input-session-email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Required Steps</Label>
              <div className="flex flex-wrap gap-3">
                {REQUIRED_STEP_OPTIONS.map(step => (
                  <div key={step} className="flex items-center gap-1.5">
                    <input type="checkbox" id={`step-${step}`} checked={selectedSteps.includes(step)} onChange={(e) => setSelectedSteps(prev => e.target.checked ? [...prev, step] : prev.filter(s => s !== step))} className="rounded" />
                    <label htmlFor={`step-${step}`} className="text-sm capitalize">{step}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expires After</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger data-testid="select-session-expiry"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="48">48 hours</SelectItem>
                  <SelectItem value="72">72 hours</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate({ subjectName, subjectEmail, requiredSteps: selectedSteps, expiresInHours: parseInt(expiresInHours) })} disabled={!subjectName.trim() || !subjectEmail.trim() || selectedSteps.length === 0 || createMutation.isPending} data-testid="button-submit-session">
              {createMutation.isPending ? "Creating…" : "Create & Copy Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !sessionsData || sessionsData.sessions.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No sessions yet"
              description="Create sessions via the API. Each session generates a unique hosted verification link."
              action={<Button asChild size="sm"><a href="/api-docs#hosted-sessions">Read the API Docs</a></Button>}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsData.sessions.map((s: any) => (
                    <TableRow key={s.id} data-testid={`row-session-${s.id}`}>
                      <TableCell>
                        <p className="font-medium text-sm">{s.subjectName}</p>
                        <p className="text-xs text-muted-foreground">{s.subjectEmail}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("border-0 capitalize", SESSION_COLORS[s.status] || "")} data-testid={`badge-session-${s.id}`}>
                          {(s.status || "").replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(s.requiredSteps || []).map((step: string) => (
                            <span key={step} className="text-xs bg-muted px-1.5 py-0.5 rounded">{step}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(s.status === "pending" || s.status === "in_progress") ? (
                          <Button variant="ghost" size="icon" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/verify/${s.sessionToken}`);
                            toast({ title: "Link copied" });
                          }} data-testid={`button-copy-session-${s.id}`}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : <span className="text-xs text-muted-foreground px-3">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Users (Verified Registry) Section ───────────────────────────────────────

const COMPLETED_STATUSES = ["verified", "rejected", "expired"];
const RESULT_COLORS: Record<string, string> = {
  verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-muted text-muted-foreground",
};
const RESULT_ICONS: Record<string, typeof CheckCircle2> = {
  verified: CheckCircle2,
  rejected: XCircle,
  expired: Clock,
};

function UsersSection({ orgId }: { orgId: string }) {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("all");

  const { data: requests, isLoading } = useQuery<KycVerificationRequest[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"],
  });

  const completed = (requests || []).filter(r => COMPLETED_STATUSES.includes(r.status));

  const deduplicated = (() => {
    const byEmail = new Map<string, KycVerificationRequest>();
    const STATUS_PRIORITY: Record<string, number> = { verified: 0, rejected: 1, expired: 2 };
    completed.forEach(r => {
      const key = r.subjectEmail.toLowerCase();
      const existing = byEmail.get(key);
      if (!existing) { byEmail.set(key, r); return; }
      const curPriority = STATUS_PRIORITY[r.status] ?? 99;
      const exPriority = STATUS_PRIORITY[existing.status] ?? 99;
      if (curPriority < exPriority) byEmail.set(key, r);
    });
    return Array.from(byEmail.values());
  })();

  const filtered = deduplicated.filter(r => {
    if (resultFilter !== "all" && r.status !== resultFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return r.subjectName.toLowerCase().includes(q) || r.subjectEmail.toLowerCase().includes(q);
  });

  function exportCsv() {
    const rows = [["Name", "Email", "Type", "Result", "Date Completed"]];
    filtered.forEach(r => rows.push([r.subjectName, r.subjectEmail, r.type, r.status, r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ""]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "users-registry.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Users Registry</h2>
          <p className="text-sm text-muted-foreground">{deduplicated.length} unique subject{deduplicated.length !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search subjects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-users" />
            </div>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-result-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No completed verifications" description={completed.length > 0 ? "No results match your filters." : "Completed verifications will appear here."} />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const ResultIcon = RESULT_ICONS[r.status] || CheckCircle2;
                    return (
                      <TableRow key={r.id} data-testid={`row-user-${r.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ResultIcon className={cn("h-4 w-4 shrink-0", r.status === "verified" ? "text-green-500" : r.status === "rejected" ? "text-red-500" : "text-muted-foreground")} />
                            <div>
                              <p className="font-medium text-sm">{r.subjectName}</p>
                              <p className="text-xs text-muted-foreground">{r.subjectEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="border-0 capitalize">{r.type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("border-0 capitalize", RESULT_COLORS[r.status] || "")} data-testid={`badge-result-${r.id}`}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild data-testid={`button-view-user-${r.id}`}>
                            <Link href={`/kyc/org/${orgId}/requests/${r.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
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
    </div>
  );
}

// ─── Monitoring Section ───────────────────────────────────────────────────────

function MonitoringSection({ orgId }: { orgId: string }) {
  const { data: expiryData, isLoading: expiryLoading } = useQuery<{ alerts: any[]; count: number }>({
    queryKey: ["/api/kyc-service/orgs", orgId, "expiry-alerts"],
    queryFn: () => fetch(`/api/kyc-service/orgs/${orgId}/expiry-alerts`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: sanctionsData, isLoading: sanctionsLoading } = useQuery<{ logs: any[] }>({
    queryKey: ["/api/kyc-service/orgs", orgId, "sanctions-logs"],
    queryFn: () => fetch(`/api/kyc-service/orgs/${orgId}/sanctions-logs`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Monitoring</h2>
        <p className="text-sm text-muted-foreground">Document expiry alerts and sanctions/AML screening</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Document Expiry Alerts
            {expiryData && expiryData.count > 0 && (
              <Badge variant="destructive" className="ml-1 border-0">{expiryData.count}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expiryLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !expiryData || expiryData.alerts.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              All verified documents are valid — no expiry alerts.
            </div>
          ) : (
            <div className="space-y-2">
              {expiryData.alerts.map((alert: any) => (
                <div key={alert.docId} className={cn("flex items-center justify-between gap-4 p-3 rounded-lg border", alert.isExpired ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20" : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20")} data-testid={`alert-expiry-${alert.docId}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    {alert.isExpired ? <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.subjectName}</p>
                      <p className="text-xs text-muted-foreground truncate">{alert.docFileName}</p>
                      <p className={cn("text-xs font-medium mt-0.5", alert.isExpired ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>
                        {alert.isExpired ? `Expired ${Math.abs(alert.daysLeft)} day(s) ago` : `Expires in ${alert.daysLeft} day(s)`}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link href={`/kyc/org/${orgId}/requests/${alert.requestId}`}><Eye className="h-3.5 w-3.5 mr-1.5" />View</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Sanctions &amp; AML Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sanctionsLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !sanctionsData || sanctionsData.logs.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No screening runs recorded yet. Automated weekly screening is managed by Cellion One.</p>
              <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 border">
                Sanctions monitoring runs weekly when enabled. Contact <a href="mailto:service@cellionone.com" className="underline">service@cellionone.com</a> to activate.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Last Screened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sanctionsData.logs.slice(0, 20).map((log: any) => (
                    <TableRow key={log.id} data-testid={`row-sanctions-${log.id}`}>
                      <TableCell className="text-sm font-medium">{log.subjectName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("border-0", log.screeningResult === "alert" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400")}>
                          {log.screeningResult === "alert" ? "Alert" : "Clear"}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("text-sm font-medium capitalize", log.newRiskScore === "red" ? "text-red-500" : log.newRiskScore === "amber" ? "text-amber-500" : "text-green-600")}>
                        {log.newRiskScore || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Analytics Section ────────────────────────────────────────────────────────

const CHART_COLORS = ["hsl(156,72%,35%)", "hsl(0,75%,60%)", "hsl(220,70%,55%)", "hsl(40,85%,55%)"];

function AnalyticsSection({ orgId }: { orgId: string }) {
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("week");

  const { data: requests, isLoading } = useQuery<KycVerificationRequest[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"],
  });

  const allReqs = requests || [];

  const volumeData = (() => {
    if (!allReqs.length) return [];
    const buckets: Record<string, number> = {};
    allReqs.forEach(r => {
      if (!r.createdAt) return;
      const d = new Date(r.createdAt);
      let key: string;
      if (granularity === "day") key = d.toISOString().slice(0, 10);
      else if (granularity === "week") {
        const dow = d.getDay();
        const monday = new Date(d); monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        key = monday.toISOString().slice(0, 10);
      } else key = d.toISOString().slice(0, 7);
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([label, count]) => ({ label, count }));
  })();

  const statusBreakdown = [
    { name: "Verified", value: allReqs.filter(r => r.status === "verified").length, color: CHART_COLORS[0] },
    { name: "Rejected", value: allReqs.filter(r => r.status === "rejected").length, color: CHART_COLORS[1] },
    { name: "In Progress", value: allReqs.filter(r => ["in_progress", "under_review", "documents_submitted"].includes(r.status)).length, color: CHART_COLORS[2] },
    { name: "Other", value: allReqs.filter(r => ["pending_invite", "pending_payment", "expired"].includes(r.status)).length, color: CHART_COLORS[3] },
  ].filter(d => d.value > 0);

  const typeBreakdown = [
    { name: "Individual", count: allReqs.filter(r => r.type === "individual").length },
    { name: "Supplier", count: allReqs.filter(r => r.type === "supplier").length },
  ];

  const avgTimeData = (() => {
    const buckets: Record<string, { totalMs: number; count: number }> = {};
    allReqs
      .filter(r => ["verified", "rejected"].includes(r.status) && r.createdAt && r.updatedAt)
      .forEach(r => {
        const d = new Date(r.createdAt!);
        let key: string;
        if (granularity === "day") key = d.toISOString().slice(0, 10);
        else if (granularity === "week") {
          const dow = d.getDay();
          const monday = new Date(d); monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
          key = monday.toISOString().slice(0, 10);
        } else key = d.toISOString().slice(0, 7);
        if (!buckets[key]) buckets[key] = { totalMs: 0, count: 0 };
        buckets[key].totalMs += new Date(r.updatedAt!).getTime() - d.getTime();
        buckets[key].count += 1;
      });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([label, { totalMs, count }]) => ({
        label,
        avgDays: parseFloat((totalMs / count / (1000 * 60 * 60 * 24)).toFixed(1)),
      }));
  })();

  if (isLoading) return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>;

  const avgTimeDays = (() => {
    const done = allReqs.filter(r => ["verified", "rejected"].includes(r.status) && r.createdAt && r.updatedAt);
    if (!done.length) return null;
    const totalMs = done.reduce((sum, r) => sum + (new Date(r.updatedAt!).getTime() - new Date(r.createdAt!).getTime()), 0);
    return (totalMs / done.length / (1000 * 60 * 60 * 24)).toFixed(1);
  })();

  if (!allReqs.length) return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Analytics</h2>
      <EmptyState icon={BarChart3} title="No data yet" description="Analytics will appear once you have verification requests." />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Analytics</h2>
          <p className="text-sm text-muted-foreground">Verification trends and performance metrics</p>
        </div>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as "day" | "week" | "month")}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Total", value: allReqs.length, color: "" },
          { label: "Verified", value: allReqs.filter(r => r.status === "verified").length, color: "text-green-600 dark:text-green-400" },
          { label: "Rejected", value: allReqs.filter(r => r.status === "rejected").length, color: "text-red-600 dark:text-red-400" },
          { label: "Avg Days to Result", value: avgTimeDays !== null ? `${avgTimeDays}d` : "—", color: "text-blue-600 dark:text-blue-400" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-2xl font-bold mt-1", color)} data-testid={`analytics-stat-${label.toLowerCase().replace(/ /g, "-")}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Verification Volume Over Time</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volumeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }} />
              <Line type="monotone" dataKey="count" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Verifications" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No data</p> : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
                      {statusBreakdown.map((_, idx) => <Cell key={idx} fill={_.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {statusBreakdown.map((d) => (
                    <div key={d.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-xs text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="text-xs font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Verification Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={typeBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }} />
                <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4,4,0,0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {avgTimeData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Average Processing Time (Days to Result)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={avgTimeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} unit="d" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                  formatter={(v: number) => [`${v} days`, "Avg Time"]}
                />
                <Bar dataKey="avgDays" fill={CHART_COLORS[2]} radius={[4,4,0,0]} name="Avg Days" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Developers Section ───────────────────────────────────────────────────────

function DevelopersSection({ orgId, org }: { orgId: string; org: OrgWithStats | undefined }) {
  const [devTab, setDevTab] = useState<"keys" | "webhooks" | "quickstart" | "status">("keys");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Developers</h2>
        <p className="text-sm text-muted-foreground">API keys, webhooks, quickstart guide, and API status</p>
      </div>
      <Tabs value={devTab} onValueChange={(v) => setDevTab(v as "keys" | "webhooks" | "quickstart" | "status")}>
        <TabsList>
          <TabsTrigger value="keys" data-testid="dev-tab-keys"><Key className="h-3.5 w-3.5 mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="webhooks" data-testid="dev-tab-webhooks"><Webhook className="h-3.5 w-3.5 mr-1.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="quickstart" data-testid="dev-tab-quickstart"><Terminal className="h-3.5 w-3.5 mr-1.5" />Quickstart</TabsTrigger>
          <TabsTrigger value="status" data-testid="dev-tab-status"><Activity className="h-3.5 w-3.5 mr-1.5" />API Status</TabsTrigger>
        </TabsList>
        <TabsContent value="keys" className="mt-4"><ApiKeysPanel orgId={orgId} org={org} /></TabsContent>
        <TabsContent value="webhooks" className="mt-4"><WebhooksPanel orgId={orgId} /></TabsContent>
        <TabsContent value="quickstart" className="mt-4"><QuickstartPanel org={org} /></TabsContent>
        <TabsContent value="status" className="mt-4"><ApiStatusPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

type IntegrationProfile = {
  mode: string;
  verificationLocation: string;
  requiresBiometric: boolean;
  resultTiming: string;
  configuredAt?: string;
};

function ApiKeysPanel({ orgId, org }: { orgId: string; org: OrgWithStats | undefined }) {
  const [showKey, setShowKey] = useState<Record<number, boolean>>({});
  const [genName, setGenName] = useState("");
  const { toast } = useToast();
  const profile = org?.integrationProfile as IntegrationProfile | null | undefined;

  const { data: keys, isLoading } = useQuery<KycApiKey[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "api-keys"],
  });

  const genMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/api-keys`, { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "api-keys"] });
      setGenName("");
      toast({ title: "API key generated", description: `Key: ${data.rawKey || ""}. Copy it now — it won't be shown again.` });
    },
    onError: (e: Error) => toast({ title: "Failed to generate key", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/api-keys/${keyId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "api-keys"] });
      toast({ title: "API key revoked" });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (keyId: number) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/api-keys/${keyId}/rotate`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "api-keys"] });
      toast({ title: "Key rotated", description: `New key: ${data.rawKey || ""}. Copy it now.` });
    },
    onError: (e: Error) => toast({ title: "Rotation failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" />API Keys</CardTitle>
        <CardDescription>
          Generate keys to authenticate API requests. Keys are shown once — copy them immediately.
          {profile?.mode && (
            <span className="ml-2">
              Integration scope: <Badge variant="secondary" className="border-0 capitalize ml-1">{profile.mode.replace(/_/g, " ")}</Badge>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={genName} onChange={(e) => setGenName(e.target.value)} placeholder="Key name (e.g. Production)" className="max-w-xs" data-testid="input-key-name" />
          <Button onClick={() => genMutation.mutate(genName)} disabled={!genName.trim() || genMutation.isPending} data-testid="button-generate-key">
            {genMutation.isPending ? "Generating..." : "Generate Key"}
          </Button>
        </div>

        {profile && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50 border text-xs">
            <span className="text-muted-foreground">Profile:</span>
            <span><strong>Mode:</strong> {profile.mode?.replace(/_/g, " ")}</span>
            <span><strong>Location:</strong> {profile.verificationLocation}</span>
            <span><strong>Biometric:</strong> {profile.requiresBiometric ? "Yes" : "No"}</span>
            <span><strong>Result:</strong> {profile.resultTiming}</span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !keys || keys.length === 0 ? (
          <EmptyState icon={Key} title="No API keys" description="Generate your first API key to start integrating." />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} data-testid={`row-key-${k.id}`}>
                    <TableCell className="font-medium text-sm">{k.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs text-muted-foreground font-mono">
                          {showKey[k.id] ? k.keyPrefix + "..." : "••••••••" + k.keyPrefix?.slice(-4)}
                        </code>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowKey(s => ({ ...s, [k.id]: !s[k.id] }))}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="border-0 text-xs capitalize">
                        {profile?.mode?.replace(/_/g, " ") || "all"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Rotate key" onClick={() => rotateMutation.mutate(k.id)} disabled={rotateMutation.isPending} data-testid={`button-rotate-key-${k.id}`}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Revoke key" onClick={() => revokeMutation.mutate(k.id)} disabled={revokeMutation.isPending} data-testid={`button-revoke-key-${k.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ALL_WEBHOOK_EVENTS = ["verification.completed", "verification.failed", "session.expired", "session.completed"];

function WebhooksPanel({ orgId }: { orgId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editWh, setEditWh] = useState<KycWebhookConfig | null>(null);
  const [historyWhId, setHistoryWhId] = useState<number | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["verification.completed"]);
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: webhooks, isLoading } = useQuery<KycWebhookConfig[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"],
  });

  const { data: deliveries } = useQuery<any[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "webhooks", historyWhId, "deliveries"],
    queryFn: () => historyWhId ? fetch(`/api/kyc-service/organisations/${orgId}/webhooks/${historyWhId}/deliveries`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: historyWhId !== null,
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/webhooks`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"] });
      setAddOpen(false); setNewUrl(""); setNewEvents(["verification.completed"]);
      toast({ title: "Webhook added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add webhook", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ whId, data }: { whId: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}/webhooks/${whId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"] });
      setEditWh(null);
      toast({ title: "Webhook updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update webhook", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (whId: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/webhooks/${whId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"] });
      toast({ title: "Webhook removed" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (whId: number) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/webhooks/${whId}/test`, {});
      return res.json();
    },
    onSuccess: () => toast({ title: "Test event sent" }),
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  function openEdit(wh: KycWebhookConfig) {
    setEditWh(wh);
    setEditUrl(wh.url || "");
    setEditEvents([...(wh.events || [])]);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" />Webhooks</CardTitle>
            <CardDescription>Receive real-time event notifications at your endpoint URLs.</CardDescription>
          </div>
          <Button onClick={() => setAddOpen(true)} data-testid="button-add-webhook">
            <Plus className="h-4 w-4 mr-2" />Add Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !webhooks || webhooks.length === 0 ? (
          <EmptyState icon={Webhook} title="No webhooks" description="Add a webhook to receive verification events." />
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border" data-testid={`card-webhook-${wh.id}`}>
                <div className="min-w-0 space-y-1">
                  <code className="text-xs font-mono text-foreground truncate block">{wh.url}</code>
                  <div className="flex flex-wrap gap-1">
                    {(wh.events || []).map((ev: string) => (
                      <span key={ev} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{ev}</span>
                    ))}
                  </div>
                  <Badge variant={wh.isActive ? "default" : "secondary"} className="text-xs border-0">
                    {wh.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setHistoryWhId(prev => prev === wh.id ? null : wh.id)} data-testid={`button-history-webhook-${wh.id}`}>
                    History
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => testMutation.mutate(wh.id)} disabled={testMutation.isPending} data-testid={`button-test-webhook-${wh.id}`}>
                    Test
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(wh)} data-testid={`button-edit-webhook-${wh.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(wh.id)} data-testid={`button-delete-webhook-${wh.id}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {historyWhId !== null && (
          <div className="mt-4 rounded-lg border">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
              <span className="text-xs font-semibold">Delivery History</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setHistoryWhId(null)}>Close</Button>
            </div>
            {!deliveries ? (
              <div className="p-3 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : deliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No deliveries recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Response</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.slice(0, 10).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs font-mono">{d.eventType}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("border-0 text-xs", d.responseStatus >= 200 && d.responseStatus < 300 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                          {d.responseStatus || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.responseTime ? `${d.responseTime}ms` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>Enter an HTTPS URL to receive verification event payloads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://yourapp.com/webhooks/kyc" data-testid="input-webhook-url" />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {ALL_WEBHOOK_EVENTS.map(ev => (
                  <div key={ev} className="flex items-center gap-2">
                    <input type="checkbox" id={`new-${ev}`} checked={newEvents.includes(ev)} onChange={(e) => setNewEvents(prev => e.target.checked ? [...prev, ev] : prev.filter(x => x !== ev))} className="rounded" />
                    <label htmlFor={`new-${ev}`} className="text-sm font-mono">{ev}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addMutation.mutate({ url: newUrl, events: newEvents })} disabled={!newUrl || newEvents.length === 0 || addMutation.isPending} data-testid="button-submit-webhook">
              {addMutation.isPending ? "Adding..." : "Add Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editWh !== null} onOpenChange={() => setEditWh(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update the endpoint URL or subscribed events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} data-testid="input-edit-webhook-url" />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {ALL_WEBHOOK_EVENTS.map(ev => (
                  <div key={ev} className="flex items-center gap-2">
                    <input type="checkbox" id={`edit-${ev}`} checked={editEvents.includes(ev)} onChange={(e) => setEditEvents(prev => e.target.checked ? [...prev, ev] : prev.filter(x => x !== ev))} className="rounded" />
                    <label htmlFor={`edit-${ev}`} className="text-sm font-mono">{ev}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => editWh && editMutation.mutate({ whId: editWh.id, data: { url: editUrl, events: editEvents } })} disabled={!editUrl || editEvents.length === 0 || editMutation.isPending} data-testid="button-submit-edit-webhook">
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function QuickstartPanel({ org }: { org: OrgWithStats | undefined }) {
  const { toast } = useToast();
  const profile = org?.integrationProfile as IntegrationProfile | null | undefined;
  const mode = profile?.mode || "full_hosted";

  const prefillExamples: Record<string, string> = {
    full_hosted: "  // No prefill needed — subject completes everything",
    prefill_selfie: `  "prefill": { "firstName": "Ada", "lastName": "Obi", "dateOfBirth": "1990-01-15", "documentType": "national_id", "idNumber": "12345678901" },`,
    selfie_only: `  "prefill": { "firstName": "Ada", "lastName": "Obi", "dateOfBirth": "1990-01-15", "documentType": "national_id", "idNumber": "12345678901", "idDocumentUrl": "https://..." },`,
    data_collection: `  "requiredSteps": ["identity", "documents"],`,
  };

  const jsCode = `const response = await fetch("https://cellionone.com/api/v1/kyc/sessions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    "subjectName": "Ada Obi",
    "subjectEmail": "ada@example.com",
    "returnUrl": "https://yourapp.com/kyc-done",
${prefillExamples[mode]}
  })
});
const { sessionUrl } = await response.json();
// Redirect subject to sessionUrl`;

  const curlCode = `curl -X POST https://cellionone.com/api/v1/kyc/sessions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subjectName": "Ada Obi",
    "subjectEmail": "ada@example.com",
    "returnUrl": "https://yourapp.com/kyc-done"
  }'`;

  function copyCode(code: string, label: string) {
    navigator.clipboard.writeText(code);
    toast({ title: `${label} code copied to clipboard` });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Terminal className="h-4 w-4" />Quickstart</CardTitle>
        <CardDescription>
          Code snippet for your integration profile: <Badge variant="secondary" className="border-0 ml-1 capitalize">{mode.replace(/_/g, " ")}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b">
            <span className="text-xs font-semibold">JavaScript / Node.js</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyCode(jsCode, "JavaScript")} data-testid="button-copy-js">
              <Copy className="h-3 w-3 mr-1" />Copy
            </Button>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed text-foreground bg-card">{jsCode}</pre>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b">
            <span className="text-xs font-semibold">cURL</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyCode(curlCode, "cURL")} data-testid="button-copy-curl">
              <Copy className="h-3 w-3 mr-1" />Copy
            </Button>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed text-foreground bg-card">{curlCode}</pre>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span>Read the <a href="/api-docs" className="underline text-foreground hover:text-primary">full API documentation</a> for all endpoints, parameters, and webhook payloads.</span>
        </div>
      </CardContent>
    </Card>
  );
}

const API_STATUS_POLL_INTERVAL_MS = 30_000;

function ApiStatusPanel() {
  const [status, setStatus] = useState<"checking" | "operational" | "degraded">("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  function checkHealth() {
    setStatus("checking");
    fetch("/api/health", { credentials: "include" })
      .then(r => { setStatus(r.ok ? "operational" : "degraded"); setLastChecked(new Date()); })
      .catch(() => { setStatus("degraded"); setLastChecked(new Date()); });
  }

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, API_STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    checking: { label: "Checking...", color: "text-muted-foreground", bg: "bg-muted/50", dot: "bg-muted-foreground animate-pulse" },
    operational: { label: "All Systems Operational", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", dot: "bg-green-500 animate-pulse" },
    degraded: { label: "Degraded — Contact Support", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", dot: "bg-red-500" },
  }[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />API Status</CardTitle>
        <CardDescription>
          Live health check · auto-refreshes every 30 seconds
          {lastChecked && <span className="ml-2 text-xs">Last checked: {lastChecked.toLocaleTimeString()}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn("flex items-center gap-3 p-4 rounded-lg", statusConfig.bg)}>
          <div className={cn("h-3 w-3 rounded-full shrink-0", statusConfig.dot)} />
          <p className={cn("font-medium", statusConfig.color)}>{statusConfig.label}</p>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={checkHealth} disabled={status === "checking"} data-testid="button-refresh-status">
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", status === "checking" && "animate-spin")} />
          {status === "checking" ? "Checking..." : "Refresh Now"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Billing Section ──────────────────────────────────────────────────────────

const BILLING_PAGE_SIZE = 20;

function BillingSection({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [topUpQty, setTopUpQty] = useState(50);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [billingPage, setBillingPage] = useState(0);

  const { data: billing, isLoading } = useQuery<any>({
    queryKey: ["/api/kyc-service/organisations", orgId, "billing"],
  });
  const { data: transactions } = useQuery<any[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "billing", "transactions"],
    queryFn: () => fetch(`/api/kyc-service/organisations/${orgId}/billing/transactions?limit=100`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: requests } = useQuery<KycVerificationRequest[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "verification-requests"],
  });

  const usageRows = (() => {
    const completed = (requests || []).filter(r => ["verified", "rejected"].includes(r.status));
    const CREDIT_COST: Record<string, number> = { individual: 1, supplier: 2 };
    return completed
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .map(r => ({ ...r, creditCost: CREDIT_COST[r.type] ?? 1 }));
  })();

  const totalBillingPages = Math.ceil(usageRows.length / BILLING_PAGE_SIZE);
  const pageUsageRows = usageRows.slice(billingPage * BILLING_PAGE_SIZE, (billingPage + 1) * BILLING_PAGE_SIZE);

  const usageByType = {
    individual: usageRows.filter(r => r.type === "individual").length,
    supplier: usageRows.filter(r => r.type === "supplier").length,
    total: usageRows.length,
  };

  function exportUsageCsv() {
    if (!usageRows.length) return;
    const rows = [["Subject Name", "Subject Email", "Type", "Result", "Credits Used", "Date Completed"]];
    usageRows.forEach(r => rows.push([
      r.subjectName, r.subjectEmail, r.type, r.status,
      String(r.creditCost),
      r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "",
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "kyc-usage-history.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const purchaseMutation = useMutation({
    mutationFn: async (qty: number) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/billing/purchase-credits`, { quantity: qty });
      return res.json();
    },
    onSuccess: (data) => {
      setTopUpOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "billing"] });
      if (data.authorizationUrl) window.location.href = data.authorizationUrl;
      else toast({ title: "Credits purchase initiated" });
    },
    onError: (e: Error) => toast({ title: "Purchase failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Billing</h2>
        <p className="text-sm text-muted-foreground">Credit balance, usage history, and top-up</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Credit Balance</p>
                {isLoading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                  <p className="text-3xl font-bold text-primary mt-1" data-testid="text-credit-balance">
                    {billing?.creditBalance ?? 0}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">credits available</p>
              </div>
              <CreditCard className="h-8 w-8 text-primary/40" />
            </div>
            <Button className="mt-4 w-full" onClick={() => setTopUpOpen(true)} data-testid="button-top-up">
              Top Up Credits
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm font-medium">Billing Type</p>
            {isLoading ? <Skeleton className="h-6 w-24" /> : (
              <Badge variant="secondary" className="border-0 capitalize" data-testid="badge-billing-type">
                {billing?.billingMode?.replace("_", " ") || "Pay as you go"}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">Each verification consumes 1 credit. Credits are pre-purchased and deducted automatically.</p>
          </CardContent>
        </Card>
      </div>

      {usageByType.total > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Usage Breakdown by Type</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total Processed", value: usageByType.total, color: "text-foreground" },
                { label: "Individual", value: usageByType.individual, color: "text-blue-600 dark:text-blue-400" },
                { label: "Supplier", value: usageByType.supplier, color: "text-purple-600 dark:text-purple-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-muted/40 p-3 border">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("text-xl font-bold mt-1", color)}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">verifications</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Verification Usage History</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">One row per completed verification (verified or rejected) · 1 credit per individual, 2 per supplier</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportUsageCsv} disabled={!usageRows.length} data-testid="button-export-usage">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!requests ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : usageRows.length === 0 ? (
            <EmptyState icon={CreditCard} title="No usage yet" description="Completed verifications will appear here as credits are consumed." />
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageUsageRows.map((r) => (
                      <TableRow key={r.id} data-testid={`row-usage-${r.id}`}>
                        <TableCell>
                          <p className="text-sm font-medium">{r.subjectName}</p>
                          <p className="text-xs text-muted-foreground">{r.subjectEmail}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="border-0 capitalize text-xs">{r.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("border-0 capitalize text-xs", RESULT_COLORS[r.status] || "")}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          -{r.creditCost}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalBillingPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Page {billingPage + 1} of {totalBillingPages} · {usageRows.length} verifications
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={billingPage === 0} onClick={() => setBillingPage(p => p - 1)} data-testid="button-billing-prev">Previous</Button>
                    <Button variant="outline" size="sm" disabled={billingPage >= totalBillingPages - 1} onClick={() => setBillingPage(p => p + 1)} data-testid="button-billing-next">Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top Up Credits</DialogTitle>
            <DialogDescription>Purchase verification credits. Each credit covers one complete verification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Number of Credits</Label>
              <Select value={String(topUpQty)} onValueChange={(v) => setTopUpQty(Number(v))}>
                <SelectTrigger data-testid="select-topup-qty"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 credits</SelectItem>
                  <SelectItem value="50">50 credits</SelectItem>
                  <SelectItem value="100">100 credits</SelectItem>
                  <SelectItem value="250">250 credits</SelectItem>
                  <SelectItem value="500">500 credits</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => purchaseMutation.mutate(topUpQty)} disabled={purchaseMutation.isPending} data-testid="button-confirm-topup">
              {purchaseMutation.isPending ? "Processing..." : `Buy ${topUpQty} Credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Team Section ─────────────────────────────────────────────────────────────

function TeamSection({ orgId, org }: { orgId: string; org: OrgWithStats | undefined }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("org_reviewer");
  const { toast } = useToast();

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/members`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      setInviteOpen(false); setInviteEmail(""); setInviteRole("org_reviewer");
      toast({ title: "Invitation sent" });
    },
    onError: (e: Error) => toast({ title: "Invite failed", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/members/${memberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      toast({ title: "Member removed" });
    },
    onError: (e: Error) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}/members/${memberId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      toast({ title: "Role updated" });
    },
    onError: (e: Error) => toast({ title: "Role change failed", description: e.message, variant: "destructive" }),
  });

  const members = org?.members || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Team</h2>
          <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} data-testid="button-invite-member">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {members.length === 0 ? (
            <EmptyState icon={Users} title="No team members" description="Invite colleagues to collaborate on verifications." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m: KycOrgMember) => {
                    const isOwner = m.userId === org?.createdByUserId;
                    return (
                      <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                        <TableCell className="text-sm">{m.inviteEmail}</TableCell>
                        <TableCell>
                          {isOwner ? (
                            <Badge variant="secondary" className="border-0">Owner</Badge>
                          ) : (
                            <Select
                              value={m.role}
                              onValueChange={(newRole) => changeRoleMutation.mutate({ memberId: m.id, role: newRole })}
                              disabled={changeRoleMutation.isPending}
                            >
                              <SelectTrigger className="h-7 w-[120px] text-xs" data-testid={`select-role-${m.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="org_admin">Admin</SelectItem>
                                <SelectItem value="org_reviewer">Reviewer</SelectItem>
                                <SelectItem value="org_viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("border-0", m.inviteStatus === "accepted" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400")}>
                            {m.inviteStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isOwner && (
                            <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(m.id)} disabled={removeMutation.isPending} data-testid={`button-remove-member-${m.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>They'll receive an email to join your organisation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" data-testid="input-invite-email" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org_admin">Admin</SelectItem>
                  <SelectItem value="org_reviewer">Reviewer</SelectItem>
                  <SelectItem value="org_viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })} disabled={!inviteEmail || inviteMutation.isPending} data-testid="button-submit-invite">
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Settings Section ─────────────────────────────────────────────────────────

function SettingsSection({ orgId, org }: { orgId: string; org: OrgWithStats | undefined }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [employeePortal, setEmployeePortal] = useState(true);
  const [supplierPortal, setSupplierPortal] = useState(true);

  // Document Requirements state
  const [addReqOpen, setAddReqOpen] = useState(false);
  const [newReqName, setNewReqName] = useState("");
  const [newReqDesc, setNewReqDesc] = useState("");
  const [newReqType, setNewReqType] = useState("individual");
  const [newReqCategory, setNewReqCategory] = useState("identity");
  const [newReqMandatory, setNewReqMandatory] = useState(true);
  const [newReqExpiry, setNewReqExpiry] = useState(false);

  // Templates state
  const [addTmplOpen, setAddTmplOpen] = useState(false);
  const [newTmplName, setNewTmplName] = useState("");
  const [newTmplType, setNewTmplType] = useState("individual");
  const [newTmplDesc, setNewTmplDesc] = useState("");
  const [newTmplDirector, setNewTmplDirector] = useState(false);
  const [newTmplDefault, setNewTmplDefault] = useState(false);

  // Integration Profile state
  const [selectedMode, setSelectedMode] = useState<"full_hosted" | "prefill_selfie" | "selfie_only" | "data_collection" | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<"hosted" | "embedded" | "headless" | null>(null);

  useEffect(() => {
    if (org) {
      setName(org.name || "");
      setEmail(org.contactEmail || "");
      setPhone(org.contactPhone || "");
      setAddress(org.address || "");
      setEmployeePortal(org.employeePortalEnabled ?? true);
      setSupplierPortal(org.supplierPortalEnabled ?? true);
      if (org.integrationProfile?.mode) setSelectedMode(org.integrationProfile.mode as "full_hosted" | "prefill_selfie" | "selfie_only" | "data_collection");
      if (org.integrationProfile?.verificationLocation) setSelectedLocation(org.integrationProfile.verificationLocation as "hosted" | "embedded" | "headless");
    }
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const { data: requirements } = useQuery<KycDocumentRequirement[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"],
  });

  const { data: templates } = useQuery<KycVerificationTemplate[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "templates"],
  });

  const addReqMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/document-requirements`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"] });
      setAddReqOpen(false);
      setNewReqName(""); setNewReqDesc("");
      toast({ title: "Requirement added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add requirement", description: e.message, variant: "destructive" }),
  });

  const deleteReqMutation = useMutation({
    mutationFn: async (reqId: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/document-requirements/${reqId}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"] }),
    onError: (e: Error) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  const toggleReqMutation = useMutation({
    mutationFn: async ({ reqId, data }: { reqId: number; data: object }) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}/document-requirements/${reqId}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const addTmplMutation = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/templates`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "templates"] });
      setAddTmplOpen(false);
      setNewTmplName(""); setNewTmplDesc(""); setNewTmplDirector(false); setNewTmplDefault(false);
      toast({ title: "Template created" });
    },
    onError: (e: Error) => toast({ title: "Failed to create template", description: e.message, variant: "destructive" }),
  });

  const deleteTmplMutation = useMutation({
    mutationFn: async (tid: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/templates/${tid}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "templates"] }),
    onError: (e: Error) => toast({ title: "Failed to delete template", description: e.message, variant: "destructive" }),
  });

  const integrationProfiles: { mode: "full_hosted" | "prefill_selfie" | "selfie_only" | "data_collection"; label: string; description: string; steps: string[]; timing: string; resultTiming: "instant" | "webhook"; requiresBiometric: boolean; icon: React.ElementType; timingColor: string; }[] = [
    { mode: "full_hosted", label: "Full Hosted", description: "Customer provides identity details, ID document, and liveness selfie. Best for onboarding flows with no prior data.", steps: ["Identity details", "ID document upload", "Liveness selfie"], timing: "~2–5 min (webhook)", resultTiming: "webhook", requiresBiometric: true, timingColor: "text-amber-600 dark:text-amber-400", icon: Layers },
    { mode: "prefill_selfie", label: "Prefill + Selfie", description: "Your system prefills name/DOB. The subject uploads their ID and takes a selfie.", steps: ["ID document upload", "Liveness selfie"], timing: "~1–2 min (webhook)", resultTiming: "webhook", requiresBiometric: true, timingColor: "text-blue-600 dark:text-blue-400", icon: ScanFace },
    { mode: "selfie_only", label: "Selfie Only", description: "You have all document data. Subject takes a liveness selfie only for biometric matching.", steps: ["Liveness selfie only"], timing: "~30 sec (webhook)", resultTiming: "webhook", requiresBiometric: true, timingColor: "text-green-600 dark:text-green-400", icon: Camera },
    { mode: "data_collection", label: "Data Collection", description: "Subjects provide identity details and upload an ID document. No selfie — instant API result.", steps: ["Identity details", "ID document upload"], timing: "Instant result", resultTiming: "instant", requiresBiometric: false, timingColor: "text-violet-600 dark:text-violet-400", icon: FileText },
  ];

  function handleSaveIntegrationProfile() {
    if (!selectedMode) return;
    const profile = integrationProfiles.find(p => p.mode === selectedMode)!;
    updateMutation.mutate({
      integrationProfile: {
        mode: selectedMode,
        verificationLocation: selectedLocation ?? "hosted",
        requiresBiometric: profile.requiresBiometric,
        resultTiming: profile.resultTiming,
        configuredAt: new Date().toISOString(),
      },
    });
  }

  const ipChanged = selectedMode !== (org?.integrationProfile?.mode ?? null) || selectedLocation !== (org?.integrationProfile?.verificationLocation ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your organisation profile and portal settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation Profile</CardTitle>
          <CardDescription>Update your organisation name, contact information, and portal access settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Organisation Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-org-name" />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-org-email" />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-org-phone" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-org-address" />
            </div>
          </div>
          <Separator />
          <div className="space-y-4">
            <p className="text-sm font-medium">Portal Access</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Employee Self-Registration</p>
                <p className="text-xs text-muted-foreground">Allow employees to self-register at your portal link</p>
              </div>
              <Switch checked={employeePortal} onCheckedChange={setEmployeePortal} data-testid="switch-employee-portal" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Supplier Self-Registration</p>
                <p className="text-xs text-muted-foreground">Allow suppliers to self-register at your portal link</p>
              </div>
              <Switch checked={supplierPortal} onCheckedChange={setSupplierPortal} data-testid="switch-supplier-portal" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => updateMutation.mutate({ name, contactEmail: email, contactPhone: phone || undefined, address: address || undefined, employeePortalEnabled: employeePortal, supplierPortalEnabled: supplierPortal })} disabled={updateMutation.isPending} data-testid="button-save-settings">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {org && (
        <Card>
          <CardHeader><CardTitle className="text-base">Portal Links</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Employee Portal", path: `/kyc/${org.slug}/employees`, enabled: org.employeePortalEnabled },
                { label: "Supplier Portal", path: `/kyc/${org.slug}/suppliers`, enabled: org.supplierPortalEnabled },
              ].map(({ label, path, enabled }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-36">{label}:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1">{path}</code>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${path}`); }} disabled={!enabled}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild disabled={!enabled}>
                      <a href={path} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Document Requirements ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Document Requirements
            </CardTitle>
            <CardDescription>Manage standard and custom document requirements for your verifications.</CardDescription>
          </div>
          <Button onClick={() => setAddReqOpen(true)} data-testid="button-add-requirement">
            <Plus className="h-4 w-4 mr-2" /> Add Custom
          </Button>
        </CardHeader>
        <CardContent>
          {(!requirements || requirements.length === 0) ? (
            <EmptyState icon={FileText} title="No requirements" description="Standard requirements will appear here." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Mandatory</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((req) => (
                    <TableRow key={req.id} data-testid={`row-req-${req.id}`}>
                      <TableCell className="text-sm font-medium">{req.documentName}</TableCell>
                      <TableCell><Badge variant="secondary" className="border-0">{req.type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{req.documentCategory}</TableCell>
                      <TableCell>
                        <Switch
                          checked={req.isMandatory}
                          onCheckedChange={(checked) => toggleReqMutation.mutate({ reqId: req.id, data: { isMandatory: checked } })}
                          disabled={req.isStandard && !req.orgId}
                          data-testid={`switch-mandatory-${req.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={req.hasExpiry}
                          onCheckedChange={(checked) => toggleReqMutation.mutate({ reqId: req.id, data: { hasExpiry: checked } })}
                          disabled={req.isStandard && !req.orgId}
                          data-testid={`switch-expiry-${req.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="border-0">{req.isStandard ? "Standard" : "Custom"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!req.isStandard && (
                          <Button variant="ghost" size="icon" onClick={() => deleteReqMutation.mutate(req.id)} disabled={deleteReqMutation.isPending} data-testid={`button-delete-req-${req.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Verification Templates ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Verification Templates
            </CardTitle>
            <CardDescription>Create templates to quickly set up verification requests.</CardDescription>
          </div>
          <Button onClick={() => setAddTmplOpen(true)} data-testid="button-add-template">
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        </CardHeader>
        <CardContent>
          {(!templates || templates.length === 0) ? (
            <EmptyState icon={Layers} title="No templates" description="Create verification templates to streamline request creation." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Director Verification</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tmpl) => (
                    <TableRow key={tmpl.id} data-testid={`row-template-${tmpl.id}`}>
                      <TableCell>
                        <p className="text-sm font-medium">{tmpl.name}</p>
                        {tmpl.description && <p className="text-xs text-muted-foreground">{tmpl.description}</p>}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="border-0">{tmpl.type}</Badge></TableCell>
                      <TableCell className="text-sm">{tmpl.requireDirectorVerification ? "Yes" : "No"}</TableCell>
                      <TableCell>{tmpl.isDefault && <Badge variant="secondary" className="border-0">Default</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteTmplMutation.mutate(tmpl.id)} disabled={deleteTmplMutation.isPending} data-testid={`button-delete-template-${tmpl.id}`}>
                          <Trash2 className="h-4 w-4" />
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

      {/* ─── Integration Profile ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Integration Profile
          </CardTitle>
          <CardDescription>
            Choose how much data your system provides when creating a hosted verification session.
            This controls which steps the subject sees in the verification wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {org?.integrationProfile?.mode && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm text-primary font-medium">
                Current profile: <span className="capitalize">{integrationProfiles.find(p => p.mode === org.integrationProfile?.mode)?.label ?? String(org.integrationProfile.mode).replace(/_/g, " ")}</span>
              </p>
            </div>
          )}

          <div className="grid gap-3">
            {integrationProfiles.map((profile) => {
              const Icon = profile.icon;
              const isSelected = selectedMode === profile.mode;
              return (
                <div
                  key={profile.mode}
                  onClick={() => setSelectedMode(profile.mode)}
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                  data-testid={`card-profile-${profile.mode}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{profile.label}</p>
                        {isSelected && <Badge variant="default" className="text-xs">Selected</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{profile.description}</p>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Timer className={`h-3 w-3 ${profile.timingColor}`} />
                          <span className={`text-xs font-medium ${profile.timingColor}`}>{profile.timing}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {profile.steps.map((step) => (
                            <span key={step} className="text-xs bg-muted px-2 py-0.5 rounded-full">{step}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t space-y-3">
            <p className="text-sm font-medium">Where will verification happen?</p>
            <div className="space-y-2">
              {([
                { value: "hosted" as const, label: "Hosted link (Cellion wizard)", desc: "Share a link — subjects verify on Cellion's page" },
                { value: "embedded" as const, label: "Embedded in your app", desc: "Embed the verification flow inside an iframe" },
                { value: "headless" as const, label: "Your own UI (API-driven)", desc: "Build your own interface using the REST API" },
              ]).map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedLocation(value)}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${selectedLocation === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                  data-testid={`button-loc-${value}`}
                >
                  <div className="shrink-0">
                    {selectedLocation === value
                      ? <CheckCircle2 className="h-4 w-4 text-primary" />
                      : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <Zap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How it works with the API</p>
                <p>When you create a session via the API, you can pass a <code className="bg-muted px-1 py-0.5 rounded text-xs">prefill</code> object and this profile determines which wizard steps the subject sees. You can override <code className="bg-muted px-1 py-0.5 rounded text-xs">requiredSteps</code> on a per-session basis.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveIntegrationProfile} disabled={!selectedMode || !ipChanged || updateMutation.isPending} data-testid="button-save-integration-profile">
                {updateMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Document Requirements dialog ─── */}
      <Dialog open={addReqOpen} onOpenChange={setAddReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Requirement</DialogTitle>
            <DialogDescription>Create a custom document requirement for your organisation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input value={newReqName} onChange={(e) => setNewReqName(e.target.value)} placeholder="e.g. Professional Certificate" data-testid="input-req-name" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={newReqDesc} onChange={(e) => setNewReqDesc(e.target.value)} placeholder="Additional details..." data-testid="input-req-desc" />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newReqType} onValueChange={setNewReqType}>
                  <SelectTrigger data-testid="select-req-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newReqCategory} onValueChange={setNewReqCategory}>
                  <SelectTrigger data-testid="select-req-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="tax">Tax</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="identity">Identity</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>Mandatory</Label>
              <Switch checked={newReqMandatory} onCheckedChange={setNewReqMandatory} data-testid="switch-req-mandatory" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>Has Expiry</Label>
              <Switch checked={newReqExpiry} onCheckedChange={setNewReqExpiry} data-testid="switch-req-expiry" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReqOpen(false)}>Cancel</Button>
            <Button onClick={() => addReqMutation.mutate({ type: newReqType, documentName: newReqName, documentDescription: newReqDesc || undefined, documentCategory: newReqCategory, isMandatory: newReqMandatory, hasExpiry: newReqExpiry })} disabled={!newReqName || addReqMutation.isPending} data-testid="button-submit-requirement">
              {addReqMutation.isPending ? "Adding..." : "Add Requirement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── New Template dialog ─── */}
      <Dialog open={addTmplOpen} onOpenChange={setAddTmplOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>Create a verification template for quick request setup.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={newTmplName} onChange={(e) => setNewTmplName(e.target.value)} placeholder="e.g. IT Vendor" data-testid="input-template-name" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newTmplType} onValueChange={(v) => { setNewTmplType(v); setNewTmplDirector(false); }}>
                <SelectTrigger data-testid="select-template-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={newTmplDesc} onChange={(e) => setNewTmplDesc(e.target.value)} placeholder="Template description..." data-testid="input-template-desc" />
            </div>
            {newTmplType === "supplier" && (
              <div className="flex items-center justify-between gap-4">
                <Label>Require Director Verification</Label>
                <Switch checked={newTmplDirector} onCheckedChange={setNewTmplDirector} data-testid="switch-director-verification" />
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <Label>Set as Default</Label>
              <Switch checked={newTmplDefault} onCheckedChange={setNewTmplDefault} data-testid="switch-template-default" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTmplOpen(false)}>Cancel</Button>
            <Button onClick={() => addTmplMutation.mutate({ name: newTmplName, type: newTmplType, description: newTmplDesc || undefined, requireDirectorVerification: newTmplDirector, isDefault: newTmplDefault })} disabled={!newTmplName || addTmplMutation.isPending} data-testid="button-submit-template">
              {addTmplMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Portal Page ─────────────────────────────────────────────────────────

export default function OrgPortalPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id;
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: org, isLoading } = useQuery<OrgWithStats>({
    queryKey: ["/api/kyc-service/organisations", orgId],
  });

  const basePath = `/kyc/org/${orgId}`;
  const suffix = location.slice(basePath.length).replace(/^\//, "").split("/")[0] || "dashboard";
  const section = (["dashboard", "verifications", "sessions", "users", "monitoring", "analytics", "developers", "billing", "team", "settings"].includes(suffix) ? suffix : "dashboard") as Section;

  function navigateTo(s: Section) {
    navigate(s === "dashboard" ? basePath : `${basePath}/${s}`);
  }

  if (isLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
      </DashboardLayout>
    );
  }

  if (!org) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Not Found" }]}>
        <EmptyState title="Organisation not found" description="This organisation doesn't exist or you don't have access." />
      </DashboardLayout>
    );
  }

  const sectionLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === section)?.label || "Dashboard";

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: org.name, href: basePath }, ...(section !== "dashboard" ? [{ label: sectionLabel }] : [])]}>
      <div className="flex h-full -mx-4 -my-4 lg:-mx-6 lg:-my-6 overflow-hidden" style={{ minHeight: "calc(100vh - 120px)" }}>
        <KycPortalSidebar
          orgId={orgId}
          org={org}
          section={section}
          onNav={navigateTo}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-background lg:hidden">
            <button onClick={() => setSidebarOpen(true)} data-testid="button-open-sidebar">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium">{sectionLabel}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {section === "dashboard" && <DashboardSection orgId={orgId} org={org} onNav={navigateTo} />}
            {section === "verifications" && <VerificationsSection orgId={orgId} />}
            {section === "sessions" && <SessionsSection orgId={orgId} />}
            {section === "users" && <UsersSection orgId={orgId} />}
            {section === "monitoring" && <MonitoringSection orgId={orgId} />}
            {section === "analytics" && <AnalyticsSection orgId={orgId} />}
            {section === "developers" && <DevelopersSection orgId={orgId} org={org} />}
            {section === "billing" && <BillingSection orgId={orgId} />}
            {section === "team" && <TeamSection orgId={orgId} org={org} />}
            {section === "settings" && <SettingsSection orgId={orgId} org={org} />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
