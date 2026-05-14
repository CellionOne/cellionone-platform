import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import type { CompanyApplication, ApplicationChecklistItem, CompanyPerson, DocumentFile, Order, OrderItem } from "@shared/schema";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Users,
  FolderOpen,
  Download,
  Loader2,
  User,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Upload,
  MailCheck,
  CreditCard,
  PackageCheck,
  Send,
} from "lucide-react";

interface AdminAppDetail {
  application: CompanyApplication;
  checklistItems: ApplicationChecklistItem[];
  people: CompanyPerson[];
}

const STATUS_LABELS: Record<string, string> = {
  missing: "Missing",
  provided: "Provided",
  accepted: "Accepted",
  rejected: "Rejected",
  needs_attention: "Needs Attention",
};

const STATUS_COLORS: Record<string, string> = {
  missing: "bg-muted text-muted-foreground",
  provided: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  needs_attention: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

function ChecklistStatusIcon({ status }: { status: string }) {
  if (status === "accepted") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "rejected") return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === "needs_attention") return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  if (status === "provided") return <Clock className="h-4 w-4 text-blue-600" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function ChecklistItemRow({
  item,
  applicationId,
  compact = false,
}: {
  item: ApplicationChecklistItem;
  applicationId: number;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [localStatus, setLocalStatus] = useState(item.status || "missing");
  const [localNotes, setLocalNotes] = useState(item.reviewerNotes || "");
  const [editing, setEditing] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; reviewerNotes?: string }) =>
      apiRequest("PATCH", `/api/admin/applications/${applicationId}/checklist-items/${item.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", applicationId] });
      toast({ title: "Checklist item updated" });
      setEditing(false);
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ status: localStatus, reviewerNotes: localNotes || undefined });
  };

  // For compact (per-person) mode, strip the "PersonName — " prefix from label
  const displayLabel = compact
    ? item.label.includes(" — ") ? item.label.substring(item.label.indexOf(" — ") + 3) : item.label
    : item.label;

  return (
    <div
      className={`border rounded-lg p-3 space-y-2 ${compact ? "bg-muted/20" : ""}`}
      data-testid={`checklist-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">
            <ChecklistStatusIcon status={item.status || "missing"} />
          </div>
          <div className="min-w-0">
            <p className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{displayLabel}</p>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">{item.key}</p>
            )}
            {item.source && !compact && (
              <p className="text-xs text-muted-foreground">Source: {item.source}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status || "missing"]}`}>
            {STATUS_LABELS[item.status || "missing"]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setEditing(!editing)}
            data-testid={`button-edit-checklist-${item.id}`}
          >
            {editing ? "Cancel" : "Override"}
          </Button>
        </div>
      </div>

      {item.reviewerNotes && !editing && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 ml-6">
          Note: {item.reviewerNotes}
        </p>
      )}

      {editing && (
        <div className="ml-6 space-y-2 border-t pt-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium w-12 shrink-0">Status</label>
            <Select value={localStatus} onValueChange={setLocalStatus}>
              <SelectTrigger className="h-7 text-xs w-44" data-testid={`select-checklist-status-${item.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="missing">Missing</SelectItem>
                <SelectItem value="provided">Provided</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="needs_attention">Needs Attention</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start gap-2">
            <label className="text-xs font-medium w-12 shrink-0 mt-1.5">Notes</label>
            <Textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Optional reviewer notes..."
              rows={2}
              className="flex-1 text-xs"
              data-testid={`textarea-checklist-notes-${item.id}`}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid={`button-save-checklist-${item.id}`}
            >
              {updateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonUploadDialog({
  open,
  onOpenChange,
  person,
  applicationId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  person: CompanyPerson;
  applicationId: number;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("");
  const [category, setCategory] = useState("identity");
  const [uploading, setUploading] = useState(false);

  const personLabel = person.entityType === "corporate"
    ? person.corporateName || "Corporate Entity"
    : `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.inviteEmail || "Person";

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast({ title: "Please select a file", variant: "destructive" });
    if (!docType.trim()) return toast({ title: "Please enter a document name", variant: "destructive" });

    setUploading(true);
    try {
      const csrf = await getCsrfToken();
      const form = new FormData();
      form.append("file", file);
      form.append("docType", docType.trim());
      form.append("category", category);
      form.append("personId", String(person.id));

      const res = await fetch(`/api/applications/${applicationId}/documents/upload`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", applicationId, "documents"] });
      toast({ title: "Document uploaded successfully" });
      onOpenChange(false);
      setDocType("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document for {personLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Document Name / Type</Label>
            <Input
              placeholder="e.g. CAC Certificate, Board Resolution"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              data-testid="input-person-doc-type"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-person-doc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="identity">Identity</SelectItem>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="filing">Filing</SelectItem>
                <SelectItem value="stamped_originals">Stamped Originals</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>File</Label>
            <Input
              type="file"
              ref={fileRef}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              data-testid="input-person-doc-file"
            />
            <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, DOC or DOCX — max 10 MB</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={uploading} data-testid="button-confirm-person-upload">
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({
  person,
  personChecklist,
  applicationId,
  allDocs,
}: {
  person: CompanyPerson;
  personChecklist: ApplicationChecklistItem[];
  applicationId: number;
  allDocs: DocumentFile[];
}) {
  const isCorporate = person.entityType === "corporate";
  const [expanded, setExpanded] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const personDocs = allDocs.filter((d) => d.companyPersonId === person.id);

  const displayName = isCorporate
    ? person.corporateName
    : `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.inviteEmail;

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`person-row-${person.id}`}>
      {/* Header row */}
      <button
        className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-person-${person.id}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
            {isCorporate ? <Briefcase className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {person.role} &bull; {isCorporate ? `Corporate (${person.corporateBusinessType?.toUpperCase() || "CO"})` : "Individual"}
              {person.inviteEmail && !isCorporate && ` \u2022 ${person.inviteEmail}`}
            </p>
            {isCorporate && person.corporateRcNumber && (
              <p className="text-xs text-muted-foreground">RC: {person.corporateRcNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isCorporate ? (
            (person.isVerified || person.autoVerifyMethod) ? (
              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                {person.kybLookupStatus === "found" ? "KYB Verified" : person.autoVerifyMethod ? "Platform Verified" : "Verified"}
              </span>
            ) : person.kybLookupStatus === "not_found" ? (
              <span className="flex items-center gap-1 text-xs text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">
                <ShieldAlert className="h-3 w-3" />
                KYB Failed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <ShieldAlert className="h-3 w-3" />
                Pending KYB
              </span>
            )
          ) : person.isVerified ? (
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">
              <ShieldCheck className="h-3 w-3" />
              Verified
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <ShieldAlert className="h-3 w-3" />
              {person.inviteStatus === "accepted" ? "Pending KYC" : person.inviteStatus || "Pending"}
            </span>
          )}
          {personChecklist.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {personChecklist.filter(i => i.status === "accepted").length}/{personChecklist.length} docs
            </span>
          )}
          {personDocs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <Upload className="h-3 w-3" />
              {personDocs.length} file{personDocs.length !== 1 ? "s" : ""}
            </span>
          )}
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Document Requirements
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setUploadOpen(true)}
              data-testid={`button-upload-person-doc-${person.id}`}
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload Document
            </Button>
          </div>

          {personChecklist.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No document requirements on record for this person.
            </p>
          ) : (
            <div className="space-y-2">
              {personChecklist.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  applicationId={applicationId}
                  compact
                />
              ))}
            </div>
          )}

          {personDocs.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Uploaded Files ({personDocs.length})
              </p>
              <div className="space-y-1.5">
                {personDocs.map((doc) => {
                  const uploadedAt = doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "—";
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted/40"
                      data-testid={`person-doc-${doc.id}`}
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{doc.filename}</span>
                      <span className="text-muted-foreground shrink-0">{doc.docType}</span>
                      <span className="text-muted-foreground shrink-0 ml-auto">{uploadedAt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <PersonUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        person={person}
        applicationId={applicationId}
      />
    </div>
  );
}

function DocumentRow({ doc, people, applicationId }: { doc: DocumentFile; people?: CompanyPerson[]; applicationId?: number }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(doc.qualityStatus || "not_checked");

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await apiRequest("GET", `/api/documents/${doc.id}/download`);
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      } else {
        toast({ title: "Download URL unavailable", variant: "destructive" });
      }
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const statusMutation = useMutation({
    mutationFn: (qualityStatus: string) =>
      apiRequest("PATCH", `/api/admin/documents/${doc.id}/status`, { qualityStatus }),
    onSuccess: async (res, qualityStatus) => {
      setCurrentStatus(qualityStatus);
      if (applicationId) {
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", applicationId, "documents"] });
      }
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const toggleStatus = (newStatus: string) => {
    const next = currentStatus === newStatus ? "not_checked" : newStatus;
    statusMutation.mutate(next);
  };

  const uploadedAt = doc.createdAt
    ? new Date(doc.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const linkedPerson = people && doc.companyPersonId
    ? people.find((p) => p.id === doc.companyPersonId)
    : null;
  const personLabel = linkedPerson
    ? linkedPerson.entityType === "corporate"
      ? linkedPerson.corporateName || "Corporate Entity"
      : `${linkedPerson.firstName || ""} ${linkedPerson.lastName || ""}`.trim() || linkedPerson.inviteEmail || "Person"
    : null;

  return (
    <div
      className={`flex items-center justify-between gap-3 border rounded-lg px-4 py-3 transition-colors ${
        currentStatus === "pass" ? "border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-900/10" :
        currentStatus === "rejected" ? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-900/10" :
        currentStatus === "needs_attention" ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10" :
        ""
      }`}
      data-testid={`doc-row-${doc.id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{doc.filename}</p>
            {personLabel && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                {personLabel}
              </span>
            )}
            {currentStatus === "pass" && (
              <span className="text-xs text-green-700 dark:text-green-400 font-medium shrink-0">Accepted</span>
            )}
            {currentStatus === "rejected" && (
              <span className="text-xs text-red-700 dark:text-red-400 font-medium shrink-0">Rejected</span>
            )}
            {currentStatus === "needs_attention" && (
              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium shrink-0">Needs Attention</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {doc.docType} &bull; {doc.category} &bull; {uploadedAt}
            {doc.sizeBytes ? ` \u2022 ${(doc.sizeBytes / 1024).toFixed(0)} KB` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${currentStatus === "pass" ? "text-green-600 bg-green-100 dark:bg-green-900/30 hover:bg-green-200" : "text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`}
          onClick={() => toggleStatus("pass")}
          disabled={statusMutation.isPending}
          title="Accept document"
          data-testid={`button-accept-doc-${doc.id}`}
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${currentStatus === "rejected" ? "text-red-600 bg-red-100 dark:bg-red-900/30 hover:bg-red-200" : "text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"}`}
          onClick={() => toggleStatus("rejected")}
          disabled={statusMutation.isPending}
          title="Reject document"
          data-testid={`button-reject-doc-${doc.id}`}
        >
          <XCircle className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          data-testid={`button-download-doc-${doc.id}`}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="ml-1 hidden sm:inline">Download</span>
        </Button>
      </div>
    </div>
  );
}

function formatNgn(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

const ADD_ON_SKUS_SET = new Set(["TIN", "SCUML", "TM", "OFFICE_ONLY", "OFFICE_PLUS_MAIL", "ADD_DIR", "BANK_ACCOUNT"]);

function AdminChecklistUploadDialog({
  open,
  onOpenChange,
  applicationId,
  checklistItems,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationId: number;
  checklistItems: ApplicationChecklistItem[];
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [docType, setDocType] = useState("");
  const [category, setCategory] = useState("filing");
  const [uploading, setUploading] = useState(false);

  // Only show items that still need action
  const uploadableItems = checklistItems.filter(
    (i) => !i.status || i.status === "missing" || i.status === "rejected"
  );

  function resetForm() {
    setSelectedItemId("");
    setDocType("");
    setCategory("filing");
    if (fileRef.current) fileRef.current.value = "";
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast({ title: "Please select a file", variant: "destructive" });
    if (!selectedItemId) return toast({ title: "Please select a checklist item", variant: "destructive" });
    if (!docType.trim()) return toast({ title: "Please enter a document name", variant: "destructive" });

    setUploading(true);
    try {
      const csrf = await getCsrfToken();
      const form = new FormData();
      form.append("file", file);
      form.append("checklistItemId", selectedItemId);
      form.append("docType", docType.trim());
      form.append("category", category);

      const res = await fetch(`/api/admin/applications/${applicationId}/documents/upload`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Upload failed");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", applicationId, "documents"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", applicationId] });
      toast({ title: "Document uploaded", description: "Checklist item marked as provided." });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document to Checklist</DialogTitle>
        </DialogHeader>
        {uploadableItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            All checklist items are accepted or provided. No upload needed.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Checklist Item</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger data-testid="select-admin-checklist-item">
                  <SelectValue placeholder="Select a missing / rejected item…" />
                </SelectTrigger>
                <SelectContent>
                  {uploadableItems.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      <span>{item.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground capitalize">
                        ({item.status || "missing"})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Document Name</Label>
              <Input
                placeholder="e.g. Certified True Copy, Board Resolution"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                data-testid="input-admin-checklist-doc-type"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-admin-checklist-doc-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="identity">Identity</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="filing">Filing</SelectItem>
                  <SelectItem value="stamped_originals">Stamped Originals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>File</Label>
              <Input
                type="file"
                ref={fileRef}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                data-testid="input-admin-checklist-doc-file"
              />
              <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, DOC, DOCX · max 10 MB</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          {uploadableItems.length > 0 && (
            <Button
              onClick={handleUpload}
              disabled={uploading}
              data-testid="button-admin-checklist-upload-confirm"
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillingTab({ applicationId }: { applicationId: number }) {
  const { toast } = useToast();

  const { data: orderData, isLoading: orderLoading } = useQuery<{ order: Order; items: OrderItem[] } | null>({
    queryKey: ["/api/admin/applications", applicationId, "order"],
    queryFn: () =>
      fetch(`/api/admin/applications/${applicationId}/order`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load order");
        return r.json();
      }),
    enabled: applicationId > 0,
  });

  const toggleMutation = useMutation({
    mutationFn: (itemId: number) =>
      apiRequest("PATCH", `/api/admin/order-items/${itemId}/already-obtained`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", applicationId, "order"] });
      toast({ title: "Item updated" });
    },
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  if (orderLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>No order found for this application.</p>
        <p className="text-xs mt-1">An order is created when the founder proceeds to checkout.</p>
      </div>
    );
  }

  const { order, items } = orderData;
  const incorporationItems = items.filter((i) => i.sku.startsWith("CAC_") || i.sku === "NGO");
  const addOnItems = items.filter((i) => ADD_ON_SKUS_SET.has(i.sku));
  const billableTotal = items.filter((i) => !i.alreadyObtained).reduce((s, i) => s + i.unitPrice * (i.quantity || 1), 0);
  const adminFee = order.adminFeeAmount || 0;

  const statusColor =
    order.status === "paid" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
    order.status === "pending_payment" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" :
    order.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
    "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4" data-testid="billing-tab">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Order #{order.id}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`} data-testid="text-order-status">
              {order.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fulfilment</span>
            <span className="font-medium capitalize" data-testid="text-order-fulfilment">{order.fulfilmentStatus || "pending"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span className="font-medium">{order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Order Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {incorporationItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Incorporation</p>
              {incorporationItems.map((item) => {
                const lineTotal = item.unitPrice * (item.quantity || 1);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm" data-testid={`billing-item-${item.id}`}>
                    <div className="min-w-0">
                      <p className="font-medium">{item.sku}</p>
                      {(item.quantity || 1) > 1 && (
                        <p className="text-xs text-muted-foreground">{formatNgn(item.unitPrice)} × {item.quantity} names</p>
                      )}
                    </div>
                    <span className="font-semibold shrink-0">{formatNgn(lineTotal)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {addOnItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add-ons</p>
              {addOnItems.map((item) => {
                const lineTotal = item.unitPrice * (item.quantity || 1);
                const isObtained = !!item.alreadyObtained;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm transition-colors ${
                      isObtained ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10" : ""
                    }`}
                    data-testid={`billing-item-${item.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{item.sku}</p>
                        {isObtained && (
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-400" data-testid={`badge-obtained-${item.id}`}>
                            <PackageCheck className="h-3 w-3 mr-1" />
                            Already Obtained
                          </Badge>
                        )}
                      </div>
                      {isObtained && (
                        <p className="text-xs text-muted-foreground mt-0.5">Excluded from billing — admin marked as already obtained</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-semibold ${isObtained ? "line-through text-muted-foreground" : ""}`}>
                        {formatNgn(lineTotal)}
                      </span>
                      {order.status !== "paid" && (
                        <Button
                          variant={isObtained ? "default" : "outline"}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => toggleMutation.mutate(item.id)}
                          disabled={toggleMutation.isPending}
                          data-testid={`button-toggle-obtained-${item.id}`}
                        >
                          {toggleMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isObtained ? (
                            "Undo"
                          ) : (
                            "Mark Obtained"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Separator />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Billable subtotal</span>
              <span data-testid="text-billing-subtotal">{formatNgn(billableTotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Administration Fee (10%)</span>
              <span data-testid="text-billing-admin-fee">{formatNgn(adminFee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span data-testid="text-billing-total">{formatNgn(billableTotal + adminFee)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const applicationId = parseInt(id || "0");
  const { toast } = useToast();
  const [checklistUploadOpen, setChecklistUploadOpen] = useState(false);

  const { data, isLoading, error } = useQuery<AdminAppDetail>({
    queryKey: ["/api/admin/applications", applicationId],
    queryFn: () =>
      fetch(`/api/admin/applications/${applicationId}`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      }),
    enabled: !isNaN(applicationId) && applicationId > 0,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery<DocumentFile[]>({
    queryKey: ["/api/admin/applications", applicationId, "documents"],
    queryFn: () =>
      fetch(`/api/admin/applications/${applicationId}/documents`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load documents");
        return r.json();
      }),
    enabled: !isNaN(applicationId) && applicationId > 0,
  });

  const resendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/applications/${applicationId}/resend-completion`, {}),
    onSuccess: () => toast({ title: "Completion link resent to founder" }),
    onError: (err: any) => toast({ title: err?.message || "Failed to resend link", variant: "destructive" }),
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/applications/${applicationId}/send-payment-link`, {}),
    onSuccess: () => toast({ title: "Payment link sent", description: "The founder has been emailed a checkout link." }),
    onError: (err: any) => toast({ title: err?.message || "Failed to send payment link", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/admin/applications">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Applications
            </Button>
          </Link>
          <p className="text-muted-foreground">Application not found or access denied.</p>
        </div>
      </DashboardLayout>
    );
  }

  const { application, checklistItems, people } = data;

  // Split checklist into standard items and per-person requirement items
  const standardItems = checklistItems.filter((i) => i.source !== "people_requirement");
  const peopleReqItems = checklistItems.filter((i) => i.source === "people_requirement");

  // Build a map: personId → checklist items
  const personChecklistMap = new Map<number, ApplicationChecklistItem[]>();
  for (const item of peopleReqItems) {
    const match = (item.key ?? "").match(/^people_req_(\d+)_/);
    if (match) {
      const pid = parseInt(match[1], 10);
      if (!personChecklistMap.has(pid)) personChecklistMap.set(pid, []);
      personChecklistMap.get(pid)!.push(item);
    }
  }

  const checklistSummary = {
    total: checklistItems.length,
    accepted: checklistItems.filter((i) => i.status === "accepted").length,
    rejected: checklistItems.filter((i) => i.status === "rejected").length,
    missing: checklistItems.filter((i) => !i.status || i.status === "missing").length,
  };

  const canResend =
    application.applicationType === "incorporation" &&
    ["draft", "pending_verification", "submitted", "under_review"].includes(application.status || "");

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/applications">
            <Button variant="ghost" size="sm" data-testid="button-back-applications">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Applications
            </Button>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-app-name">
                {application.companyName1 || "Untitled Application"}
              </h1>
              <p className="text-muted-foreground text-sm">
                #{application.id} &bull; {application.companyType || "LTD"} &bull; {application.applicationType || "incorporation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={application.status || "draft"} />
            {(application.paymentState === "unpaid" && ["names_submitted","names_reviewed","pending_verification","submitted","under_review"].includes(application.status || "")) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendPaymentLinkMutation.mutate()}
                disabled={sendPaymentLinkMutation.isPending}
                data-testid="button-send-payment-link-detail"
              >
                {sendPaymentLinkMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Send Payment Link
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="checklist">
              Checklist
              {checklistItems.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                  {checklistSummary.accepted}/{checklistSummary.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="people">
              People
              {people.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{people.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents
              {documents.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{documents.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Application Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge status={application.status || "draft"} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="font-medium capitalize">{application.paymentState || "unpaid"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium capitalize">{application.applicationType || "incorporation"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company Type</span>
                    <span className="font-medium">{application.companyType || "LTD"}</span>
                  </div>
                  {application.rcNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RC Number</span>
                      <span className="font-medium text-primary">{application.rcNumber}</span>
                    </div>
                  )}
                  {canResend && (
                    <div className="pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => resendMutation.mutate()}
                        disabled={resendMutation.isPending}
                        data-testid="button-resend-completion-link"
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <MailCheck className="h-4 w-4 mr-2" />
                        )}
                        Resend Completion Link to Founder
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Checklist Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total items</span>
                    <span className="font-medium">{checklistSummary.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Accepted</span>
                    <span className="font-medium text-green-600">{checklistSummary.accepted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rejected</span>
                    <span className="font-medium text-red-600">{checklistSummary.rejected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missing</span>
                    <span className="font-medium text-muted-foreground">{checklistSummary.missing}</span>
                  </div>
                </CardContent>
              </Card>

              {(application.registeredAddress || application.operatingAddress) && (
                <Card className="sm:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Addresses</CardTitle>
                  </CardHeader>
                  <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                    {application.registeredAddress && (
                      <div>
                        <p className="text-muted-foreground mb-1">Registered Address</p>
                        <p className="font-medium whitespace-pre-wrap">
                          {typeof application.registeredAddress === "object"
                            ? JSON.stringify(application.registeredAddress, null, 2)
                            : application.registeredAddress}
                        </p>
                      </div>
                    )}
                    {application.operatingAddress && (
                      <div>
                        <p className="text-muted-foreground mb-1">Operating Address</p>
                        <p className="font-medium whitespace-pre-wrap">
                          {typeof application.operatingAddress === "object"
                            ? JSON.stringify(application.operatingAddress, null, 2)
                            : application.operatingAddress}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {application.businessDescription && (
                <Card className="sm:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Business Description</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>{application.businessDescription}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── Checklist ── */}
          <TabsContent value="checklist" className="mt-4 space-y-6">
            {standardItems.length === 0 && peopleReqItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No checklist items for this application.</p>
              </div>
            ) : (
              <>
                {standardItems.length > 0 && (
                  <div className="space-y-3">
                    {peopleReqItems.length > 0 && (
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Application Requirements
                      </h3>
                    )}
                    {standardItems.map((item) => (
                      <ChecklistItemRow key={item.id} item={item} applicationId={applicationId} />
                    ))}
                  </div>
                )}
                {peopleReqItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      People &amp; Entity Documents
                    </h3>
                    {peopleReqItems.map((item) => (
                      <ChecklistItemRow key={item.id} item={item} applicationId={applicationId} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── People ── */}
          <TabsContent value="people" className="mt-4">
            {people.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No directors or shareholders on record yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Click a person to expand their document requirements and upload additional files.
                </p>
                {people.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    personChecklist={personChecklistMap.get(person.id) ?? []}
                    applicationId={applicationId}
                    allDocs={documents}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Documents ── */}
          <TabsContent value="documents" className="mt-4 space-y-4">
            {/* Admin upload action */}
            {checklistItems.some((i) => !i.status || i.status === "missing" || i.status === "rejected") && (
              <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
                <div>
                  <p className="text-sm font-medium">Upload to Checklist</p>
                  <p className="text-xs text-muted-foreground">
                    {checklistItems.filter((i) => !i.status || i.status === "missing" || i.status === "rejected").length} item(s) still missing or rejected
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChecklistUploadOpen(true)}
                  data-testid="button-admin-upload-checklist-doc"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Upload Document
                </Button>
              </div>
            )}

            {docsLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} people={people} applicationId={applicationId} />
                ))}
              </div>
            )}

            <AdminChecklistUploadDialog
              open={checklistUploadOpen}
              onOpenChange={setChecklistUploadOpen}
              applicationId={applicationId}
              checklistItems={checklistItems}
            />
          </TabsContent>

          {/* ── Billing ── */}
          <TabsContent value="billing" className="mt-4">
            <BillingTab applicationId={applicationId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
