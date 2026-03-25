import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { CelionLogo } from "@/components/celion-logo";
import { LoadingSpinner, LoadingPage } from "@/components/loading-spinner";
import { StatusBadge } from "@/components/status-badge";
import { KYC_TERMS_VERSION } from "@/pages/kyc-service/terms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Shield, Upload, FileText, CheckCircle2, AlertCircle, Clock,
  User, Building2, Users, CreditCard, Send, Trash2, Eye, Loader2,
  ChevronRight, ExternalLink, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

type VerificationData = {
  request: {
    id: number;
    type: string;
    status: string;
    subjectName: string;
    subjectEmail: string;
    paymentResponsibility: string;
    paymentStatus: string;
    termsAcceptedAt: string | null;
    expiresAt: string;
    selfRegistered: boolean;
  };
  organisation: {
    id: number;
    name: string;
    logoPath: string | null;
    contactEmail: string;
  } | null;
  requirements: Array<{
    id: number;
    type: string;
    documentName: string;
    documentDescription: string | null;
    documentCategory: string;
    isMandatory: boolean;
    hasExpiry: boolean;
  }>;
  documents: Array<{
    id: number;
    requirementId: number;
    fileName: string;
    filePath: string;
    status: string;
    detectedDocumentType: string | null;
    extractedData: any;
    extractionConfirmed: boolean;
    expiryDate: string | null;
    reviewNote: string | null;
  }>;
  supplierProfile: any | null;
  people: Array<{
    id: number;
    fullName: string;
    email: string;
    role: string;
    requiresVerification: boolean;
    verificationStatus: string;
    individualRequestId: number | null;
  }>;
};

const STEPS_INDIVIDUAL = ["Terms", "Documents", "Submit"];
const STEPS_SUPPLIER = ["Terms", "Profile", "Documents", "People", "Submit"];
const STEPS_WITH_PAYMENT_INDIVIDUAL = ["Terms", "Documents", "Payment", "Submit"];
const STEPS_WITH_PAYMENT_SUPPLIER = ["Terms", "Profile", "Documents", "People", "Payment", "Submit"];

function getSteps(type: string, needsPayment: boolean) {
  if (type === "supplier") {
    return needsPayment ? STEPS_WITH_PAYMENT_SUPPLIER : STEPS_SUPPLIER;
  }
  return needsPayment ? STEPS_WITH_PAYMENT_INDIVIDUAL : STEPS_INDIVIDUAL;
}

function getCurrentStep(data: VerificationData): number {
  const { request } = data;
  if (!request.termsAcceptedAt) return 0;

  const needsPayment = request.paymentResponsibility === "subject" && request.paymentStatus !== "paid";
  const steps = getSteps(request.type, request.paymentResponsibility === "subject");

  if (request.type === "supplier" && !data.supplierProfile) return steps.indexOf("Profile");

  if (needsPayment) {
    const paymentIdx = steps.indexOf("Payment");
    if (paymentIdx >= 0) return paymentIdx;
  }

  if (request.status === "documents_submitted" || request.status === "under_review" || request.status === "verified" || request.status === "rejected") {
    return steps.length - 1;
  }

  return steps.indexOf("Documents");
}

