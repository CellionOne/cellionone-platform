import { useState } from "react";
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
import {
  Building2,
  Plus,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Pencil,
} from "lucide-react";

interface BankPartner {
  id: number;
  name: string;
  contactEmail: string | null;
  feeRateBps: number;
  isActive: boolean;
  notes: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { dateStyle: "medium" });
}

function feeLabel(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

const EMPTY_FORM = { name: "", contactEmail: "", feeRateBps: "", notes: "" };

export default function AdminBankingPartnersPage() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<BankPartner | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmToggle, setConfirmToggle] = useState<{ partner: BankPartner; action: "activate" | "deactivate" } | null>(null);

  const { data: partners = [], isLoading, refetch } = useQuery<BankPartner[]>({
    queryKey: ["/api/admin/banking-partners"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/admin/banking-partners", {
        name: data.name.trim(),
        contactEmail: data.contactEmail.trim() || undefined,
        feeRateBps: parseInt(data.feeRateBps, 10),
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
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await apiRequest("PATCH", `/api/admin/banking-partners/${id}`, {
        name: data.name.trim(),
        contactEmail: data.contactEmail.trim() || undefined,
        feeRateBps: parseInt(data.feeRateBps, 10),
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
      toast({ title: vars.action === "activate" ? "Partner activated — fee carve-out is now live" : "Partner deactivated" });
      setConfirmToggle(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(p: BankPartner) {
    setEditPartner(p);
    setForm({
      name: p.name,
      contactEmail: p.contactEmail || "",
      feeRateBps: String(p.feeRateBps),
      notes: p.notes || "",
    });
  }

  const activePartner = partners.find(p => p.isActive);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-banking-partners">Banking Partners</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage escrow custody partners. Only one partner may be active at a time.
              Their fee is carved out of Cellion's service fee — buyers see no change.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-partners">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setAddOpen(true); }} data-testid="button-add-partner">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Partner
            </Button>
          </div>
        </div>

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
                    Fee carve-out: {feeLabel(activePartner.feeRateBps)} of principal on all new escrow transactions.
                    Cellion earns the remainder of the 1.5% service fee.
                    Activated {formatDate(activePartner.activatedAt)}.
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

        {/* Partners List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
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
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm text-muted-foreground">
                        <span>Fee carve-out: <span className="font-medium text-foreground" data-testid={`text-fee-${p.id}`}>{feeLabel(p.feeRateBps)}</span> ({p.feeRateBps} bps)</span>
                        {p.contactEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {p.contactEmail}
                          </span>
                        )}
                        <span>Added: {formatDate(p.createdAt)}</span>
                        {p.activatedAt && <span>Last activated: {formatDate(p.activatedAt)}</span>}
                      </div>
                      {p.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{p.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(p)}
                        data-testid={`button-edit-${p.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      {!p.isActive && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setConfirmToggle({ partner: p, action: "activate" })}
                          disabled={toggleMutation.isPending}
                          data-testid={`button-activate-${p.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Set Active
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
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Deactivate
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

      {/* Add Partner Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Banking Partner</DialogTitle>
            <DialogDescription>
              Set the partner's fee carve-out rate in basis points (100 bps = 1.00%).
              This is the share carved out of Cellion's 1.5% service fee — buyers are not charged more.
            </DialogDescription>
          </DialogHeader>
          <PartnerForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="button-cancel-add">Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || !form.feeRateBps}
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
              disabled={editMutation.isPending || !form.name}
              data-testid="button-submit-edit"
            >
              {editMutation.isPending ? <LoadingSpinner /> : "Save Changes"}
            </Button>
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
                ? `Activating "${confirmToggle?.partner.name}" will apply a ${feeLabel(confirmToggle?.partner.feeRateBps ?? 0)} fee carve-out on all new escrow transactions. Any currently active partner will be deactivated. Existing transactions are not affected.`
                : `Deactivating "${confirmToggle?.partner.name}" means new escrow transactions will no longer include their fee carve-out. Existing transactions are not affected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-toggle">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmToggle) {
                  toggleMutation.mutate({ id: confirmToggle.partner.id, action: confirmToggle.action });
                }
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

function PartnerForm({
  form,
  onChange,
}: {
  form: { name: string; contactEmail: string; feeRateBps: string; notes: string };
  onChange: (v: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="partner-name">Partner Name *</Label>
        <Input
          id="partner-name"
          value={form.name}
          onChange={e => onChange((f: any) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. First Bank of Nigeria"
          data-testid="input-partner-name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fee-bps">Fee Carve-out (basis points) *</Label>
        <Input
          id="fee-bps"
          type="number"
          min={0}
          max={150}
          value={form.feeRateBps}
          onChange={e => onChange((f: any) => ({ ...f, feeRateBps: e.target.value }))}
          placeholder="e.g. 50 = 0.50% (max 150 = 1.50%)"
          data-testid="input-fee-bps"
        />
        {form.feeRateBps && !isNaN(parseInt(form.feeRateBps)) && (
          <p className="text-xs text-muted-foreground">
            = {feeLabel(parseInt(form.feeRateBps))} of principal &nbsp;·&nbsp;
            Cellion retains at least {feeLabel(Math.max(0, 150 - Math.min(parseInt(form.feeRateBps), 150)))} (from 1.50%) &nbsp;·&nbsp;
            Max: 150 bps (1.50%)
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-email">Contact Email</Label>
        <Input
          id="contact-email"
          type="email"
          value={form.contactEmail}
          onChange={e => onChange((f: any) => ({ ...f, contactEmail: e.target.value }))}
          placeholder="settlement@bank.ng"
          data-testid="input-contact-email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={e => onChange((f: any) => ({ ...f, notes: e.target.value }))}
          placeholder="Agreement number, settlement frequency, etc."
          rows={3}
          data-testid="input-notes"
        />
      </div>
    </div>
  );
}
