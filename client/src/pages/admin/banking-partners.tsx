import { useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Plus,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Pencil,
  UserPlus,
  Trash2,
  Send,
  RotateCcw,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

interface BankEmail {
  label: string;
  address: string;
}

interface BankPartner {
  id: number;
  name: string;
  contactEmail: string | null;
  emails: BankEmail[];
  serviceTypes: string[];
  feeRateBps: number;
  isActive: boolean;
  notes: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
}

interface BankDispatch {
  id: number;
  companyProfileId: number;
  bankPartnerId: number;
  bankName: string;
  companyName: string;
  sentByName: string;
  sentAt: string;
}

interface BankDocRequest {
  id: number;
  companyProfileId: number;
  bankPartnerId: number;
  bankName: string;
  companyName: string;
  requestedByEmail: string;
  documentsRequested: string;
  reason: string | null;
  status: string;
  createdAt: string;
  actionedAt: string | null;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { dateStyle: "medium" });
}

function feeLabel(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

type PartnerFormState = {
  name: string;
  contactEmail: string;
  serviceTypes: string[];
  feeRateBps: string;
  notes: string;
};

const EMPTY_FORM: PartnerFormState = { name: "", contactEmail: "", serviceTypes: ["escrow_custody"], feeRateBps: "", notes: "" };

export default function AdminBankingPartnersPage() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<BankPartner | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmToggle, setConfirmToggle] = useState<{ partner: BankPartner; action: "activate" | "deactivate" } | null>(null);
  const [emailManagePartner, setEmailManagePartner] = useState<BankPartner | null>(null);
  const [newEmailLabel, setNewEmailLabel] = useState("");
  const [newEmailAddress, setNewEmailAddress] = useState("");
  const [editingEmail, setEditingEmail] = useState<{ address: string; label: string } | null>(null);
  const [expandedPartner, setExpandedPartner] = useState<number | null>(null);

  const { data: partners = [], isLoading, refetch } = useQuery<BankPartner[]>({
    queryKey: ["/api/admin/banking-partners"],
  });

  const { data: dispatches = [] } = useQuery<BankDispatch[]>({
    queryKey: ["/api/admin/bank-dispatches"],
  });

  const { data: docRequests = [], refetch: refetchDocRequests } = useQuery<BankDocRequest[]>({
    queryKey: ["/api/admin/bank-doc-requests"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PartnerFormState) => {
      const res = await apiRequest("POST", "/api/admin/banking-partners", {
        name: data.name.trim(),
        contactEmail: data.contactEmail.trim() || undefined,
        serviceTypes: data.serviceTypes,
        feeRateBps: data.serviceTypes.includes("escrow_custody") ? parseInt(data.feeRateBps, 10) || 0 : 0,
        notes: data.notes.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create partner");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banking-partners"] });
      toast({ title: "Banking partner added" });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PartnerFormState }) => {
      const res = await apiRequest("PATCH", `/api/admin/banking-partners/${id}`, {
        name: data.name.trim(),
        contactEmail: data.contactEmail.trim() || undefined,
        serviceTypes: data.serviceTypes,
        feeRateBps: data.serviceTypes.includes("escrow_custody") ? parseInt(data.feeRateBps, 10) || 0 : 0,
        notes: data.notes.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update partner");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banking-partners"] });
      toast({ title: "Partner updated" });
      setEditPartner(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "activate" | "deactivate" }) => {
      const res = await apiRequest("POST", `/api/admin/banking-partners/${id}/${action}`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action} partner`);
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banking-partners"] });
      toast({ title: vars.action === "activate" ? "Partner activated" : "Partner deactivated" });
      setConfirmToggle(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addEmailMutation = useMutation({
    mutationFn: async ({ partnerId, label, address }: { partnerId: number; label: string; address: string }) => {
      const res = await apiRequest("POST", `/api/admin/banking-partners/${partnerId}/emails`, { label, address });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add email");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banking-partners"] });
      setEmailManagePartner(data);
      toast({ title: "Email added and invite sent" });
      setNewEmailLabel("");
      setNewEmailAddress("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeEmailMutation = useMutation({
    mutationFn: async ({ partnerId, address }: { partnerId: number; address: string }) => {
      const res = await apiRequest("DELETE", `/api/admin/banking-partners/${partnerId}/emails/${encodeURIComponent(address)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove email");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banking-partners"] });
      setEmailManagePartner(data);
      toast({ title: "Email removed and portal access revoked" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async ({ partnerId, address }: { partnerId: number; address: string }) => {
      const res = await apiRequest("POST", `/api/admin/banking-partners/${partnerId}/emails/${encodeURIComponent(address)}/resend-invite`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resend invite");
      }
      return res.json();
    },
    onSuccess: () => toast({ title: "Invite resent" }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editEmailMutation = useMutation({
    mutationFn: async ({ partnerId, address, label }: { partnerId: number; address: string; label: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/banking-partners/${partnerId}/emails/${encodeURIComponent(address)}`, { label });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update label");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banking-partners"] });
      setEmailManagePartner(data);
      setEditingEmail(null);
      toast({ title: "Email label updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const actionDocRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/bank-doc-requests/${id}/action`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to action request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bank-doc-requests"] });
      toast({ title: "Request marked as actioned" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(p: BankPartner) {
    setEditPartner(p);
    setForm({
      name: p.name,
      contactEmail: p.contactEmail || "",
      serviceTypes: Array.isArray(p.serviceTypes) && p.serviceTypes.length > 0 ? p.serviceTypes : ["escrow_custody"],
      feeRateBps: String(p.feeRateBps),
      notes: p.notes || "",
    });
  }

  const activePartner = partners.find(p => p.isActive);
  const openDocRequests = docRequests.filter(r => r.status === "open");

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-banking-partners">Banking Partners</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage escrow custody partners, bank portal staff emails, and dossier dispatches.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetch(); refetchDocRequests(); }} data-testid="button-refresh-partners">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setAddOpen(true); }} data-testid="button-add-partner">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Partner
            </Button>
          </div>
        </div>

        {/* Document Request Alerts */}
        {openDocRequests.length > 0 && (
          <Card className="border-orange-400/40 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-orange-600" />
                <p className="font-semibold text-orange-800 dark:text-orange-300">
                  {openDocRequests.length} open bank document request{openDocRequests.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="space-y-1">
                {openDocRequests.slice(0, 3).map(r => (
                  <p key={r.id} className="text-sm text-orange-700 dark:text-orange-400">
                    {r.bankName} → {r.companyName}: {r.documentsRequested.slice(0, 80)}{r.documentsRequested.length > 80 ? "…" : ""}
                  </p>
                ))}
                {openDocRequests.length > 3 && <p className="text-xs text-orange-600">+{openDocRequests.length - 3} more — see Document Requests tab below</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Partner Banner */}
        {activePartner && (
          <Card className="border-green-500/40 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-green-800 dark:text-green-300" data-testid="text-active-partner-name">
                    Active: {activePartner.name}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Fee carve-out: {feeLabel(activePartner.feeRateBps)} on new escrow transactions. Activated {formatDate(activePartner.activatedAt)}.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900"
                  onClick={() => setConfirmToggle({ partner: activePartner, action: "deactivate" })}
                  data-testid="button-deactivate-active"
                >
                  Deactivate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="partners">
          <TabsList>
            <TabsTrigger value="partners">Partners</TabsTrigger>
            <TabsTrigger value="dispatches">Dispatch Log</TabsTrigger>
            <TabsTrigger value="doc-requests" className="relative">
              Document Requests
              {openDocRequests.length > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {openDocRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Partners Tab */}
          <TabsContent value="partners" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner /></div>
            ) : partners.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground" data-testid="text-no-partners">No banking partners added yet.</p>
                  <Button className="mt-4" onClick={() => { setForm(EMPTY_FORM); setAddOpen(true); }}>
                    Add your first partner
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {partners.map(p => (
                  <Card key={p.id} data-testid={`card-partner-${p.id}`} className={p.isActive ? "border-green-500/30" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-base" data-testid={`text-partner-name-${p.id}`}>{p.name}</p>
                            {p.isActive ? (
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                            )}
                            {Array.isArray(p.serviceTypes) && p.serviceTypes.includes("account_opening") && (
                              <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-400/50 bg-blue-50 dark:bg-blue-950/30" data-testid={`badge-account-opening-${p.id}`}>Account Opening</Badge>
                            )}
                            {Array.isArray(p.serviceTypes) && p.serviceTypes.includes("escrow_custody") && (
                              <Badge variant="outline" className="text-purple-700 dark:text-purple-400 border-purple-400/50 bg-purple-50 dark:bg-purple-950/30" data-testid={`badge-escrow-custody-${p.id}`}>Escrow Custody</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm text-muted-foreground">
                            <span>Fee: <span className="font-medium text-foreground" data-testid={`text-fee-${p.id}`}>{feeLabel(p.feeRateBps)}</span> ({p.feeRateBps} bps)</span>
                            {p.contactEmail && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{p.contactEmail}</span>}
                            <span>Added: {formatDate(p.createdAt)}</span>
                            {p.activatedAt && <span>Last activated: {formatDate(p.activatedAt)}</span>}
                          </div>
                          {p.notes && <p className="text-xs text-muted-foreground mt-1 italic">{p.notes}</p>}

                          {/* Email summary */}
                          {Array.isArray(p.emails) && p.emails.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {p.emails.map(e => (
                                <span key={e.address} className="inline-flex items-center gap-1 bg-muted rounded px-2 py-0.5 text-xs">
                                  <Mail className="h-3 w-3" />{e.label}: {e.address}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEmailManagePartner(p); setNewEmailLabel(""); setNewEmailAddress(""); }}
                            data-testid={`button-manage-emails-${p.id}`}
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Emails
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-${p.id}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                          </Button>
                          {!p.isActive && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setConfirmToggle({ partner: p, action: "activate" })}
                              disabled={toggleMutation.isPending}
                              data-testid={`button-activate-${p.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Set Active
                            </Button>
                          )}
                          {p.isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmToggle({ partner: p, action: "deactivate" })}
                              disabled={toggleMutation.isPending}
                              data-testid={`button-deactivate-${p.id}`}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />Deactivate
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

          {/* Dispatch Log Tab */}
          <TabsContent value="dispatches" className="mt-4">
            {dispatches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Send className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No company dossiers have been dispatched yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Use "Send to Bank" on a company profile to dispatch a dossier.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {dispatches.map(d => (
                  <Card key={d.id} data-testid={`card-dispatch-${d.id}`}>
                    <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{d.companyName}</p>
                        <p className="text-xs text-muted-foreground">
                          Sent to <span className="font-medium">{d.bankName}</span>
                          {d.sentByName && <> by {d.sentByName}</>}
                          {" — "}{format(new Date(d.sentAt), "d MMM yyyy, HH:mm")}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-400 shrink-0">Dispatched</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Document Requests Tab */}
          <TabsContent value="doc-requests" className="mt-4">
            {docRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No bank document requests yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {docRequests.map(r => (
                  <Card key={r.id} data-testid={`card-doc-request-${r.id}`} className={r.status === "open" ? "border-orange-400/40" : ""}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{r.companyName}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "open" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                              {r.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            From <span className="font-medium">{r.bankName}</span> ({r.requestedByEmail})
                            {" — "}{format(new Date(r.createdAt), "d MMM yyyy")}
                          </p>
                          <p className="text-sm mt-1">{r.documentsRequested}</p>
                          {r.reason && <p className="text-xs text-muted-foreground italic">Reason: {r.reason}</p>}
                        </div>
                        {r.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => actionDocRequestMutation.mutate(r.id)}
                            disabled={actionDocRequestMutation.isPending}
                            data-testid={`button-action-doc-request-${r.id}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Mark Actioned
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Partner Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Banking Partner</DialogTitle>
            <DialogDescription>
              Set the partner's fee carve-out rate. This is carved out of Cellion's 1.5% service fee.
            </DialogDescription>
          </DialogHeader>
          <PartnerForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="button-cancel-add">Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || form.serviceTypes.length === 0 || (form.serviceTypes.includes("escrow_custody") && !form.feeRateBps)}
              data-testid="button-submit-add"
            >
              {createMutation.isPending ? <LoadingSpinner /> : "Add Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Dialog */}
      <Dialog open={!!editPartner} onOpenChange={(o) => !o && setEditPartner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>Update partner details. Activation status is managed separately.</DialogDescription>
          </DialogHeader>
          <PartnerForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPartner(null)} data-testid="button-cancel-edit">Cancel</Button>
            <Button
              onClick={() => editPartner && editMutation.mutate({ id: editPartner.id, data: form })}
              disabled={editMutation.isPending || !form.name || form.serviceTypes.length === 0 || (form.serviceTypes.includes("escrow_custody") && !form.feeRateBps)}
              data-testid="button-submit-edit"
            >
              {editMutation.isPending ? <LoadingSpinner /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Management Dialog */}
      <Dialog open={!!emailManagePartner} onOpenChange={(o) => !o && setEmailManagePartner(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Bank Portal Emails</DialogTitle>
            <DialogDescription>
              Add staff emails for {emailManagePartner?.name}. Each person gets a portal invite to view dispatched dossiers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing emails */}
            {emailManagePartner && Array.isArray(emailManagePartner.emails) && emailManagePartner.emails.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Registered Emails</Label>
                {emailManagePartner.emails.map(e => (
                  <div key={e.address} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                    {editingEmail?.address === e.address ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          className="h-7 text-sm"
                          value={editingEmail.label}
                          onChange={ev => setEditingEmail({ ...editingEmail, label: ev.target.value })}
                          placeholder="Label"
                          data-testid={`input-edit-email-label-${e.address}`}
                        />
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs px-2"
                          onClick={() => emailManagePartner && editEmailMutation.mutate({ partnerId: emailManagePartner.id, address: e.address, label: editingEmail.label })}
                          disabled={editEmailMutation.isPending || !editingEmail.label.trim()}
                          data-testid={`button-save-email-label-${e.address}`}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingEmail(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-medium">{e.label}</p>
                          <p className="text-xs text-muted-foreground">{e.address}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingEmail({ address: e.address, label: e.label })}
                            title="Edit label"
                            data-testid={`button-edit-email-${e.address}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resendInviteMutation.mutate({ partnerId: emailManagePartner.id, address: e.address })}
                            disabled={resendInviteMutation.isPending}
                            title="Resend invite"
                            data-testid={`button-resend-invite-${e.address}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeEmailMutation.mutate({ partnerId: emailManagePartner.id, address: e.address })}
                            disabled={removeEmailMutation.isPending}
                            title="Remove"
                            data-testid={`button-remove-email-${e.address}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No portal emails added yet.</p>
            )}

            {/* Add new email */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Add New Email</Label>
              <div className="space-y-2">
                <Input
                  placeholder="Label (e.g. Account Opening Officer)"
                  value={newEmailLabel}
                  onChange={e => setNewEmailLabel(e.target.value)}
                  data-testid="input-new-email-label"
                />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={newEmailAddress}
                  onChange={e => setNewEmailAddress(e.target.value)}
                  data-testid="input-new-email-address"
                />
              </div>
              <Button
                size="sm"
                onClick={() => emailManagePartner && addEmailMutation.mutate({
                  partnerId: emailManagePartner.id,
                  label: newEmailLabel.trim(),
                  address: newEmailAddress.trim(),
                })}
                disabled={addEmailMutation.isPending || !newEmailLabel.trim() || !newEmailAddress.trim()}
                data-testid="button-add-email"
              >
                {addEmailMutation.isPending ? <LoadingSpinner /> : <><UserPlus className="h-3.5 w-3.5 mr-1.5" />Add & Send Invite</>}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailManagePartner(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Toggle Dialog */}
      <AlertDialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggle?.action === "activate" ? "Activate Banking Partner" : "Deactivate Banking Partner"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.action === "activate"
                ? `Activating "${confirmToggle?.partner.name}" will apply a ${feeLabel(confirmToggle?.partner.feeRateBps ?? 0)} fee carve-out on all new escrow transactions.`
                : `Deactivating "${confirmToggle?.partner.name}" means new escrow transactions will no longer include their fee carve-out.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-toggle">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmToggle) toggleMutation.mutate({ id: confirmToggle.partner.id, action: confirmToggle.action });
              }}
              disabled={toggleMutation.isPending}
              data-testid="button-confirm-toggle"
            >
              {toggleMutation.isPending ? <LoadingSpinner /> : (confirmToggle?.action === "activate" ? "Activate" : "Deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function PartnerForm({ form, onChange }: { form: PartnerFormState; onChange: Dispatch<SetStateAction<PartnerFormState>> }) {
  const hasEscrow = form.serviceTypes.includes("escrow_custody");
  const hasAccountOpening = form.serviceTypes.includes("account_opening");

  function toggleServiceType(type: string) {
    onChange(f => {
      const has = f.serviceTypes.includes(type);
      const updated = has ? f.serviceTypes.filter(t => t !== type) : [...f.serviceTypes, type];
      const clearedFee = !updated.includes("escrow_custody") ? { feeRateBps: "" } : {};
      return { ...f, serviceTypes: updated, ...clearedFee };
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="partner-name">Partner Name *</Label>
        <Input
          id="partner-name"
          value={form.name}
          onChange={e => onChange(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. First Bank of Nigeria"
          data-testid="input-partner-name"
        />
      </div>

      <div className="space-y-2">
        <Label>Services Provided *</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer" data-testid="label-account-opening">
            <input
              type="checkbox"
              checked={hasAccountOpening}
              onChange={() => toggleServiceType("account_opening")}
              className="h-4 w-4 rounded border-border accent-primary"
              data-testid="checkbox-account-opening"
            />
            <span className="text-sm">Corporate Account Opening</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer" data-testid="label-escrow-custody">
            <input
              type="checkbox"
              checked={hasEscrow}
              onChange={() => toggleServiceType("escrow_custody")}
              className="h-4 w-4 rounded border-border accent-primary"
              data-testid="checkbox-escrow-custody"
            />
            <span className="text-sm">Escrow Custody</span>
          </label>
        </div>
        {form.serviceTypes.length === 0 && (
          <p className="text-xs text-destructive">At least one service must be selected.</p>
        )}
      </div>

      {hasEscrow && (
        <div className="space-y-1.5">
          <Label htmlFor="fee-bps">Fee Carve-out (basis points) *</Label>
          <Input
            id="fee-bps"
            type="number"
            min={0}
            max={150}
            value={form.feeRateBps}
            onChange={e => onChange(f => ({ ...f, feeRateBps: e.target.value }))}
            placeholder="e.g. 50 = 0.50%"
            data-testid="input-fee-bps"
          />
          {form.feeRateBps && !isNaN(parseInt(form.feeRateBps)) && (
            <p className="text-xs text-muted-foreground">
              = {feeLabel(parseInt(form.feeRateBps))} &nbsp;·&nbsp; Max 150 bps (1.50%)
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="contact-email">Legacy Contact Email (optional)</Label>
        <Input
          id="contact-email"
          type="email"
          value={form.contactEmail}
          onChange={e => onChange(f => ({ ...f, contactEmail: e.target.value }))}
          placeholder="settlement@bank.ng"
          data-testid="input-contact-email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={e => onChange(f => ({ ...f, notes: e.target.value }))}
          placeholder="Agreement number, settlement frequency, etc."
          rows={3}
          data-testid="input-notes"
        />
      </div>
    </div>
  );
}
