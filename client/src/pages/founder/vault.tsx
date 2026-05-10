import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { ReceiptsList } from "@/components/receipts-list";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import {
  FolderOpen,
  FileText,
  Download,
  Building2,
  Shield,
  FileCheck,
  Receipt,
  Upload,
  CheckCircle2,
  Loader2,
  Landmark,
  Send,
  ArrowLeft,
  BanknoteIcon,
  AlertTriangle,
  Scale,
} from "lucide-react";
import type { DocumentFile, CompanyApplication, ProfileChecklistItem, LawyerDocumentRequest } from "@shared/schema";

interface CompanyDocumentGroup {
  profileId: number;
  companyName: string;
  rcNumber?: string | null;
  status: string | null;
  items: ProfileChecklistItem[];
}

interface VaultData {
  applications: CompanyApplication[];
  documents: DocumentFile[];
  companyDocuments: CompanyDocumentGroup[];
}

interface BankPartner {
  id: number;
  name: string;
}

interface BankDocRequest {
  id: number;
  companyProfileId: number;
  bankPartnerId: number;
  documentsRequested: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  bankName?: string | null;
}

interface DispatchRecord {
  id: number;
  bankPartnerId: number;
  bankName: string;
  sentAt: string;
}

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  identity: { label: "Identity Documents", icon: Shield },
  company: { label: "Company Documents", icon: Building2 },
  filing: { label: "Filing Documents", icon: FileText },
  stamped_originals: { label: "Stamped Originals", icon: FileCheck },
  courier: { label: "Courier Documents", icon: FileText },
};

const STANDARD_VAULT_DOCS: { key: string; label: string; hint: string }[] = [
  { key: "coi", label: "Certificate of Incorporation", hint: "PDF, JPG, or PNG — up to 10 MB" },
  { key: "memat", label: "Memorandum & Articles of Association (MEMART)", hint: "PDF — up to 10 MB" },
  { key: "cac_status", label: "CAC Status Report (CAC 1.1 / CAC 7 / BN-01)", hint: "PDF — up to 10 MB" },
  { key: "tin_cert", label: "TIN Certificate", hint: "PDF, JPG, or PNG — up to 10 MB" },
  { key: "proof_address", label: "Proof of Operating Address (Utility Bill / Tenancy Agreement)", hint: "PDF, JPG, or PNG — up to 10 MB" },
  { key: "director_id", label: "Director Government-Issued ID", hint: "PDF, JPG, or PNG — up to 10 MB" },
];

