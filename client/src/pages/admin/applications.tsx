import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  Search,
  Filter,
  UserPlus,
  CreditCard,
  Send,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { CompanyApplication, LawyerProfile } from "@shared/schema";

interface BankPartnerBasic { id: number; name: string; }

interface ApplicationWithLawyer extends CompanyApplication {
  lawyerName?: string;
}

const paymentTransitionOptions = [
  { value: "released_to_lawyer", label: "Release to Lawyer", description: "Release escrowed funds to assigned lawyer" },
  { value: "refunded_partial", label: "Partial Refund", description: "Process a partial refund to the founder" },
  { value: "refunded_full", label: "Full Refund", description: "Process a full refund to the founder" },
  { value: "chargeback", label: "Chargeback", description: "Record a payment chargeback" },
];

export default function AdminApplications() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithLawyer | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState<string>("");
  const [selectedPaymentState, setSelectedPaymentState] = useState<string>("");
  const [paymentReason, setPaymentReason] = useState<string>("");
  const [bankDispatchOpen, setBankDispatchOpen] = useState(false);
  const [bankDispatchAppId, setBankDispatchAppId] = useState<number | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  const { data: applications, isLoading } = useQuery<ApplicationWithLawyer[]>({
    queryKey: ["/api/admin/applications"],
  });

  const { data: lawyers } = useQuery<(LawyerProfile & { email: string; name: string })[]>({
    queryKey: ["/api/admin/lawyers"],
  });

  const { data: bankPartners = [] } = useQuery<BankPartnerBasic[]>({
    queryKey: ["/api/admin/banking-partners"],
  });

  const { data: appCompanyProfile } = useQuery<{ id: number; companyName: string; existingCompanyStatus?: string } | null>({
    queryKey: ["/api/admin/applications", bankDispatchAppId, "company-profile"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/admin/applications/${bankDispatchAppId}/company-profile`, { credentials: "include" });
        if (!res.ok) return null;
        return res.json();
      } catch { return null; }
    },
    enabled: bankDispatchOpen && !!bankDispatchAppId,
  });

  const { data: bankPreview, isLoading: previewLoading } = useQuery<{
    companyName: string; rcNumber?: string; companyType?: string; existingCompanyStatus?: string;
    directorCount: number; verifiedDirectors: number; checklistTotal: number; checklistSubmitted: number; kybStatus: string;
    directors?: { name: string; role?: string; bvn?: string; nin?: string; bvnVerified?: boolean; ninVerified?: boolean }[];
  } | null>({
    queryKey: ["/api/admin/company-profiles", appCompanyProfile?.id, "bank-preview"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/admin/company-profiles/${appCompanyProfile!.id}/bank-preview`, { credentials: "include" });
        if (!res.ok) return null;
        return res.json();
      } catch { return null; }
    },
    enabled: bankDispatchOpen && !!appCompanyProfile?.id,
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
      toast({ title: "Dossier dispatched", description: "The bank has been emailed the company dossier." });
      setBankDispatchOpen(false);
      setSelectedBankId("");
    },
    onError: (e: Error) => toast({ title: "Dispatch failed", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ applicationId, lawyerId }: { applicationId: number; lawyerId: string }) => {
      return apiRequest("POST", `/api/admin/applications/${applicationId}/assign`, { lawyerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Lawyer assigned successfully" });
      setAssignDialogOpen(false);
      setSelectedApp(null);
      setSelectedLawyer("");
    },
    onError: () => {
      toast({ title: "Failed to assign lawyer", variant: "destructive" });
    },
  });

  const paymentTransitionMutation = useMutation({
    mutationFn: async ({ applicationId, targetState, reason }: { applicationId: number; targetState: string; reason: string }) => {
      return apiRequest("POST", `/api/admin/applications/${applicationId}/payment-state`, { targetState, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Payment transition completed successfully" });
      setPaymentDialogOpen(false);
      setSelectedApp(null);
      setSelectedPaymentState("");
      setPaymentReason("");
    },
    onError: () => {
      toast({ title: "Failed to complete payment transition", variant: "destructive" });
    },
  });

  const filteredApplications = applications?.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesSearch = !searchQuery || 
      app.companyName1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout 
      role="admin" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Applications" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">All Applications</h1>
          <p className="text-muted-foreground">
            View and manage all platform applications
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !filteredApplications?.length ? (
          <EmptyState
            icon={Building2}
            title="No applications found"
            description="Applications will appear here once users create them."
          />
        ) : (
          <div className="grid gap-4">
            {filteredApplications.map((app) => (
              <Card key={app.id} data-testid={`app-row-${app.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-lg truncate">
                          {app.companyName1 || "Untitled Application"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                          <span>#{app.id}</span>
                          <span>&bull;</span>
                          <span>{app.companyType || "LTD"}</span>
                          {app.lawyerName && (
                            <>
                              <span>&bull;</span>
                              <span>Assigned: {app.lawyerName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0 flex-wrap">
                      <StatusBadge status={app.status || "draft"} />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app);
                          setSelectedPaymentState(app.paymentState || "unpaid");
                          setPaymentDialogOpen(true);
                        }}
                        data-testid={`button-payment-${app.id}`}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        {app.paymentState || "unpaid"}
                      </Button>
                      {!app.assignedLawyerUserId && app.status !== "draft" && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setAssignDialogOpen(true);
                          }}
                          data-testid={`button-assign-${app.id}`}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      )}
                      {app.status === "completed" && bankPartners.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBankDispatchAppId(app.id);
                            setSelectedBankId("");
                            setBankDispatchOpen(true);
                          }}
                          data-testid={`button-send-to-bank-app-${app.id}`}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send to Bank
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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lawyer</DialogTitle>
            <DialogDescription>
              Select a lawyer to handle "{selectedApp?.companyName1 || 'this application'}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedLawyer} onValueChange={setSelectedLawyer}>
              <SelectTrigger data-testid="select-lawyer">
                <SelectValue placeholder="Select a lawyer" />
              </SelectTrigger>
              <SelectContent>
                {lawyers?.map((lawyer) => (
                  <SelectItem key={lawyer.userId} value={lawyer.userId}>
                    {lawyer.name || lawyer.email} - {lawyer.firmName || "Independent"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedApp && selectedLawyer) {
                  assignMutation.mutate({ 
                    applicationId: selectedApp.id, 
                    lawyerId: selectedLawyer 
                  });
                }
              }}
              disabled={!selectedLawyer || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? <LoadingSpinner size="sm" /> : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Action</DialogTitle>
            <DialogDescription>
              Process payment for "{selectedApp?.companyName1 || 'this application'}"
              <br />
              <span className="text-sm">Current state: {selectedApp?.paymentState || "unpaid"}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-transition">Action</Label>
              <Select value={selectedPaymentState} onValueChange={setSelectedPaymentState}>
                <SelectTrigger data-testid="select-payment-state">
                  <SelectValue placeholder="Select payment action" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTransitionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPaymentState && (
                <p className="text-xs text-muted-foreground">
                  {paymentTransitionOptions.find(o => o.value === selectedPaymentState)?.description}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-reason">Reason (optional)</Label>
              <Input
                id="payment-reason"
                placeholder="e.g., Application completed, customer request"
                value={paymentReason}
                onChange={(e) => setPaymentReason(e.target.value)}
                data-testid="input-payment-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedApp && selectedPaymentState) {
                  paymentTransitionMutation.mutate({ 
                    applicationId: selectedApp.id, 
                    targetState: selectedPaymentState,
                    reason: paymentReason 
                  });
                }
              }}
              disabled={!selectedPaymentState || paymentTransitionMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {paymentTransitionMutation.isPending ? <LoadingSpinner size="sm" /> : "Execute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Dispatch Dialog for completed applications */}
      <Dialog open={bankDispatchOpen} onOpenChange={setBankDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Bank</DialogTitle>
            <DialogDescription>
              Review the dossier summary before emailing it to a bank partner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : appCompanyProfile === null ? (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
                No company profile found for this application yet. The profile is created after incorporation is complete.
              </p>
            ) : bankPreview ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm" data-testid="block-dossier-preview-app">
                <p className="font-semibold text-base">{bankPreview.companyName}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>RC Number</span><span className="text-foreground">{bankPreview.rcNumber || "—"}</span>
                  <span>Type</span><span className="text-foreground">{bankPreview.companyType || "—"}</span>
                  <span>KYB Status</span><span className={`font-medium ${bankPreview.kybStatus === "VERIFIED" ? "text-green-600" : "text-amber-600"}`}>{bankPreview.kybStatus}</span>
                  <span>Directors</span><span className="text-foreground">{bankPreview.directorCount} ({bankPreview.verifiedDirectors} verified)</span>
                  <span>Documents</span><span className="text-foreground">{bankPreview.checklistSubmitted}/{bankPreview.checklistTotal} submitted</span>
                </div>
                {bankPreview.directors && bankPreview.directors.length > 0 && (
                  <div className="pt-1 border-t border-border/50 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Director Identity Numbers</p>
                    {bankPreview.directors.map((d, i) => (
                      <div key={i} className="text-xs" data-testid={`director-ids-${i}`}>
                        <p className="font-medium text-foreground mb-0.5">{d.name}{d.role ? ` (${d.role})` : ""}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                          {d.bvn ? (
                            <><span>BVN</span><span className="text-foreground font-mono" data-testid={`text-bvn-${i}`}>{d.bvn}</span></>
                          ) : null}
                          {d.nin ? (
                            <><span>NIN</span><span className="text-foreground font-mono" data-testid={`text-nin-${i}`}>{d.nin}</span></>
                          ) : null}
                          {!d.bvn && !d.nin && (
                            <span className="col-span-2 italic text-muted-foreground">No ID numbers on file</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Select bank partner</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger data-testid="select-bank-partner-app">
                  <SelectValue placeholder="Choose a bank…" />
                </SelectTrigger>
                <SelectContent>
                  {bankPartners.map(bp => (
                    <SelectItem key={bp.id} value={String(bp.id)}>{bp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The dossier will be emailed to all registered email addresses for the selected bank.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDispatchOpen(false)}>Cancel</Button>
            <Button
              onClick={() => appCompanyProfile?.id && selectedBankId && dispatchMutation.mutate({
                companyProfileId: appCompanyProfile.id,
                bankPartnerId: parseInt(selectedBankId),
              })}
              disabled={dispatchMutation.isPending || !selectedBankId || !appCompanyProfile?.id}
              data-testid="button-confirm-bank-dispatch-app"
            >
              {dispatchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-1.5" />}
              Dispatch Dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