function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="step-indicator">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              i === currentStep
                ? "bg-primary text-primary-foreground"
                : i < currentStep
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
            data-testid={`step-${step.toLowerCase()}`}
          >
            {i < currentStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            {step}
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

function TermsStep({ token, orgName, onAccepted }: { token: string; orgName: string; onAccepted: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/kyc-service/verify-request/${token}/accept`, { termsAccepted: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      onAccepted();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!isAuthenticated) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 mx-auto text-primary" />
          <h2 className="text-xl font-semibold" data-testid="text-login-required">Account Required</h2>
          <p className="text-muted-foreground">
            You need to log in or create an account to proceed with this verification for <strong>{orgName}</strong>.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button onClick={() => navigate(`/login?redirect=/kyc/verify/${token}`)} data-testid="button-login">
              Log In
            </Button>
            <Button variant="outline" onClick={() => navigate(`/register?redirect=/kyc/verify/${token}`)} data-testid="button-register">
              Create Account
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold" data-testid="text-terms-title">Verification Consent & Terms</h2>
        <p className="text-sm text-muted-foreground">
          Before proceeding, please read and accept the verification terms below. These terms explain how your data will be processed.
        </p>
      </div>

      <div className="border rounded-md p-4 max-h-96 overflow-auto space-y-4 text-sm" data-testid="terms-content">
        <p><strong>Version {KYC_TERMS_VERSION}</strong></p>

        <p>By accepting these terms, you consent to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The collection and processing of your personal data, including biometric data (selfie, liveness check) by Cellion's identity verification system</li>
          <li>AI-powered extraction of data from documents you upload</li>
          <li>Sharing of your verified data with <strong>{orgName}</strong> (the Requesting Organisation)</li>
          <li>Data retention for 7 years for regulatory compliance</li>
        </ul>

        <p>You have the right to access, rectify, or request deletion of your data. For full details, see the <a href="/kyc/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">full KYC Terms & Conditions</a>.</p>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(v) => setAccepted(!!v)}
          data-testid="checkbox-accept-terms"
        />
        <Label htmlFor="accept-terms" className="text-sm leading-snug cursor-pointer">
          I have read, understood, and accept the Verification Consent & Terms (Version {KYC_TERMS_VERSION}). I consent to the processing of my personal and biometric data as described.
        </Label>
      </div>

      <Button
        onClick={() => acceptMutation.mutate()}
        disabled={!accepted || acceptMutation.isPending}
        className="w-full"
        data-testid="button-accept-terms"
      >
        {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Accept & Continue
      </Button>
    </Card>
  );
}

function SupplierProfileStep({ token, existingProfile, onSaved }: { token: string; existingProfile: any; onSaved: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    companyName: existingProfile?.companyName || "",
    rcNumber: existingProfile?.rcNumber || "",
    tinNumber: existingProfile?.tinNumber || "",
    vatRegistered: existingProfile?.vatRegistered || false,
    yearEstablished: existingProfile?.yearEstablished || "",
    industryCategory: existingProfile?.industryCategory || "",
    headOfficeAddress: existingProfile?.headOfficeAddress || "",
    websiteUrl: existingProfile?.websiteUrl || "",
    contactPersonName: existingProfile?.contactPersonName || "",
    contactPersonEmail: existingProfile?.contactPersonEmail || "",
    contactPersonPhone: existingProfile?.contactPersonPhone || "",
    contactPersonRole: existingProfile?.contactPersonRole || "",
    bankName: existingProfile?.bankName || "",
    bankAccountNumber: existingProfile?.bankAccountNumber || "",
    bankAccountName: existingProfile?.bankAccountName || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        yearEstablished: formData.yearEstablished ? parseInt(formData.yearEstablished as string) : undefined,
      };
      const res = await apiRequest("POST", `/api/kyc-service/verify-request/${token}/supplier-profile`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      onSaved();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateField = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold" data-testid="text-profile-title">Company Profile</h2>
        <p className="text-sm text-muted-foreground">Provide your company details. These may be pre-filled from extracted documents.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Company Name *</Label>
          <Input value={formData.companyName} onChange={e => updateField("companyName", e.target.value)} data-testid="input-company-name" />
        </div>
        <div className="space-y-2">
          <Label>RC Number</Label>
          <Input value={formData.rcNumber} onChange={e => updateField("rcNumber", e.target.value)} data-testid="input-rc-number" />
        </div>
        <div className="space-y-2">
          <Label>TIN Number</Label>
          <Input value={formData.tinNumber} onChange={e => updateField("tinNumber", e.target.value)} data-testid="input-tin-number" />
        </div>
        <div className="space-y-2">
          <Label>Year Established</Label>
          <Input type="number" value={formData.yearEstablished} onChange={e => updateField("yearEstablished", e.target.value)} data-testid="input-year-established" />
        </div>
        <div className="space-y-2">
          <Label>Industry Category</Label>
          <Input value={formData.industryCategory} onChange={e => updateField("industryCategory", e.target.value)} data-testid="input-industry" />
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={formData.websiteUrl} onChange={e => updateField("websiteUrl", e.target.value)} data-testid="input-website" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Head Office Address</Label>
          <Textarea value={formData.headOfficeAddress} onChange={e => updateField("headOfficeAddress", e.target.value)} data-testid="input-address" />
        </div>

        <Separator className="sm:col-span-2" />

        <div className="space-y-2">
          <Label>Contact Person Name *</Label>
          <Input value={formData.contactPersonName} onChange={e => updateField("contactPersonName", e.target.value)} data-testid="input-contact-name" />
        </div>
        <div className="space-y-2">
          <Label>Contact Person Email *</Label>
          <Input type="email" value={formData.contactPersonEmail} onChange={e => updateField("contactPersonEmail", e.target.value)} data-testid="input-contact-email" />
        </div>
        <div className="space-y-2">
          <Label>Contact Person Phone</Label>
          <Input value={formData.contactPersonPhone} onChange={e => updateField("contactPersonPhone", e.target.value)} data-testid="input-contact-phone" />
        </div>
        <div className="space-y-2">
          <Label>Contact Person Role</Label>
          <Input value={formData.contactPersonRole} onChange={e => updateField("contactPersonRole", e.target.value)} data-testid="input-contact-role" />
        </div>

        <Separator className="sm:col-span-2" />

        <div className="space-y-2">
          <Label>Bank Name</Label>
          <Input value={formData.bankName} onChange={e => updateField("bankName", e.target.value)} data-testid="input-bank-name" />
        </div>
        <div className="space-y-2">
          <Label>Bank Account Number</Label>
          <Input value={formData.bankAccountNumber} onChange={e => updateField("bankAccountNumber", e.target.value)} data-testid="input-bank-account" />
        </div>
        <div className="space-y-2">
          <Label>Bank Account Name</Label>
          <Input value={formData.bankAccountName} onChange={e => updateField("bankAccountName", e.target.value)} data-testid="input-bank-account-name" />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="vat-registered"
            checked={formData.vatRegistered}
            onCheckedChange={(v) => updateField("vatRegistered", !!v)}
            data-testid="checkbox-vat"
          />
          <Label htmlFor="vat-registered">VAT Registered</Label>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={!formData.companyName || !formData.contactPersonName || !formData.contactPersonEmail || saveMutation.isPending}
        className="w-full"
        data-testid="button-save-profile"
      >
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save & Continue
      </Button>
    </Card>
  );
}

function DocumentsStep({ token, requirements, documents, onUploaded }: {
  token: string;
  requirements: VerificationData["requirements"];
  documents: VerificationData["documents"];
  onUploaded: () => void;
}) {
  const { toast } = useToast();

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold" data-testid="text-documents-title">Document Upload</h2>
        <p className="text-sm text-muted-foreground">Upload the required documents. Mandatory items are marked with an asterisk.</p>
      </div>

      <div className="space-y-4">
        {requirements.map(req => {
          const uploadedDoc = documents.find(d => d.requirementId === req.id);
          return (
            <DocumentRequirementRow
              key={req.id}
              requirement={req}
              uploadedDoc={uploadedDoc}
              token={token}
              onUploaded={onUploaded}
            />
          );
        })}
      </div>
    </Card>
  );
}

function DocumentRequirementRow({ requirement, uploadedDoc, token, onUploaded }: {
  requirement: VerificationData["requirements"][0];
  uploadedDoc?: VerificationData["documents"][0];
  token: string;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const urlRes = await apiRequest("POST", "/api/kyc-service/upload-url", {});
      const { uploadURL } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      const filePath = new URL(uploadURL).pathname;

      await apiRequest("POST", `/api/kyc-service/verify-request/${token}/documents`, {
        requirementId: requirement.id,
        fileName: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type,
        expiryDate: expiryDate || undefined,
      });

      toast({ title: "Document uploaded" });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      onUploaded();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/kyc-service/verify-request/${token}/documents/${uploadedDoc!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      toast({ title: "Document removed" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/kyc-service/verify-request/${token}/documents/${uploadedDoc!.id}/confirm-extraction`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      toast({ title: "Extraction confirmed" });
    },
  });

  return (
    <div className="border rounded-md p-4 space-y-3" data-testid={`doc-requirement-${requirement.id}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{requirement.documentName}</span>
            {requirement.isMandatory && <Badge variant="secondary" className="text-xs">Required</Badge>}
            {requirement.hasExpiry && <Badge variant="outline" className="text-xs">Has Expiry</Badge>}
          </div>
          {requirement.documentDescription && (
            <p className="text-xs text-muted-foreground mt-1">{requirement.documentDescription}</p>
          )}
        </div>
        {uploadedDoc && <StatusBadge status={uploadedDoc.status} />}
      </div>

      {uploadedDoc ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{uploadedDoc.fileName}</span>
          </div>

          {uploadedDoc.status === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting data...
            </div>
          )}

          {uploadedDoc.status === "extracted" && uploadedDoc.extractedData && !uploadedDoc.extractionConfirmed && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Extracted Data:</p>
              <div className="bg-muted rounded-md p-3 text-xs space-y-1">
                {Object.entries(uploadedDoc.extractedData as Record<string, any>).map(([key, value]) => {
                  if (key === "confidence" || key === "documentType") return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                      <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  );
                })}
              </div>
              <Button size="sm" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending} data-testid={`button-confirm-extraction-${uploadedDoc.id}`}>
                {confirmMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Confirm Extracted Data
              </Button>
            </div>
          )}

          {uploadedDoc.extractionConfirmed && (
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Data confirmed
            </div>
          )}

          {uploadedDoc.reviewNote && (
            <div className="bg-destructive/10 rounded-md p-2 text-sm">
              <span className="font-medium">Review note:</span> {uploadedDoc.reviewNote}
            </div>
          )}

          {(uploadedDoc.status === "uploaded" || uploadedDoc.status === "extracted") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-doc-${uploadedDoc.id}`}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {requirement.hasExpiry && (
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="max-w-xs" data-testid={`input-expiry-${requirement.id}`} />
            </div>
          )}
          <div className="relative">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              data-testid={`input-file-${requirement.id}`}
            />
            <Button variant="outline" disabled={uploading} className="pointer-events-none">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading..." : "Choose File"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleStep({ token, people, onUpdated }: {
  token: string;
  people: VerificationData["people"];
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newPerson, setNewPerson] = useState({ fullName: "", email: "", role: "director" as string, requiresVerification: false });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/kyc-service/verify-request/${token}/people`, newPerson);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      setNewPerson({ fullName: "", email: "", role: "director", requiresVerification: false });
      setShowAdd(false);
      toast({ title: "Person added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (personId: number) => {
      await apiRequest("DELETE", `/api/kyc-service/verify-request/${token}/people/${personId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      toast({ title: "Person removed" });
    },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async (personId: number) => {
      const res = await apiRequest("POST", `/api/kyc-service/verify-request/${token}/people/${personId}/send-verification`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      toast({ title: "Verification invite sent" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusColors: Record<string, string> = {
    not_required: "bg-muted text-muted-foreground",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold" data-testid="text-people-title">Directors & Significant Persons</h2>
          <p className="text-sm text-muted-foreground">Add directors, shareholders, and other significant persons. You can send individual verification requests.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-person">
          <Users className="h-4 w-4 mr-1" /> Add Person
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-sm">Full Name *</Label>
              <Input value={newPerson.fullName} onChange={e => setNewPerson(p => ({ ...p, fullName: e.target.value }))} data-testid="input-person-name" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Email *</Label>
              <Input type="email" value={newPerson.email} onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))} data-testid="input-person-email" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Role</Label>
              <Select value={newPerson.role} onValueChange={v => setNewPerson(p => ({ ...p, role: v }))}>
                <SelectTrigger data-testid="select-person-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="shareholder">Shareholder</SelectItem>
                  <SelectItem value="signatory">Signatory</SelectItem>
                  <SelectItem value="beneficial_owner">Beneficial Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="requires-verification"
                checked={newPerson.requiresVerification}
                onCheckedChange={(v) => setNewPerson(p => ({ ...p, requiresVerification: !!v }))}
                data-testid="checkbox-requires-verification"
              />
              <Label htmlFor="requires-verification" className="text-sm">Requires individual verification</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={!newPerson.fullName || !newPerson.email || addMutation.isPending} data-testid="button-save-person">
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} data-testid="button-cancel-person">Cancel</Button>
          </div>
        </div>
      )}

      {people.length === 0 && !showAdd ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No persons added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {people.map(person => (
            <div key={person.id} className="flex items-center justify-between gap-2 border rounded-md p-3 flex-wrap" data-testid={`person-row-${person.id}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="font-medium text-sm">{person.fullName}</p>
                  <p className="text-xs text-muted-foreground">{person.email}</p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{person.role.replace("_", " ")}</Badge>
                {person.requiresVerification && (
                  <Badge className={`text-xs border-0 ${statusColors[person.verificationStatus] || ""}`}>
                    {person.verificationStatus.replace("_", " ")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {person.requiresVerification && !person.individualRequestId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendVerificationMutation.mutate(person.id)}
                    disabled={sendVerificationMutation.isPending}
                    data-testid={`button-send-verification-${person.id}`}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" /> Send Verification
                  </Button>
                )}
                {person.individualRequestId && (
                  <Badge variant="secondary" className="text-xs">Invite Sent</Badge>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeMutation.mutate(person.id)}
                  disabled={removeMutation.isPending}
                  data-testid={`button-remove-person-${person.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PaymentStep({ token, request }: { token: string; request: VerificationData["request"] }) {
  const { toast } = useToast();

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/kyc-service/verify-request/${token}/initialize-payment`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    },
    onError: (err: Error) => {
      toast({ title: "Payment error", description: err.message, variant: "destructive" });
    },
  });

  if (request.paymentStatus === "paid") {
    return (
      <Card className="p-6 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 dark:text-green-400" />
        <h2 className="text-xl font-semibold" data-testid="text-payment-complete">Payment Complete</h2>
        <p className="text-muted-foreground">Your payment has been received. You can proceed.</p>
      </Card>
    );
  }

  const amount = request.type === "individual" ? "10,000" : "100,000";

  return (
    <Card className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <CreditCard className="h-10 w-10 mx-auto text-primary" />
        <h2 className="text-xl font-semibold" data-testid="text-payment-title">Payment Required</h2>
        <p className="text-muted-foreground">
          A payment of <strong>&#x20A6;{amount}</strong> is required for your {request.type === "individual" ? "identity" : "corporate"} verification.
        </p>
      </div>
      <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending} className="w-full" data-testid="button-pay">
        {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
        Pay &#x20A6;{amount}
      </Button>
    </Card>
  );
}

function SubmitStep({ token, data }: { token: string; data: VerificationData }) {
  const { toast } = useToast();
  const { request, requirements, documents } = data;

  const mandatoryReqs = requirements.filter(r => r.isMandatory);
  const submittedReqIds = new Set(documents.map(d => d.requirementId));
  const missingMandatory = mandatoryReqs.filter(r => !submittedReqIds.has(r.id));
  const needsSupplierProfile = request.type === "supplier" && !data.supplierProfile;
  const needsPayment = request.paymentResponsibility === "subject" && request.paymentStatus !== "paid";

  const canSubmit = missingMandatory.length === 0 && !needsSupplierProfile && !needsPayment;
  const isSubmitted = ["documents_submitted", "under_review", "verified", "rejected"].includes(request.status);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/kyc-service/verify-request/${token}/submit`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
      toast({ title: "Verification submitted for review" });
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  if (isSubmitted) {
    const statusMessages: Record<string, { icon: any; title: string; desc: string }> = {
      documents_submitted: { icon: Clock, title: "Submitted for Review", desc: "Your documents are being reviewed. You will be notified once the review is complete." },
      under_review: { icon: Eye, title: "Under Review", desc: "Your verification is currently being reviewed by the organisation." },
      verified: { icon: CheckCircle2, title: "Verified", desc: "Your verification has been approved." },
      rejected: { icon: AlertCircle, title: "Needs Attention", desc: "Your verification requires changes. Please check reviewer notes on your documents." },
    };
    const msg = statusMessages[request.status] || statusMessages.documents_submitted;
    const Icon = msg.icon;

    return (
      <Card className="p-6 text-center space-y-4">
        <Icon className={`h-12 w-12 mx-auto ${request.status === "verified" ? "text-green-600 dark:text-green-400" : request.status === "rejected" ? "text-destructive" : "text-primary"}`} />
        <h2 className="text-xl font-semibold" data-testid="text-submit-status">{msg.title}</h2>
        <p className="text-muted-foreground">{msg.desc}</p>
        <StatusBadge status={request.status} />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold" data-testid="text-submit-title">Review & Submit</h2>
        <p className="text-sm text-muted-foreground">Review your submission before sending it for review.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          <span>Documents uploaded: <strong>{documents.length}</strong> / {requirements.length}</span>
        </div>
        {data.supplierProfile && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Company profile completed
          </div>
        )}
        {data.people.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            <span>Directors/persons: {data.people.length}</span>
          </div>
        )}
      </div>

      {missingMandatory.length > 0 && (
        <div className="bg-destructive/10 rounded-md p-3 space-y-1">
          <p className="text-sm font-medium text-destructive">Missing mandatory documents:</p>
          <ul className="list-disc pl-5 text-sm text-destructive">
            {missingMandatory.map(r => <li key={r.id}>{r.documentName}</li>)}
          </ul>
        </div>
      )}

      {needsSupplierProfile && (
        <div className="bg-destructive/10 rounded-md p-2 text-sm text-destructive">
          Company profile must be completed before submission.
        </div>
      )}

      <Button
        onClick={() => submitMutation.mutate()}
        disabled={!canSubmit || submitMutation.isPending}
        className="w-full"
        data-testid="button-submit-verification"
      >
        {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Submit for Review
      </Button>
    </Card>
  );
}

export default function VerifyRequestPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery<VerificationData>({
    queryKey: ["/api/kyc-service/verify-request", token],
    enabled: !!token,
  });

  if (isLoading) return <LoadingPage />;

  if (error || !data) {
    const errorMessage = (error as Error)?.message || "";
    const isExpired = errorMessage.includes("410");

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold" data-testid="text-error-title">
            {isExpired ? "Verification Expired" : "Verification Not Found"}
          </h1>
          <p className="text-muted-foreground" data-testid="text-error-message">
            {isExpired
              ? "This verification request has expired. Please contact the requesting organisation."
              : "This verification link is invalid or has already been used."}
          </p>
          <Link href="/">
            <Button variant="outline" data-testid="link-home">
              <ArrowLeft className="h-4 w-4 mr-2" /> Go Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { request, organisation } = data;
  const needsPayment = request.paymentResponsibility === "subject";
  const steps = getSteps(request.type, needsPayment);
  const currentStep = getCurrentStep(data);

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3">
              <CelionLogo textClassName="font-bold text-lg" />
              {organisation && (
                <>
                  <Separator orientation="vertical" className="h-5" />
                  <span className="text-sm font-medium text-muted-foreground truncate" data-testid="text-org-name">{organisation.name}</span>
                </>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">{request.type} Verification</Badge>
              <StatusBadge status={request.status} />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-subject-name">{request.subjectName}</h1>
            <p className="text-sm text-muted-foreground">
              Expires: {new Date(request.expiresAt).toLocaleDateString("en-NG", { dateStyle: "long" })}
            </p>
          </div>

          <StepIndicator steps={steps} currentStep={currentStep} />

          {!request.termsAcceptedAt ? (
            <TermsStep
              token={token!}
              orgName={organisation?.name || "Organisation"}
              onAccepted={() => queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] })}
            />
          ) : (
            <>
              {request.type === "supplier" && steps[currentStep] === "Profile" && (
                <SupplierProfileStep
                  token={token!}
                  existingProfile={data.supplierProfile}
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] })}
                />
              )}

              {steps[currentStep] === "Documents" && (
                <DocumentsStep
                  token={token!}
                  requirements={data.requirements}
                  documents={data.documents}
                  onUploaded={() => queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] })}
                />
              )}

              {request.type === "supplier" && steps[currentStep] === "People" && (
                <PeopleStep
                  token={token!}
                  people={data.people}
                  onUpdated={() => queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] })}
                />
              )}

              {steps[currentStep] === "Payment" && (
                <PaymentStep token={token!} request={request} />
              )}

              {steps[currentStep] === "Submit" && (
                <SubmitStep token={token!} data={data} />
              )}

              {currentStep < steps.length - 1 && request.termsAcceptedAt && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {steps[currentStep] !== "Terms" && (
                    <p className="text-sm text-muted-foreground">
                      Complete this step to continue
                    </p>
                  )}
                </div>
              )}

              {request.termsAcceptedAt && steps[currentStep] !== "Submit" && (
                <div className="flex gap-2 flex-wrap">
                  {steps.map((step, i) => {
                    if (i === 0) return null;
                    const isActive = i === currentStep;
                    return (
                      <Button
                        key={step}
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/verify-request", token] });
                        }}
                        data-testid={`nav-step-${step.toLowerCase()}`}
                      >
                        {step}
                      </Button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