function CompanyDocumentsSection({ group }: { group: CompanyDocumentGroup }) {
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [selectedBank, setSelectedBank] = useState<BankPartner | null>(null);
  const [bankShareState, setBankShareState] = useState<Record<number, boolean>>({});

  const isVerified = group.status === "verified";

  const bankPartnersQuery = useQuery<BankPartner[]>({
    queryKey: ["/api/founder/bank-partners"],
    enabled: isVerified,
  });

  const dispatchesQuery = useQuery<DispatchRecord[]>({
    queryKey: ["/api/founder/company-profiles", group.profileId, "dispatches"],
    enabled: isVerified,
  });

  interface InstructionRecord {
    id: number;
    bankPartnerId: number;
    bankName: string;
    status: string;
    submittedAt: string;
  }

  const instructionsQuery = useQuery<InstructionRecord[]>({
    queryKey: ["/api/founder/company-profiles", group.profileId, "bank-account-instructions"],
    enabled: isVerified,
  });

  const dispatchMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/founder/company-profiles/${group.profileId}/bank-dispatch`, {
        bankPartnerId: selectedBank!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", group.profileId, "dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", group.profileId, "bank-account-instructions"] });
      toast({
        title: "Dossier sent",
        description: `Your verified company dossier has been sent to ${selectedBank?.name}.`,
      });
      setDialogOpen(false);
      setStep("select");
      setSelectedBank(null);
    },
    onError: (err: Error) => {
      toast({ title: "Dispatch failed", description: err.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ docKey, file }: { docKey: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docKey", docKey);
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/founder/company-profiles/${group.profileId}/documents/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/vault"] });
      toast({ title: "Document uploaded", description: "Your document has been saved to the vault." });
      setUploadingKey(null);
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setUploadingKey(null);
    },
  });

  const handleFileSelect = (docKey: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(docKey);
    uploadMutation.mutate({ docKey, file });
  };

  const itemsByKey = Object.fromEntries(group.items.map(i => [i.key, i]));
  useEffect(() => {
    const nextState: Record<number, boolean> = {};
    for (const item of group.items) {
      if (item.id) nextState[item.id] = item.shareWithBank ?? false;
    }
    setBankShareState(nextState);
  }, [group.items]);

  const shareableCompanyItems = STANDARD_VAULT_DOCS.filter(({ key }) => {
    const item = itemsByKey[key];
    return Boolean(item?.id && item.status === "provided" && item.filePath);
  });

  const dispatchedByBankId: Record<number, DispatchRecord> = {};
  for (const d of dispatchesQuery.data || []) {
    if (!dispatchedByBankId[d.bankPartnerId]) dispatchedByBankId[d.bankPartnerId] = d;
  }

  const instructionByBankId: Record<number, InstructionRecord> = {};
  for (const i of instructionsQuery.data || []) {
    if ((i.status === "pending" || i.status === "dispatched") && !instructionByBankId[i.bankPartnerId]) {
      instructionByBankId[i.bankPartnerId] = i;
    }
  }

  const uploadedDocs = STANDARD_VAULT_DOCS.filter(
    d => itemsByKey[d.key]?.status === "provided" && itemsByKey[d.key]?.filePath
  );

  const handleOpenDialog = () => {
    setStep("select");
    setSelectedBank(null);
    setDialogOpen(true);
  };

  const handleSelectBank = (bank: BankPartner) => {
    setSelectedBank(bank);
    setStep("confirm");
  };

  const handleBack = () => {
    setStep("select");
    setSelectedBank(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setStep("select");
    setSelectedBank(null);
  };

  return (
    <>
      <Card data-testid={`card-company-docs-${group.profileId}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{group.companyName}</CardTitle>
            </div>
            <Badge variant={isVerified ? "default" : "secondary"} className={isVerified ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300" : ""}>
              {isVerified ? "Verified" : group.status ?? "In Review"}
            </Badge>
          </div>
          <CardDescription>
            Upload the standard bank KYC documents for this company. These documents are shared with the bank when you request corporate account opening.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {shareableCompanyItems.map(({ key, label, hint }) => {
              const item = itemsByKey[key];
              const isUploaded = item?.status === "provided" && !!item.filePath;
              const isUploading = uploadingKey === key && uploadMutation.isPending;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3"
                  data-testid={`vault-doc-row-${key}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isUploaded ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"}`}>
                      {isUploaded
                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : <FileText className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{label}</p>
                      <p className="text-xs text-muted-foreground">{isUploaded ? "Uploaded" : hint}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isUploaded && item?.filePath && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        data-testid={`button-download-vault-${key}`}
                      >
                        <a href={`/api/founder/company-profiles/${group.profileId}/documents/${item.id}/download`} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <input
                      ref={el => { fileInputRefs.current[key] = el; }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="hidden"
                      onChange={e => handleFileSelect(key, e.target.files?.[0])}
                      data-testid={`input-file-${key}`}
                    />
                    <Button
                      variant={isUploaded ? "outline" : "default"}
                      size="sm"
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[key]?.click()}
                      data-testid={`button-upload-${key}`}
                    >
                      {isUploading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Upload className="h-4 w-4" />
                      }
                      <span className="ml-1.5">{isUploaded ? "Replace" : "Upload"}</span>
                    </Button>
                    {isUploaded && item && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`company-bank-share-${group.profileId}-${item.id}`}
                          checked={bankShareState[item.id] ?? item.shareWithBank ?? false}
                          onCheckedChange={async (value) => {
                            const previous = bankShareState[item.id] ?? item.shareWithBank ?? false;
                            try {
                              const res = await apiRequest("PATCH", `/api/founder/company-profiles/${group.profileId}/documents/${item.id}/share-with-bank`, { shareWithBank: value });
                              if (!res.ok) throw new Error("Failed to update");
                              const payload = await res.json().catch(() => null);
                              const nextValue = typeof payload?.shareWithBank === "boolean" ? payload.shareWithBank : value;
                              setBankShareState(prev => ({ ...prev, [item.id]: nextValue }));
                              queryClient.invalidateQueries({ queryKey: ["/api/founder/vault"] });
                              toast({
                                title: nextValue ? "Shared with bank" : "Hidden from bank",
                                description: nextValue ? "This document will be included when you send your dossier." : "This document will not be included when you send your dossier.",
                              });
                            } catch {
                              setBankShareState(prev => ({ ...prev, [item.id]: previous }));
                              toast({ title: "Error", description: "Could not update bank sharing setting.", variant: "destructive" });
                            }
                          }}
                          data-testid={`switch-company-bank-share-${group.profileId}-${item.id}`}
                        />
                        <label htmlFor={`company-bank-share-${group.profileId}-${item.id}`} className="cursor-pointer select-none text-sm text-muted-foreground">
                          {(bankShareState[item.id] ?? item.shareWithBank ?? false) ? "Shared" : "Private"}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isVerified && (
            <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Landmark className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Ready to open a corporate bank account?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a partner bank below. Your verified KYB dossier and uploaded documents will be sent automatically — no forms to fill.
                  </p>
                  {(dispatchesQuery.data?.length ?? 0) > 0 && (
                    <p className="text-xs text-primary mt-1">
                      Already sent to: {dispatchesQuery.data!.map(d => d.bankName).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 w-full sm:w-auto"
                onClick={handleOpenDialog}
                data-testid="button-open-bank-account-vault"
              >
                <Send className="h-4 w-4 mr-1.5" />
                Send to Bank
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-bank-dispatch">
          {step === "select" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BanknoteIcon className="h-5 w-5 text-primary" />
                  Select a Partner Bank
                </DialogTitle>
                <DialogDescription>
                  Choose which bank to send <strong>{group.companyName}</strong>'s verified dossier to. The bank will receive your KYB result, AML-cleared director details, and uploaded documents.
                </DialogDescription>
              </DialogHeader>

              <div className="py-2">
                {bankPartnersQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : (bankPartnersQuery.data?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Landmark className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No partner banks are available at this time.</p>
                    <p className="text-xs mt-1">Contact Cellion support for assistance.</p>
                  </div>
                ) : (() => {
                    const banksWithInstructions = bankPartnersQuery.data!.filter(b => !!instructionByBankId[b.id]);
                    if (banksWithInstructions.length === 0) {
                      return (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-center space-y-2" data-testid="panel-no-instructions">
                          <Landmark className="h-8 w-8 mx-auto text-amber-500 opacity-70" />
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No bank account instruction on file</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Before you can send your company dossier to a bank partner, you must first submit a bank account opening instruction through the service request flow.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 border-amber-400 text-amber-800 dark:text-amber-200 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900"
                            onClick={() => { setDialogOpen(false); window.location.href = `/founder/service-request?service=BANK_ACCOUNT&cpId=${group.profileId}`; }}
                            data-testid="button-go-to-bank-account-flow"
                          >
                            Open Bank Account →
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div className="divide-y">
                        {banksWithInstructions.map(bank => {
                          const previousDispatch = dispatchedByBankId[bank.id];
                          const sentDate = previousDispatch
                            ? new Date(previousDispatch.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                            : null;
                          return (
                            <div
                              key={bank.id}
                              className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3"
                              data-testid={`bank-option-${bank.id}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Landmark className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{bank.name}</p>
                                  {sentDate ? (
                                    <p className="text-xs text-green-600 dark:text-green-400">Dossier sent on {sentDate}</p>
                                  ) : (
                                    <p className="text-xs text-blue-600 dark:text-blue-400">Instruction on file — ready to dispatch</p>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={sentDate ? "outline" : "default"}
                                onClick={() => handleSelectBank(bank)}
                                data-testid={`button-select-bank-${bank.id}`}
                              >
                                {sentDate ? "Send Again" : "Send Dossier"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                }
              </div>
            </>
          )}

          {step === "confirm" && selectedBank && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Confirm Dispatch to {selectedBank.name}
                </DialogTitle>
                <DialogDescription>
                  The following verified information will be sent to <strong>{selectedBank.name}</strong>. No forms to fill — this is pulled directly from your verified company profile.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Company</span>
                    <span className="text-sm font-medium">{group.companyName}</span>
                  </div>
                  {group.rcNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">RC Number</span>
                      <span className="text-sm font-medium">{group.rcNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Verification Status</span>
                    <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Included in dossier</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      KYB Verification Result (Smile ID / CAC lookup)
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      Director AML screening results
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      Shareholder register
                    </li>
                    {uploadedDocs.length > 0 ? (
                      uploadedDocs.map(d => (
                        <li key={d.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          {d.label}
                        </li>
                      ))
                    ) : (
                      <li className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        No vault documents uploaded yet — the bank may request them separately
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={dispatchMutation.isPending}
                  data-testid="button-back-bank-select"
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={() => dispatchMutation.mutate()}
                  disabled={dispatchMutation.isPending}
                  data-testid="button-confirm-dispatch"
                >
                  {dispatchMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Sending…</>
                    : <><Send className="h-4 w-4 mr-1.5" /> Confirm & Send to {selectedBank.name}</>
                  }
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({ doc }: { doc: DocumentFile }) {
  const { toast } = useToast();
  const [shared, setShared] = useState<boolean>(doc.shareWithBank ?? false);
  const [sharedWithLawyer, setSharedWithLawyer] = useState<boolean>(doc.shareWithLawyer ?? false);

  const toggleMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await apiRequest("PATCH", `/api/documents/${doc.id}/bank-share`, { shareWithBank: value });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: (value) => {
      setShared(value);
    },
    onError: (_err, value) => {
      setShared(!value);
      toast({ title: "Error", description: "Could not update bank sharing setting.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/vault"] });
    },
  });

  const lawyerToggleMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await apiRequest("PATCH", `/api/document-files/${doc.id}/share-with-lawyer`, { shareWithLawyer: value });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onMutate: (value) => {
      setSharedWithLawyer(value);
    },
    onError: (_err, value) => {
      setSharedWithLawyer(!value);
      toast({ title: "Error", description: "Could not update lawyer sharing setting.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/lawyer-doc-requests"] });
    },
  });

  return (
    <div
      className="flex items-start justify-between py-3 first:pt-0 last:pb-0 gap-3"
      data-testid={`document-${doc.id}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{doc.filename}</p>
          <p className="text-sm text-muted-foreground">
            {doc.docType} &bull; {formatFileSize(doc.sizeBytes)}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id={`bank-share-${doc.id}`}
              checked={shared}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
              disabled={toggleMutation.isPending}
              data-testid={`switch-bank-share-${doc.id}`}
            />
            <label htmlFor={`bank-share-${doc.id}`} className="cursor-pointer select-none">
              {shared ? (
                <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium hover:bg-primary/10">
                  Shared with bank
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  Bank: Private
                </Badge>
              )}
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`lawyer-share-${doc.id}`}
              checked={sharedWithLawyer}
              onCheckedChange={(v) => lawyerToggleMutation.mutate(v)}
              disabled={lawyerToggleMutation.isPending}
              data-testid={`switch-lawyer-share-${doc.id}`}
            />
            <label htmlFor={`lawyer-share-${doc.id}`} className="cursor-pointer select-none">
              {sharedWithLawyer ? (
                <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium hover:bg-blue-100">
                  <Scale className="h-3 w-3 mr-1" />
                  Shared with lawyer
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  Lawyer: Private
                </Badge>
              )}
            </label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            data-testid={`button-download-${doc.id}`}
          >
            <a href={`/api/documents/${doc.id}/download`} download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VaultPage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<VaultData>({
    queryKey: ["/api/founder/vault"],
  });

  const { data: bankDocRequests } = useQuery<BankDocRequest[]>({
    queryKey: ["/api/founder/bank-doc-requests"],
  });

  const { data: lawyerDocRequests } = useQuery<LawyerDocumentRequest[]>({
    queryKey: ["/api/founder/lawyer-doc-requests"],
  });

  const [dismissedRequests, setDismissedRequests] = useState<Set<number>>(new Set());
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set());

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/founder/bank-doc-requests/${id}/dismiss`, {});
      return res.json();
    },
    onSuccess: (_data, id) => {
      setDismissingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/bank-doc-requests"] });
    },
    onError: (_err, id) => {
      setDismissingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      setDismissedRequests(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast({ title: "Could not dismiss", description: "Please try again.", variant: "destructive" });
    },
  });

  const openRequests = (bankDocRequests ?? []).filter(r => !dismissedRequests.has(r.id));

  const groupedDocs = data?.documents?.reduce((acc, doc) => {
    const category = doc.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, DocumentFile[]>) || {};

  const [activeTab, setActiveTab] = useState("documents");

  const hasCompanyDocs = (data?.companyDocuments?.length ?? 0) > 0;

  const renderDocuments = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    const hasPlatformDocs = (data?.documents?.length ?? 0) > 0;

    return (
      <div className="space-y-8">
        {hasCompanyDocs && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Company KYC Documents</h2>
              <p className="text-sm text-muted-foreground">Upload documents for your verified existing companies. These are sent to the bank when you apply for corporate account opening.</p>
            </div>
            {data?.companyDocuments?.map(group => (
              <CompanyDocumentsSection key={group.profileId} group={group} />
            ))}
          </div>
        )}

        {hasPlatformDocs ? (
          <div className="space-y-4">
            {hasCompanyDocs && (
              <div>
                <h2 className="text-base font-semibold">Platform Documents</h2>
                <p className="text-sm text-muted-foreground">Documents generated by Cellion One for your applications. Toggle "Share with bank" to make a document available for download by your partner bank.</p>
              </div>
            )}
            {Object.entries(groupedDocs).map(([category, docs]) => {
              const config = categoryConfig[category] || { label: category, icon: FileText };
              const Icon = config.icon;

              return (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="h-5 w-5 text-primary" />
                      {config.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y">
                      {docs.map((doc) => (
                        <DocumentRow key={doc.id} doc={doc} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : !hasCompanyDocs ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Your uploaded documents and completed certificates will appear here."
          />
        ) : null}
      </div>
    );
  };

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Document Vault" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-muted-foreground">
            Upload company documents and access all certificates in one secure place.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="tab-documents">
              <FolderOpen className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex items-center gap-2" data-testid="tab-receipts">
              <Receipt className="h-4 w-4" />
              Receipts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-6">
            {openRequests.length > 0 && (
              <div className="space-y-3 mb-6">
                {openRequests.map(req => (
                  <Alert key={req.id} className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700" data-testid={`alert-bank-doc-request-${req.id}`}>
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-amber-800 dark:text-amber-300 font-semibold">
                      {req.bankName || "A bank"} has requested documents
                    </AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-400">
                      <p className="mb-1"><span className="font-medium">Requested:</span> {req.documentsRequested}</p>
                      {req.reason && <p className="mb-1"><span className="font-medium">Reason:</span> {req.reason}</p>}
                      <p className="text-xs mt-2">Toggle "Share with bank" on the relevant documents below to fulfil this request. The bank will be notified automatically.</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/40 h-7 text-xs"
                          disabled={dismissingIds.has(req.id)}
                          onClick={() => {
                            setDismissingIds(prev => new Set([...prev, req.id]));
                            setDismissedRequests(prev => new Set([...prev, req.id]));
                            dismissMutation.mutate(req.id);
                          }}
                          data-testid={`button-dismiss-request-${req.id}`}
                        >
                          {dismissingIds.has(req.id) ? "Dismissing…" : "Dismiss"}
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
            {(lawyerDocRequests?.length ?? 0) > 0 && (
              <div className="space-y-3 mb-6">
                {lawyerDocRequests!.map(req => (
                  <Alert key={req.id} className="border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700" data-testid={`alert-lawyer-doc-request-${req.id}`}>
                    <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold">
                      Your lawyer has requested documents
                    </AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-400">
                      <p className="mb-1"><span className="font-medium">Requested:</span> {req.documentsRequested}</p>
                      {req.reason && <p className="mb-1"><span className="font-medium">Reason:</span> {req.reason}</p>}
                      <p className="text-xs mt-2">Toggle "Share with lawyer" on the relevant documents below to respond to this request. Your lawyer will be notified automatically and can review the shared documents in their portal.</p>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
            {renderDocuments()}
          </TabsContent>

          <TabsContent value="receipts" className="mt-6">
            <ReceiptsList />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
