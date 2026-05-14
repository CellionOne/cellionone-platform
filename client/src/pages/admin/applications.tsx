import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import {
  Building2,
  Search,
  Filter,
  UserPlus,
  CreditCard,
  Send,
  Loader2,
  ShoppingCart,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Banknote,
  Wallet,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Pencil,
  MailCheck,
  Plus,
  Upload,
  Trash2,
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
import { Separator } from "@/components/ui/separator";
import type { CompanyApplication, LawyerProfile, PayoutLedger } from "@shared/schema";

interface BankPartnerBasic { id: number; name: string; }

interface WizardDirector {
  localId: string;
  personType: "individual" | "corporate";
  fullName: string;
  email: string;
  role: string;
  sharesAllocated: string;
  shareClass: string;
  sharePercentage: string;
  corporateName: string;
  corporateRcNumber: string;
  corporateCountry: string;
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

interface ApplicationWithLawyer extends CompanyApplication {
  lawyerName?: string;
}

interface AbandonedCartItem {
  id: number;
  companyName: string;
  companyType: string;
  applicationType: string | null;
  founderEmail: string | null;
  founderName: string | null;
  createdAt: string | null;
  ageDays: number;
  ageBucket: "lt_24h" | "1_3d" | "3_7d" | "gt_7d";
  remindersCount: number;
  lastReminderAt: string | null;
  isLegacyDraft: boolean;
}

interface AbandonedCartsData {
  summary: {
    total: number;
    legacy: number;
    byBucket: { lt_24h: number; "1_3d": number; "3_7d": number; gt_7d: number };
  };
  list: AbandonedCartItem[];
}

const paymentTransitionOptions = [
  { value: "released_to_lawyer", label: "Release to Lawyer", description: "Release escrowed funds to assigned lawyer" },
  { value: "refunded_partial", label: "Partial Refund", description: "Process a partial refund to the founder" },
  { value: "refunded_full", label: "Full Refund", description: "Process a full refund to the founder" },
  { value: "chargeback", label: "Chargeback", description: "Record a payment chargeback" },
];

const bucketLabels: Record<string, string> = {
  lt_24h: "< 24 hours",
  "1_3d": "1 – 3 days",
  "3_7d": "3 – 7 days",
  gt_7d: "> 7 days",
};

const bucketColors: Record<string, string> = {
  lt_24h: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "1_3d": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "3_7d": "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  gt_7d: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function formatAge(ageDays: number): string {
  if (ageDays < 1) return "< 1 day";
  if (ageDays === 1) return "1 day";
  return `${ageDays} days`;
}

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
  const [abandonedCartsExpanded, setAbandonedCartsExpanded] = useState(false);
  const [abandonedCartSearch, setAbandonedCartSearch] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);
  const [inlineLawyerId, setInlineLawyerId] = useState<string>("");
  const [isReassignment, setIsReassignment] = useState(false);
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false);
  const [bankDetailsLawyerId, setBankDetailsLawyerId] = useState<string>("");
  const [bankAcctName, setBankAcctName] = useState("");
  const [bankAcctNumber, setBankAcctNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [lawyersExpanded, setLawyersExpanded] = useState(false);
  const [payoutsExpanded, setPayoutsExpanded] = useState(false);
  const [lawyerFeeNaira, setLawyerFeeNaira] = useState<string>("");

  // Create Application for Founder wizard state
  const [createAppOpen, setCreateAppOpen] = useState(false);
  const [createWizardStep, setCreateWizardStep] = useState(1);
  const [createdAppId, setCreatedAppId] = useState<number | null>(null);
  const [createFounderUserId, setCreateFounderUserId] = useState("");
  const [createCompanyType, setCreateCompanyType] = useState("LTD");
  const [createCompanyName1, setCreateCompanyName1] = useState("");
  const [createCompanyName2, setCreateCompanyName2] = useState("");
  const [createCompanyName3, setCreateCompanyName3] = useState("");
  const [createBusinessDesc, setCreateBusinessDesc] = useState("");
  const [createDirectors, setCreateDirectors] = useState<WizardDirector[]>([]);
  const [newDirPersonType, setNewDirPersonType] = useState<"individual" | "corporate">("individual");
  const [newDirName, setNewDirName] = useState("");
  const [newDirEmail, setNewDirEmail] = useState("");
  const [newDirRole, setNewDirRole] = useState("director_and_shareholder");
  const [newDirShares, setNewDirShares] = useState("");
  const [newDirShareClass, setNewDirShareClass] = useState("ordinary");
  const [newDirCorporateName, setNewDirCorporateName] = useState("");
  const [newDirCorporateRcNumber, setNewDirCorporateRcNumber] = useState("");
  const [newDirCorporateCountry, setNewDirCorporateCountry] = useState("Nigeria");
  const [wizardUploadFile, setWizardUploadFile] = useState<File | null>(null);
  const [wizardUploadDocType, setWizardUploadDocType] = useState("id_document");
  const [wizardUploadChecklistItemId, setWizardUploadChecklistItemId] = useState("");
  const [wizardUploadedFiles, setWizardUploadedFiles] = useState<{ name: string; docType: string }[]>([]);
  const [createRegLine1, setCreateRegLine1] = useState("");
  const [createRegCity, setCreateRegCity] = useState("");
  const [createRegState, setCreateRegState] = useState("Lagos");
  const [createSameAddress, setCreateSameAddress] = useState(true);
  const [createOpsLine1, setCreateOpsLine1] = useState("");
  const [createOpsCity, setCreateOpsCity] = useState("");
  const [createOpsState, setCreateOpsState] = useState("Lagos");

  // Upload Document for Application dialog state
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [uploadDocApp, setUploadDocApp] = useState<ApplicationWithLawyer | null>(null);
  const [uploadDocChecklistItemId, setUploadDocChecklistItemId] = useState("");
  const [uploadDocType, setUploadDocType] = useState("uploaded_document");
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);

  // Edit Profile dialog state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editProfileApp, setEditProfileApp] = useState<ApplicationWithLawyer | null>(null);
  const [editCompanyName1, setEditCompanyName1] = useState("");
  const [editCompanyName2, setEditCompanyName2] = useState("");
  const [editCompanyName3, setEditCompanyName3] = useState("");
  const [editCompanyType, setEditCompanyType] = useState("LTD");
  const [editBusinessDescription, setEditBusinessDescription] = useState("");
  const [editActivities, setEditActivities] = useState("");
  const [editRegLine1, setEditRegLine1] = useState("");
  const [editRegLine2, setEditRegLine2] = useState("");
  const [editRegCity, setEditRegCity] = useState("");
  const [editRegState, setEditRegState] = useState("");
  const [editRegPostalCode, setEditRegPostalCode] = useState("");
  const [editRegCountry, setEditRegCountry] = useState("Nigeria");
  const [editOpsLine1, setEditOpsLine1] = useState("");
  const [editOpsLine2, setEditOpsLine2] = useState("");
  const [editOpsCity, setEditOpsCity] = useState("");
  const [editOpsState, setEditOpsState] = useState("");
  const [editOpsPostalCode, setEditOpsPostalCode] = useState("");
  const [editOpsCountry, setEditOpsCountry] = useState("Nigeria");
  const [editDirectorsJson, setEditDirectorsJson] = useState("");
  const [editShareholdersJson, setEditShareholdersJson] = useState("");
  const [directorsJsonError, setDirectorsJsonError] = useState("");
  const [shareholdersJsonError, setShareholdersJsonError] = useState("");

  const { data: applications, isLoading } = useQuery<ApplicationWithLawyer[]>({
    queryKey: ["/api/admin/applications"],
  });

  const { data: lawyers } = useQuery<(LawyerProfile & { email: string; name: string })[]>({
    queryKey: ["/api/admin/lawyers"],
  });

  const { data: bankPartners = [] } = useQuery<BankPartnerBasic[]>({
    queryKey: ["/api/admin/banking-partners"],
  });

  const { data: paystackBanks = [] } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/admin/banks"],
    enabled: bankDetailsOpen,
  });

  const { data: payouts = [] } = useQuery<(PayoutLedger & { lawyerName: string; lawyerEmail?: string; applicationId?: number | null; companyName?: string | null })[]>({
    queryKey: ["/api/admin/payouts"],
    enabled: payoutsExpanded,
  });

  const { data: abandonedCarts } = useQuery<AbandonedCartsData>({
    queryKey: ["/api/admin/abandoned-carts"],
  });

  const { data: appPaymentDetails } = useQuery<{
    amountTotalKobo: number;
    lawyerFeeKobo: number | null;
    wasSplitAtCheckout: boolean;
    source: string;
  } | null>({
    queryKey: ["/api/admin/applications", selectedApp?.id, "payment"],
    queryFn: async () => {
      if (!selectedApp?.id) return null;
      const res = await fetch(`/api/admin/applications/${selectedApp.id}/payment`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: (paymentDialogOpen || (assignDialogOpen && isReassignment)) && !!selectedApp?.id,
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

  // Fetch all platform users for the Create Application founder picker
  const { data: allUsers = [] } = useQuery<{ id: string; email: string; firstName: string | null; lastName: string | null }[]>({
    queryKey: ["/api/admin/users"],
    enabled: createAppOpen,
  });

  // Fetch checklist items for the selected application when Upload Doc dialog is open
  const { data: uploadDocChecklist = [] } = useQuery<{ id: number; key: string; label: string; status: string }[]>({
    queryKey: ["/api/admin/applications", uploadDocApp?.id, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/applications/${uploadDocApp!.id}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.checklistItems ?? [];
    },
    enabled: uploadDocOpen && !!uploadDocApp?.id,
  });

  // Reset all wizard state
  function resetCreateWizard() {
    setCreateWizardStep(1);
    setCreatedAppId(null);
    setCreateFounderUserId("");
    setCreateCompanyType("LTD");
    setCreateCompanyName1("");
    setCreateCompanyName2("");
    setCreateCompanyName3("");
    setCreateBusinessDesc("");
    setCreateDirectors([]);
    setNewDirPersonType("individual");
    setNewDirName("");
    setNewDirEmail("");
    setNewDirRole("director_and_shareholder");
    setNewDirShares("");
    setNewDirShareClass("ordinary");
    setNewDirCorporateName("");
    setNewDirCorporateRcNumber("");
    setNewDirCorporateCountry("Nigeria");
    setWizardUploadFile(null);
    setWizardUploadDocType("id_document");
    setWizardUploadChecklistItemId("");
    setWizardUploadedFiles([]);
    setCreateRegLine1("");
    setCreateRegCity("");
    setCreateRegState("Lagos");
    setCreateSameAddress(true);
    setCreateOpsLine1("");
    setCreateOpsCity("");
    setCreateOpsState("Lagos");
  }

  // Create Application for Founder mutation
  const createAppMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/admin/applications/create-for-founder", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create application");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      setCreatedAppId(data.id);
      setCreateWizardStep(6);
      toast({ title: "Application created", description: "The founder has been notified by email." });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to create application", description: e.message, variant: "destructive" });
    },
  });

  // Send payment link mutation
  const sendPaymentLinkMutation = useMutation({
    mutationFn: async (appId: number) => {
      const res = await apiRequest("POST", `/api/admin/applications/${appId}/send-payment-link`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send payment link");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment link sent", description: "The founder has been emailed a checkout link." });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to send payment link", description: e.message, variant: "destructive" });
    },
  });

  // Fetch checklist items for the newly created app (used in wizard step 6)
  const { data: wizardChecklistItems = [] } = useQuery<{ id: number; label: string; status: string | null }[]>({
    queryKey: ["/api/admin/applications", createdAppId, "checklist"],
    queryFn: async () => {
      if (!createdAppId) return [];
      const res = await fetch(`/api/admin/applications/${createdAppId}/checklist`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.checklistItems ?? data ?? [];
    },
    enabled: !!createdAppId && createWizardStep === 6,
  });

  // Wizard document upload mutation (step 6)
  const wizardUploadMutation = useMutation({
    mutationFn: async ({ file, docType, checklistItemId }: { file: File; docType: string; checklistItemId: string }) => {
      const csrf = await getCsrfToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      formData.append("category", "company");
      formData.append("checklistItemId", checklistItemId);
      const res = await fetch(`/api/admin/applications/${createdAppId}/documents/upload`, {
        method: "POST",
        headers: { "X-CSRF-Token": csrf },
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      setWizardUploadedFiles((prev) => [...prev, { name: vars.file.name, docType: vars.docType }]);
      setWizardUploadFile(null);
      setWizardUploadChecklistItemId("");
      setWizardUploadDocType("id_document");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", createdAppId, "checklist"] });
      toast({ title: "Document uploaded" });
    },
    onError: (e: Error) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  // Upload document to application checklist mutation
  const uploadDocMutation = useMutation({
    mutationFn: async ({ appId, file, checklistItemId, docType }: { appId: number; file: File; checklistItemId?: string; docType: string }) => {
      const csrf = await getCsrfToken();
      const formData = new FormData();
      formData.append("file", file);
      if (checklistItemId) formData.append("checklistItemId", checklistItemId);
      formData.append("docType", docType);
      formData.append("category", "company");
      const res = await fetch(`/api/admin/applications/${appId}/documents/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: { "X-CSRF-Token": csrf },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications", uploadDocApp?.id, "detail"] });
      setUploadDocFile(null);
      setUploadDocChecklistItemId("");
      setUploadDocType("uploaded_document");
      setUploadDocOpen(false);
      setUploadDocApp(null);
      toast({ title: "Document uploaded", description: "Checklist item marked as provided. Lawyer notified if assigned." });
    },
    onError: (e: Error) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  // Pre-populate the lawyer fee input when payment data loads or the action changes
  useEffect(() => {
    if (selectedPaymentState === "released_to_lawyer" && appPaymentDetails?.lawyerFeeKobo != null) {
      setLawyerFeeNaira(String(Math.round(appPaymentDetails.lawyerFeeKobo / 100)));
    }
  }, [appPaymentDetails, selectedPaymentState]);

  // Reset fee field when dialog closes or app changes
  useEffect(() => {
    if (!paymentDialogOpen) {
      setLawyerFeeNaira("");
    }
  }, [paymentDialogOpen]);

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
      toast({ title: isReassignment ? "Lawyer reassigned successfully" : "Lawyer assigned successfully" });
      setAssignDialogOpen(false);
      setSelectedApp(null);
      setSelectedLawyer("");
      setIsReassignment(false);
    },
    onError: () => {
      toast({ title: "Failed to assign lawyer", variant: "destructive" });
    },
  });

  const paymentTransitionMutation = useMutation({
    mutationFn: async ({ applicationId, targetState, reason, lawyerIdToAssign, overrideLawyerFeeKobo }: { applicationId: number; targetState: string; reason: string; lawyerIdToAssign?: string; overrideLawyerFeeKobo?: number }) => {
      if (lawyerIdToAssign) {
        await apiRequest("POST", `/api/admin/applications/${applicationId}/assign`, { lawyerId: lawyerIdToAssign });
      }
      return apiRequest("POST", `/api/admin/applications/${applicationId}/payment-state`, { targetState, reason, overrideLawyerFeeKobo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      toast({ title: "Payment transition completed successfully" });
      setPaymentDialogOpen(false);
      setSelectedApp(null);
      setSelectedPaymentState("");
      setPaymentReason("");
      setInlineLawyerId("");
    },
    onError: (e: Error) => {
      const isBankDetailsMissing = e.message?.toLowerCase().includes("bank details");
      if (isBankDetailsMissing) {
        const lawyerId = selectedApp?.assignedLawyerUserId;
        toast({
          title: "Bank details not configured",
          description: "This lawyer has no bank account set up. Opening bank details setup…",
          variant: "destructive",
        });
        if (lawyerId) {
          setBankDetailsLawyerId(lawyerId);
          setBankAcctName("");
          setBankAcctNumber("");
          setBankCode("");
          setPaymentDialogOpen(false);
          setBankDetailsOpen(true);
        }
      } else {
        toast({ title: "Payment transition failed", description: e.message || "An unexpected error occurred.", variant: "destructive" });
      }
    },
  });

  const bankDetailsMutation = useMutation({
    mutationFn: async ({ lawyerId, accountName, accountNumber, bankCode: code }: { lawyerId: string; accountName: string; accountNumber: string; bankCode: string }) => {
      return apiRequest("PUT", `/api/admin/lawyers/${lawyerId}/bank-details`, { accountName, accountNumber, bankCode: code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lawyers"] });
      toast({ title: "Bank details saved", description: "Paystack transfer recipient created successfully." });
      setBankDetailsOpen(false);
      setBankDetailsLawyerId("");
      setBankAcctName("");
      setBankAcctNumber("");
      setBankCode("");
    },
    onError: (e: Error) => {
      toast({ title: "Failed to save bank details", description: e.message, variant: "destructive" });
    },
  });

  interface AdminProfileEditPayload {
    companyName1?: string;
    companyName2?: string | null;
    companyName3?: string | null;
    companyType?: "LTD" | "PLC" | "LLP" | "BN" | "NGO" | "UNLIMITED";
    businessDescription?: string | null;
    selectedActivities?: string[] | null;
    registeredAddress?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string } | null;
    operatingAddress?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string } | null;
    directorsData?: Record<string, unknown>[] | null;
    shareholdersData?: Record<string, unknown>[] | null;
  }

  const editProfileMutation = useMutation({
    mutationFn: async ({ applicationId, data }: { applicationId: number; data: AdminProfileEditPayload }) => {
      const res = await apiRequest("PATCH", `/api/admin/applications/${applicationId}/profile`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Profile updated", description: "Application profile has been updated on behalf of the founder." });
      setEditProfileOpen(false);
      setEditProfileApp(null);
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const [resendPendingId, setResendPendingId] = useState<number | null>(null);

  const resendCompletionMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      setResendPendingId(applicationId);
      const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/resend-completion`, {});
      return res.json();
    },
    onSuccess: () => toast({ title: "Email sent", description: "A completion link has been sent to the founder." }),
    onError: (e: Error) => toast({ title: "Email failed", description: e.message, variant: "destructive" }),
    onSettled: () => setResendPendingId(null),
  });

  function openEditProfile(app: ApplicationWithLawyer) {
    setEditProfileApp(app);
    setEditCompanyName1(app.companyName1 || "");
    setEditCompanyName2(app.companyName2 || "");
    setEditCompanyName3(app.companyName3 || "");
    setEditCompanyType(app.companyType || "LTD");
    setEditBusinessDescription(app.businessDescription || "");
    const acts = app.selectedActivities;
    setEditActivities(Array.isArray(acts) ? acts.join(", ") : "");
    const reg = app.registeredAddress as { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string } | null;
    setEditRegLine1(reg?.line1 || "");
    setEditRegLine2(reg?.line2 || "");
    setEditRegCity(reg?.city || "");
    setEditRegState(reg?.state || "");
    setEditRegPostalCode(reg?.postalCode || "");
    setEditRegCountry(reg?.country || "Nigeria");
    const ops = app.operatingAddress as { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string } | null;
    setEditOpsLine1(ops?.line1 || "");
    setEditOpsLine2(ops?.line2 || "");
    setEditOpsCity(ops?.city || "");
    setEditOpsState(ops?.state || "");
    setEditOpsPostalCode(ops?.postalCode || "");
    setEditOpsCountry(ops?.country || "Nigeria");
    const dirs = app.directorsData;
    setEditDirectorsJson(Array.isArray(dirs) && dirs.length ? JSON.stringify(dirs, null, 2) : "");
    setDirectorsJsonError("");
    const shares = app.shareholdersData;
    setEditShareholdersJson(Array.isArray(shares) && shares.length ? JSON.stringify(shares, null, 2) : "");
    setShareholdersJsonError("");
    setEditProfileOpen(true);
  }

  function submitEditProfile() {
    if (!editProfileApp) return;
    let directorsJsonValid = true;
    let shareholdersJsonValid = true;
    let parsedDirectors: Record<string, unknown>[] | null = null;
    let parsedShareholders: Record<string, unknown>[] | null = null;

    if (editDirectorsJson.trim()) {
      try {
        const parsed = JSON.parse(editDirectorsJson);
        if (!Array.isArray(parsed)) throw new Error("Must be a JSON array");
        parsedDirectors = parsed as Record<string, unknown>[];
        setDirectorsJsonError("");
      } catch {
        setDirectorsJsonError("Invalid JSON — must be a valid array");
        directorsJsonValid = false;
      }
    } else {
      setDirectorsJsonError("");
    }

    if (editShareholdersJson.trim()) {
      try {
        const parsed = JSON.parse(editShareholdersJson);
        if (!Array.isArray(parsed)) throw new Error("Must be a JSON array");
        parsedShareholders = parsed as Record<string, unknown>[];
        setShareholdersJsonError("");
      } catch {
        setShareholdersJsonError("Invalid JSON — must be a valid array");
        shareholdersJsonValid = false;
      }
    } else {
      setShareholdersJsonError("");
    }

    if (!directorsJsonValid || !shareholdersJsonValid) return;

    const activities = editActivities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: AdminProfileEditPayload = {
      companyName1: editCompanyName1,
      companyName2: editCompanyName2 || null,
      companyName3: editCompanyName3 || null,
      companyType: editCompanyType as AdminProfileEditPayload["companyType"],
      businessDescription: editBusinessDescription || null,
      selectedActivities: activities.length ? activities : null,
      registeredAddress: {
        line1: editRegLine1,
        line2: editRegLine2 || undefined,
        city: editRegCity,
        state: editRegState,
        postalCode: editRegPostalCode || undefined,
        country: editRegCountry,
      },
      operatingAddress: {
        line1: editOpsLine1,
        line2: editOpsLine2 || undefined,
        city: editOpsCity,
        state: editOpsState,
        postalCode: editOpsPostalCode || undefined,
        country: editOpsCountry,
      },
      // Only include JSON blobs if the admin provided a value — blank means "keep existing"
      ...(parsedDirectors !== null ? { directorsData: parsedDirectors } : {}),
      ...(parsedShareholders !== null ? { shareholdersData: parsedShareholders } : {}),
    };

    editProfileMutation.mutate({ applicationId: editProfileApp.id, data: payload });
  }

  const filteredApplications = applications?.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesSearch = !searchQuery ||
      app.companyName1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const filteredAbandonedCarts = abandonedCarts?.list.filter((item) => {
    if (!showLegacy && item.isLegacyDraft) return false;
    if (showLegacy && !item.isLegacyDraft) return false;
    if (!abandonedCartSearch) return true;
    const q = abandonedCartSearch.toLowerCase();
    return (
      item.companyName.toLowerCase().includes(q) ||
      (item.founderEmail?.toLowerCase().includes(q) ?? false) ||
      (item.founderName?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <DashboardLayout
      role="admin"
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Applications" }]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">All Applications</h1>
            <p className="text-muted-foreground">View and manage all platform applications</p>
          </div>
          <Button
            onClick={() => setCreateAppOpen(true)}
            className="shrink-0"
            data-testid="button-create-app-for-founder"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create for Founder
          </Button>
        </div>

        {/* ── Abandoned Carts Panel ── */}
        {abandonedCarts && (
          <Card className="border-amber-200 dark:border-amber-800" data-testid="card-abandoned-carts">
            <CardHeader
              className="cursor-pointer select-none pb-3"
              onClick={() => setAbandonedCartsExpanded((v) => !v)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Abandoned Carts</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Draft registrations that never reached payment
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-lg leading-none">{abandonedCarts.summary.total}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Actionable</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-lg leading-none text-amber-600">{abandonedCarts.summary.byBucket["1_3d"] + abandonedCarts.summary.byBucket["3_7d"] + abandonedCarts.summary.byBucket.gt_7d}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">Waiting &gt; 1d</p>
                    </div>
                    {abandonedCarts.summary.legacy > 0 && (
                      <div className="text-center">
                        <p className="font-semibold text-lg leading-none text-muted-foreground">{abandonedCarts.summary.legacy}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">Legacy</p>
                      </div>
                    )}
                  </div>
                  {abandonedCartsExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>

            {abandonedCartsExpanded && (
              <CardContent className="pt-0">
                {/* Age bucket breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {(["lt_24h", "1_3d", "3_7d", "gt_7d"] as const).map((bucket) => (
                    <div
                      key={bucket}
                      className="rounded-lg border bg-muted/30 p-3 text-center"
                      data-testid={`bucket-${bucket}`}
                    >
                      <p className="text-xl font-bold">{abandonedCarts.summary.byBucket[bucket]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{bucketLabels[bucket]}</p>
                    </div>
                  ))}
                </div>

                {/* Toggle: actionable / legacy */}
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    variant={!showLegacy ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowLegacy(false)}
                    data-testid="button-show-actionable"
                  >
                    Actionable ({abandonedCarts.summary.total})
                  </Button>
                  <Button
                    variant={showLegacy ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowLegacy(true)}
                    data-testid="button-show-legacy"
                  >
                    Legacy ({abandonedCarts.summary.legacy})
                  </Button>
                  <div className="relative flex-1 max-w-xs ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search carts…"
                      value={abandonedCartSearch}
                      onChange={(e) => setAbandonedCartSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-testid="input-abandoned-search"
                    />
                  </div>
                </div>

                {showLegacy && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      These drafts were created with an older version of the registration wizard and are missing required fields. They cannot be resumed and are excluded from automated reminder emails.
                    </p>
                  </div>
                )}

                {!filteredAbandonedCarts?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No {showLegacy ? "legacy" : "actionable"} abandoned carts found.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Company</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Founder</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Type</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Age</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Reminders</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAbandonedCarts.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                            data-testid={`cart-row-${item.id}`}
                            onClick={() => window.location.assign(`/applications/${item.id}`)}
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate max-w-[140px]">{item.companyName}</span>
                                <span className="text-xs text-muted-foreground shrink-0">{item.companyType}</span>
                                {item.isLegacyDraft && (
                                  <Badge variant="outline" className="text-xs shrink-0">Legacy</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 hidden md:table-cell">
                              <div>
                                {item.founderName && <p className="truncate max-w-[140px]">{item.founderName}</p>}
                                <p className="text-xs text-muted-foreground truncate max-w-[140px]">{item.founderEmail || "—"}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground capitalize">
                                {item.applicationType === "incorporation" ? "Incorporation" : item.applicationType || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 hidden sm:table-cell">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bucketColors[item.ageBucket]}`}>
                                <Clock className="h-3 w-3" />
                                {formatAge(item.ageDays)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 hidden lg:table-cell">
                              <span className="text-muted-foreground">{item.remindersCount} / 3 sent</span>
                            </td>
                            <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" asChild data-testid={`button-view-cart-${item.id}`}>
                                <Link href={`/applications/${item.id}`}>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* ── Lawyer Profiles Panel ── */}
        {lawyers && lawyers.length > 0 && (
          <Card data-testid="card-lawyer-profiles">
            <CardHeader
              className="cursor-pointer select-none pb-3"
              onClick={() => setLawyersExpanded((v) => !v)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Lawyer Profiles</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Bank details and payout configuration</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{lawyers.filter(l => l.payoutSubaccountId).length}/{lawyers.length} configured</span>
                  </div>
                  {lawyersExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>
            {lawyersExpanded && (
              <CardContent className="pt-0">
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Lawyer</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Firm</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Bank Status</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lawyers.map((lawyer) => (
                        <tr key={lawyer.userId} className="border-b last:border-0 hover:bg-muted/20 transition-colors" data-testid={`lawyer-row-${lawyer.userId}`}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{lawyer.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{lawyer.email}</p>
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                            {lawyer.firmName || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            {lawyer.payoutSubaccountId ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400" data-testid={`badge-bank-configured-${lawyer.userId}`}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Configured
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400" data-testid={`badge-bank-missing-${lawyer.userId}`}>
                                <XCircle className="h-3.5 w-3.5" /> Not set
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBankDetailsLawyerId(lawyer.userId);
                                setBankAcctName("");
                                setBankAcctNumber("");
                                setBankCode("");
                                setBankDetailsOpen(true);
                              }}
                              data-testid={`button-bank-details-${lawyer.userId}`}
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1.5" />
                              {lawyer.payoutSubaccountId ? "Update" : "Set Up"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* ── Payout Ledger Panel ── */}
        <Card data-testid="card-payout-ledger">
          <CardHeader
            className="cursor-pointer select-none pb-3"
            onClick={() => setPayoutsExpanded((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Payout Ledger</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">History of all lawyer payouts</p>
                </div>
              </div>
              {payoutsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
          {payoutsExpanded && (
            <CardContent className="pt-0">
              {payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payouts recorded yet.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Lawyer</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Application</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Amount</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors" data-testid={`payout-row-${p.id}`}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{p.lawyerName}</p>
                            {p.lawyerEmail && <p className="text-xs text-muted-foreground">{p.lawyerEmail}</p>}
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            {p.companyName ? (
                              <div>
                                <p className="font-medium truncate max-w-[160px]" data-testid={`text-payout-company-${p.id}`}>{p.companyName}</p>
                                <p className="text-xs text-muted-foreground">App #{p.applicationId}</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono">
                            ₦{(p.amountKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" :
                              p.status === "sent" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                              p.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                              "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`} data-testid={`status-payout-${p.id}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-NG") : "—"}
                          </td>
                          <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground font-mono text-xs truncate max-w-[160px]">
                            {p.providerRef || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── All Applications ── */}
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
                        <Link href={`/admin/applications/${app.id}`}>
                          <h3 className="font-semibold text-lg truncate hover:text-primary hover:underline cursor-pointer" data-testid={`link-app-name-${app.id}`}>
                            {app.companyName1 || "Untitled Application"}
                          </h3>
                        </Link>
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
                          {app.rcNumber && (
                            <>
                              <span>&bull;</span>
                              <span className="font-medium text-primary" data-testid={`text-rc-number-${app.id}`}>RC: {app.rcNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0 flex-wrap">
                      <StatusBadge status={app.status || "draft"} />
                      <Link href={`/admin/applications/${app.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-app-${app.id}`}>
                          View
                        </Button>
                      </Link>
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
                      {!app.assignedLawyerUserId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setIsReassignment(false);
                            setSelectedLawyer("");
                            setAssignDialogOpen(true);
                          }}
                          data-testid={`button-assign-${app.id}`}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setIsReassignment(true);
                            setSelectedLawyer(app.assignedLawyerUserId ?? "");
                            setAssignDialogOpen(true);
                          }}
                          data-testid={`button-reassign-${app.id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ArrowLeftRight className="h-4 w-4 mr-1" />
                          Reassign
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
                      {app.applicationType === "incorporation" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditProfile(app)}
                            data-testid={`button-edit-profile-${app.id}`}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          {["draft", "pending_verification", "submitted"].includes(app.status || "") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendCompletionMutation.mutate(app.id)}
                              disabled={resendPendingId === app.id}
                              data-testid={`button-resend-completion-${app.id}`}
                            >
                              {resendPendingId === app.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <MailCheck className="h-4 w-4 mr-1" />
                              )}
                              Resend Link
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUploadDocApp(app);
                              setUploadDocChecklistItemId("");
                              setUploadDocType("uploaded_document");
                              setUploadDocFile(null);
                              setUploadDocOpen(true);
                            }}
                            data-testid={`button-upload-doc-${app.id}`}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Upload Doc
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={(open) => { setAssignDialogOpen(open); if (!open) { setIsReassignment(false); setSelectedLawyer(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isReassignment ? "Reassign Lawyer" : "Assign Lawyer"}</DialogTitle>
            <DialogDescription>
              {isReassignment
                ? `Change the assigned lawyer for "${selectedApp?.companyName1 || 'this application'}"`
                : `Select a lawyer to handle "${selectedApp?.companyName1 || 'this application'}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isReassignment && selectedApp?.assignedLawyerUserId && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Currently assigned: </span>
                {(() => {
                  const current = lawyers?.find(l => l.userId === selectedApp.assignedLawyerUserId);
                  return current ? `${current.name || current.email}${current.firmName ? ` — ${current.firmName}` : ""}` : selectedApp.lawyerName || "Unknown";
                })()}
              </div>
            )}
            {isReassignment && appPaymentDetails?.wasSplitAtCheckout && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm" data-testid="warn-reassign-split">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">Payment already settled at checkout</p>
                    <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                      {(() => {
                        const current = lawyers?.find(l => l.userId === selectedApp?.assignedLawyerUserId);
                        const name = current ? (current.name || current.email) : (selectedApp?.lawyerName || "The original lawyer");
                        return `${name} has already received payment via the Paystack checkout split. This reassignment only changes who handles the case — no new payment will be triggered.`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Select value={selectedLawyer} onValueChange={setSelectedLawyer}>
              <SelectTrigger data-testid="select-lawyer">
                <SelectValue placeholder={isReassignment ? "Select a different lawyer" : "Select a lawyer"} />
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
            <Button variant="outline" onClick={() => { setAssignDialogOpen(false); setIsReassignment(false); setSelectedLawyer(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedApp && selectedLawyer) {
                  assignMutation.mutate({
                    applicationId: selectedApp.id,
                    lawyerId: selectedLawyer,
                  });
                }
              }}
              disabled={!selectedLawyer || assignMutation.isPending || (isReassignment && selectedLawyer === selectedApp?.assignedLawyerUserId)}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? <LoadingSpinner size="sm" /> : isReassignment ? "Reassign" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) setInlineLawyerId(""); }}>
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
            {appPaymentDetails?.wasSplitAtCheckout && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm" data-testid="warn-split-at-checkout">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">Payment already split at checkout</p>
                    <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                      This payment was automatically split and settled to the lawyer's Paystack subaccount when the founder paid. Releasing again will create a duplicate payment to the lawyer.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="payment-transition">Action</Label>
              <Select
                value={selectedPaymentState}
                onValueChange={(v) => {
                  if (v === "released_to_lawyer" && appPaymentDetails?.wasSplitAtCheckout) return;
                  setSelectedPaymentState(v);
                }}
              >
                <SelectTrigger data-testid="select-payment-state">
                  <SelectValue placeholder="Select payment action" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTransitionOptions.map((option) => {
                    const isBlocked = option.value === "released_to_lawyer" && !!appPaymentDetails?.wasSplitAtCheckout;
                    return (
                      <SelectItem key={option.value} value={option.value} disabled={isBlocked}>
                        <div className="flex flex-col">
                          <span>{option.label}{isBlocked ? " (already paid)" : ""}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedPaymentState && (
                <p className="text-xs text-muted-foreground">
                  {paymentTransitionOptions.find(o => o.value === selectedPaymentState)?.description}
                </p>
              )}
              {selectedPaymentState === "released_to_lawyer" && (() => {
                const effectiveLawyerId = selectedApp?.assignedLawyerUserId || inlineLawyerId;
                const assignedLawyer = lawyers?.find(l => l.userId === effectiveLawyerId);
                const hasBankDetails = !!assignedLawyer?.payoutSubaccountId;
                return (
                  <>
                    {selectedApp?.assignedLawyerUserId ? (
                      <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 px-3 py-2 text-sm" data-testid="info-assigned-lawyer">
                        <p className="font-medium text-green-800 dark:text-green-300">Assigned lawyer</p>
                        <p className="text-green-700 dark:text-green-400">
                          {selectedApp.lawyerName || assignedLawyer?.name || "Unknown"}
                          {assignedLawyer?.firmName ? ` — ${assignedLawyer.firmName}` : ""}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2" data-testid="inline-lawyer-assignment">
                        <p className="text-xs font-medium text-muted-foreground">No lawyer assigned — select one to assign and release in one step</p>
                        <Select value={inlineLawyerId} onValueChange={setInlineLawyerId}>
                          <SelectTrigger data-testid="select-inline-lawyer">
                            <SelectValue placeholder="Select a lawyer to assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {lawyers && lawyers.length > 0 ? lawyers.map((l) => (
                              <SelectItem key={l.userId} value={l.userId}>
                                {l.name || l.email}{l.firmName ? ` — ${l.firmName}` : ""}
                              </SelectItem>
                            )) : (
                              <SelectItem value="__none__" disabled>No active lawyers available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {effectiveLawyerId && !hasBankDetails && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-sm" data-testid="warn-no-bank-details">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-amber-800 dark:text-amber-300">This lawyer has no bank details configured.</p>
                            <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                              Set up their{" "}
                              <button
                                type="button"
                                className="underline font-medium"
                                onClick={() => {
                                  setBankDetailsLawyerId(effectiveLawyerId);
                                  setBankAcctName("");
                                  setBankAcctNumber("");
                                  setBankCode("");
                                  setPaymentDialogOpen(false);
                                  setBankDetailsOpen(true);
                                }}
                                data-testid="link-open-bank-setup"
                              >
                                bank details
                              </button>{" "}
                              before releasing payment.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {selectedPaymentState === "released_to_lawyer" && (
              <div className="space-y-1">
                <Label htmlFor="lawyer-fee-amount">Lawyer payout amount (₦)</Label>
                <Input
                  id="lawyer-fee-amount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 75000"
                  value={lawyerFeeNaira}
                  onChange={(e) => setLawyerFeeNaira(e.target.value)}
                  data-testid="input-lawyer-fee"
                />
                {appPaymentDetails && (
                  <p className="text-xs text-muted-foreground">
                    Total paid: ₦{(appPaymentDetails.amountTotalKobo / 100).toLocaleString()}&nbsp;·&nbsp;
                    Cellion cut: ₦{(
                      (appPaymentDetails.amountTotalKobo - Math.round(parseFloat(lawyerFeeNaira || "0") * 100)) / 100
                    ).toLocaleString()}
                  </p>
                )}
                {!appPaymentDetails && (
                  <p className="text-xs text-muted-foreground">
                    Enter the amount to pay the lawyer. Leave blank to use the stored catalog amount.
                  </p>
                )}
              </div>
            )}
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
                  const needsInlineAssign =
                    selectedPaymentState === "released_to_lawyer" &&
                    !selectedApp.assignedLawyerUserId &&
                    !!inlineLawyerId;
                  const parsedFeeKobo =
                    selectedPaymentState === "released_to_lawyer" && lawyerFeeNaira.trim()
                      ? Math.round(parseFloat(lawyerFeeNaira) * 100)
                      : undefined;
                  paymentTransitionMutation.mutate({
                    applicationId: selectedApp.id,
                    targetState: selectedPaymentState,
                    reason: paymentReason,
                    lawyerIdToAssign: needsInlineAssign ? inlineLawyerId : undefined,
                    overrideLawyerFeeKobo: parsedFeeKobo && parsedFeeKobo > 0 ? parsedFeeKobo : undefined,
                  });
                }
              }}
              disabled={
                !selectedPaymentState ||
                paymentTransitionMutation.isPending ||
                (selectedPaymentState === "released_to_lawyer" && !!appPaymentDetails?.wasSplitAtCheckout) ||
                (selectedPaymentState === "released_to_lawyer" &&
                  !selectedApp?.assignedLawyerUserId &&
                  !inlineLawyerId) ||
                (selectedPaymentState === "released_to_lawyer" &&
                  !!(selectedApp?.assignedLawyerUserId || inlineLawyerId) &&
                  !lawyers?.find(l => l.userId === (selectedApp?.assignedLawyerUserId || inlineLawyerId))?.payoutSubaccountId)
              }
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
      {/* Bank Details Dialog */}
      <Dialog open={bankDetailsOpen} onOpenChange={(open) => { setBankDetailsOpen(open); if (!open) { setBankAcctName(""); setBankAcctNumber(""); setBankCode(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lawyer Bank Details</DialogTitle>
            <DialogDescription>
              Enter bank account details to create a Paystack transfer recipient. This is required before payments can be released.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger data-testid="select-bank-code">
                  <SelectValue placeholder="Select bank…" />
                </SelectTrigger>
                <SelectContent>
                  {paystackBanks.length === 0 ? (
                    <SelectItem value="__loading__" disabled>Loading banks…</SelectItem>
                  ) : paystackBanks.map((b) => (
                    <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-acct-number">Account Number (10 digits)</Label>
              <Input
                id="bank-acct-number"
                placeholder="0123456789"
                maxLength={10}
                value={bankAcctNumber}
                onChange={(e) => setBankAcctNumber(e.target.value.replace(/\D/g, ""))}
                data-testid="input-bank-acct-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-acct-name">Account Name</Label>
              <Input
                id="bank-acct-name"
                placeholder="As it appears on the bank account"
                value={bankAcctName}
                onChange={(e) => setBankAcctName(e.target.value)}
                data-testid="input-bank-acct-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDetailsOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (bankDetailsLawyerId && bankAcctName && bankAcctNumber.length === 10 && bankCode) {
                  bankDetailsMutation.mutate({ lawyerId: bankDetailsLawyerId, accountName: bankAcctName, accountNumber: bankAcctNumber, bankCode });
                }
              }}
              disabled={bankDetailsMutation.isPending || !bankAcctName || bankAcctNumber.length !== 10 || !bankCode}
              data-testid="button-save-bank-details"
            >
              {bankDetailsMutation.isPending ? <LoadingSpinner size="sm" /> : "Save & Create Recipient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Application for Founder — Multi-Step Wizard ── */}
      <Dialog open={createAppOpen} onOpenChange={(open) => { if (!open) resetCreateWizard(); setCreateAppOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {createWizardStep <= 5
                ? `Create Application for Founder — Step ${createWizardStep} of 5`
                : createWizardStep === 6
                  ? "Upload Supporting Documents (Optional)"
                  : "Application Created"}
            </DialogTitle>
            <DialogDescription>
              {createWizardStep === 1 && "Select the founder and company type."}
              {createWizardStep === 2 && "Enter the company name choices for CAC availability checking."}
              {createWizardStep === 3 && "Describe the company's business activities."}
              {createWizardStep === 4 && "Add at least one director. Shareholders who are not directors can also be added."}
              {createWizardStep === 5 && "Provide the registered and operating addresses, then create the application."}
              {createWizardStep === 6 && "Upload any initial documents to the application's file store. You can skip this and upload later."}
              {createWizardStep === 7 && "The application has been set up. Send the founder a payment link to complete checkout."}
            </DialogDescription>
          </DialogHeader>

          {/* Step progress bar */}
          {createWizardStep <= 5 && (
            <div className="flex gap-1 my-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${s <= createWizardStep ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          )}

          {/* ── Step 1: Founder + Company Type ── */}
          {createWizardStep === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Founder <span className="text-destructive">*</span></Label>
                <Select value={createFounderUserId} onValueChange={setCreateFounderUserId}>
                  <SelectTrigger data-testid="select-create-founder">
                    <SelectValue placeholder="Select a user…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName && u.lastName ? `${u.firstName} ${u.lastName} — ` : ""}{u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Company Type <span className="text-destructive">*</span></Label>
                <Select value={createCompanyType} onValueChange={setCreateCompanyType}>
                  <SelectTrigger data-testid="select-create-company-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LTD">Private Limited (LTD)</SelectItem>
                    <SelectItem value="PLC">Public Limited (PLC)</SelectItem>
                    <SelectItem value="LLP">Limited Liability Partnership (LLP)</SelectItem>
                    <SelectItem value="BN">Business Name (BN)</SelectItem>
                    <SelectItem value="NGO">Non-Governmental Organisation (NGO)</SelectItem>
                    <SelectItem value="UNLIMITED">Unlimited Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Step 2: Company Names ── */}
          {createWizardStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Preferred Name <span className="text-destructive">*</span></Label>
                <Input
                  value={createCompanyName1}
                  onChange={(e) => setCreateCompanyName1(e.target.value)}
                  placeholder="First choice company name"
                  data-testid="input-create-name1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Second Choice <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input
                  value={createCompanyName2}
                  onChange={(e) => setCreateCompanyName2(e.target.value)}
                  placeholder="Alternative name"
                  data-testid="input-create-name2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Third Choice <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input
                  value={createCompanyName3}
                  onChange={(e) => setCreateCompanyName3(e.target.value)}
                  placeholder="Third alternative name"
                  data-testid="input-create-name3"
                />
              </div>
              <p className="text-xs text-muted-foreground">Names will be submitted for CAC availability checking after payment.</p>
            </div>
          )}

          {/* ── Step 3: Business Description ── */}
          {createWizardStep === 3 && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Business Description <span className="text-destructive">*</span></Label>
                <Textarea
                  value={createBusinessDesc}
                  onChange={(e) => setCreateBusinessDesc(e.target.value)}
                  placeholder="Describe what the company does, its main activities and sector…"
                  rows={6}
                  data-testid="textarea-create-business-desc"
                />
                <p className="text-xs text-muted-foreground">{createBusinessDesc.length} characters — aim for at least 50.</p>
              </div>
            </div>
          )}

          {/* ── Step 4: Directors & Shareholders ── */}
          {createWizardStep === 4 && (() => {
            const hasDirector = createDirectors.some((d) => d.role === "director" || d.role === "director_and_shareholder");
            return (
              <div className="space-y-4 py-2">
                {createDirectors.length > 0 && (
                  <div className="space-y-2">
                    {createDirectors.map((d) => (
                      <div key={d.localId} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            {d.personType === "corporate" ? d.corporateName : d.fullName}
                            {d.personType === "corporate" && (
                              <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded px-1.5 py-0.5">Corporate</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {d.personType === "corporate"
                              ? `Rep: ${d.fullName} · RC: ${d.corporateRcNumber || "—"} · ${d.corporateCountry}`
                              : (d.email || "no email")}
                            {" · "}{d.role.replace(/_/g, " ")}
                            {d.sharesAllocated ? ` · ${parseInt(d.sharesAllocated).toLocaleString()} shares (${d.shareClass})` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                          onClick={() => setCreateDirectors((prev) => prev.filter((x) => x.localId !== d.localId))}
                          data-testid={`button-remove-director-${d.localId}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add person form */}
                <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Add Person</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant={newDirPersonType === "individual" ? "default" : "outline"} className="h-7 text-xs"
                        onClick={() => setNewDirPersonType("individual")} data-testid="button-person-type-individual">Individual</Button>
                      <Button size="sm" variant={newDirPersonType === "corporate" ? "default" : "outline"} className="h-7 text-xs"
                        onClick={() => setNewDirPersonType("corporate")} data-testid="button-person-type-corporate">Corporate Entity</Button>
                    </div>
                  </div>

                  {newDirPersonType === "individual" ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
                        <Input value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder="Full legal name" className="h-8 text-sm" data-testid="input-new-director-name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email <span className="text-muted-foreground">(optional)</span></Label>
                        <Input value={newDirEmail} onChange={(e) => setNewDirEmail(e.target.value)} placeholder="email@example.com" type="email" className="h-8 text-sm" data-testid="input-new-director-email" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Company Name <span className="text-destructive">*</span></Label>
                          <Input value={newDirCorporateName} onChange={(e) => setNewDirCorporateName(e.target.value)} placeholder="Registered company name" className="h-8 text-sm" data-testid="input-new-corporate-name" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">RC / BN Number</Label>
                          <Input value={newDirCorporateRcNumber} onChange={(e) => setNewDirCorporateRcNumber(e.target.value)} placeholder="e.g. RC123456" className="h-8 text-sm" data-testid="input-new-corporate-rcnumber" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Country of Incorporation</Label>
                          <Input value={newDirCorporateCountry} onChange={(e) => setNewDirCorporateCountry(e.target.value)} placeholder="Nigeria" className="h-8 text-sm" data-testid="input-new-corporate-country" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Authorised Rep Name <span className="text-destructive">*</span></Label>
                          <Input value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder="Rep's full name" className="h-8 text-sm" data-testid="input-new-corporate-rep-name" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Role</Label>
                      <Select value={newDirRole} onValueChange={setNewDirRole}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-new-director-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="director">Director only</SelectItem>
                          <SelectItem value="shareholder">Shareholder only</SelectItem>
                          <SelectItem value="director_and_shareholder">Director &amp; Shareholder</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Shares Allocated</Label>
                      <Input value={newDirShares} onChange={(e) => setNewDirShares(e.target.value)} placeholder="e.g. 500000" type="number" className="h-8 text-sm" data-testid="input-new-director-shares" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Share Class</Label>
                      <Select value={newDirShareClass} onValueChange={setNewDirShareClass}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-new-director-share-class"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ordinary">Ordinary</SelectItem>
                          <SelectItem value="preference">Preference</SelectItem>
                          <SelectItem value="deferred">Deferred</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    size="sm" variant="secondary" className="w-full"
                    onClick={() => {
                      const validIndividual = newDirPersonType === "individual" && newDirName.trim();
                      const validCorporate = newDirPersonType === "corporate" && newDirCorporateName.trim() && newDirName.trim();
                      if (!validIndividual && !validCorporate) return;
                      setCreateDirectors((prev) => [
                        ...prev,
                        {
                          localId: Math.random().toString(36).slice(2),
                          personType: newDirPersonType,
                          fullName: newDirName.trim(),
                          email: newDirEmail.trim(),
                          role: newDirRole,
                          sharesAllocated: newDirShares,
                          shareClass: newDirShareClass,
                          sharePercentage: "",
                          corporateName: newDirCorporateName.trim(),
                          corporateRcNumber: newDirCorporateRcNumber.trim(),
                          corporateCountry: newDirCorporateCountry.trim() || "Nigeria",
                        },
                      ]);
                      setNewDirName(""); setNewDirEmail(""); setNewDirShares("");
                      setNewDirRole("director_and_shareholder"); setNewDirShareClass("ordinary");
                      setNewDirCorporateName(""); setNewDirCorporateRcNumber(""); setNewDirCorporateCountry("Nigeria");
                    }}
                    disabled={newDirPersonType === "individual" ? !newDirName.trim() : (!newDirCorporateName.trim() || !newDirName.trim())}
                    data-testid="button-add-director"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Add to Application
                  </Button>
                </div>

                {!hasDirector && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    At least one person with a director role is required to proceed.
                  </p>
                )}
              </div>
            );
          })()}

          {/* ── Step 5: Addresses ── */}
          {createWizardStep === 5 && (
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                <p className="text-sm font-medium">Registered Address</p>
                <Input
                  value={createRegLine1}
                  onChange={(e) => setCreateRegLine1(e.target.value)}
                  placeholder="Street address"
                  data-testid="input-create-reg-line1"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={createRegCity}
                    onChange={(e) => setCreateRegCity(e.target.value)}
                    placeholder="City"
                    data-testid="input-create-reg-city"
                  />
                  <Select value={createRegState} onValueChange={setCreateRegState}>
                    <SelectTrigger data-testid="select-create-reg-state">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {NIGERIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="same-address"
                  checked={createSameAddress}
                  onChange={(e) => setCreateSameAddress(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                  data-testid="checkbox-same-address"
                />
                <label htmlFor="same-address" className="text-sm cursor-pointer select-none">
                  Operating address same as registered address
                </label>
              </div>

              {!createSameAddress && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Operating Address</p>
                  <Input
                    value={createOpsLine1}
                    onChange={(e) => setCreateOpsLine1(e.target.value)}
                    placeholder="Street address"
                    data-testid="input-create-ops-line1"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={createOpsCity}
                      onChange={(e) => setCreateOpsCity(e.target.value)}
                      placeholder="City"
                      data-testid="input-create-ops-city"
                    />
                    <Select value={createOpsState} onValueChange={setCreateOpsState}>
                      <SelectTrigger data-testid="select-create-ops-state">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIGERIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 6: Optional document upload ── */}
          {createWizardStep === 6 && createdAppId && (() => {
            const uploadableItems = wizardChecklistItems.filter(
              (i) => !i.status || i.status === "missing" || i.status === "rejected"
            );
            return (
              <div className="space-y-4 py-2">
                {wizardUploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Uploaded this session</p>
                    {wizardUploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm rounded border px-3 py-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">({f.docType.replace(/_/g, " ")})</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                  <p className="text-sm font-medium">Upload a Document</p>
                  {uploadableItems.length === 0 && wizardChecklistItems.length > 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">All checklist items are already provided. No upload needed.</p>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Checklist Item <span className="text-destructive">*</span></Label>
                        <Select value={wizardUploadChecklistItemId} onValueChange={setWizardUploadChecklistItemId}>
                          <SelectTrigger className="h-8 text-sm" data-testid="select-wizard-checklist-item"><SelectValue placeholder="Select item to upload for…" /></SelectTrigger>
                          <SelectContent>
                            {uploadableItems.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>{item.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Document Type</Label>
                        <Select value={wizardUploadDocType} onValueChange={setWizardUploadDocType}>
                          <SelectTrigger className="h-8 text-sm" data-testid="select-wizard-upload-doctype"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="id_document">ID Document</SelectItem>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="utility_bill">Utility Bill</SelectItem>
                            <SelectItem value="cac_form">CAC Form</SelectItem>
                            <SelectItem value="memorandum">Memorandum &amp; Articles</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">File</Label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => setWizardUploadFile(e.target.files?.[0] ?? null)}
                          className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground hover:file:bg-muted/80"
                          data-testid="input-wizard-upload-file"
                        />
                      </div>
                      <Button
                        size="sm" className="w-full"
                        onClick={() => {
                          if (wizardUploadFile && wizardUploadChecklistItemId) {
                            wizardUploadMutation.mutate({
                              file: wizardUploadFile,
                              docType: wizardUploadDocType,
                              checklistItemId: wizardUploadChecklistItemId,
                            });
                          }
                        }}
                        disabled={!wizardUploadFile || !wizardUploadChecklistItemId || wizardUploadMutation.isPending}
                        data-testid="button-wizard-upload"
                      >
                        {wizardUploadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Upload Document
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Step 7: Done ── */}
          {createWizardStep === 7 && createdAppId && (
            <div className="py-4 space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">Application #{createdAppId} created successfully</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    The founder has been notified by email. Use the button below to send them a direct checkout link.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Send Payment Link</p>
                <p className="text-xs text-muted-foreground">Email the founder a direct link to complete payment for application #{createdAppId}.</p>
                <Button
                  className="w-full"
                  onClick={() => sendPaymentLinkMutation.mutate(createdAppId!)}
                  disabled={sendPaymentLinkMutation.isPending}
                  data-testid="button-send-payment-link-wizard"
                >
                  {sendPaymentLinkMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Payment Link to Founder
                </Button>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                You can also send a payment link at any time from the application detail page.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row">
            {/* Back (steps 2–5 only, before creation) */}
            {createWizardStep > 1 && createWizardStep <= 5 && (
              <Button variant="outline" onClick={() => setCreateWizardStep((s) => s - 1)} data-testid="button-wizard-back">Back</Button>
            )}
            {/* Next (steps 1–4) */}
            {createWizardStep < 5 && (
              <Button
                onClick={() => setCreateWizardStep((s) => s + 1)}
                disabled={
                  (createWizardStep === 1 && !createFounderUserId) ||
                  (createWizardStep === 2 && !createCompanyName1.trim()) ||
                  (createWizardStep === 3 && createBusinessDesc.trim().length < 10) ||
                  (createWizardStep === 4 && !createDirectors.some((d) => d.role === "director" || d.role === "director_and_shareholder"))
                }
                data-testid="button-wizard-next"
              >Next</Button>
            )}
            {/* Create Application (step 5) */}
            {createWizardStep === 5 && (
              <Button
                onClick={() => {
                  createAppMutation.mutate({
                    founderUserId: createFounderUserId,
                    companyType: createCompanyType,
                    companyName1: createCompanyName1.trim(),
                    companyName2: createCompanyName2.trim() || undefined,
                    companyName3: createCompanyName3.trim() || undefined,
                    businessDescription: createBusinessDesc.trim() || undefined,
                    registeredAddress: createRegLine1.trim()
                      ? { line1: createRegLine1.trim(), city: createRegCity.trim(), state: createRegState, country: "Nigeria" }
                      : undefined,
                    operatingAddress: !createSameAddress && createOpsLine1.trim()
                      ? { line1: createOpsLine1.trim(), city: createOpsCity.trim(), state: createOpsState, country: "Nigeria" }
                      : createRegLine1.trim()
                        ? { line1: createRegLine1.trim(), city: createRegCity.trim(), state: createRegState, country: "Nigeria" }
                        : undefined,
                    people: createDirectors.map((d) => ({
                      entityType: d.personType,
                      fullName: d.personType === "individual" ? d.fullName : undefined,
                      corporateName: d.personType === "corporate" ? d.corporateName : undefined,
                      corporateRcNumber: d.personType === "corporate" ? d.corporateRcNumber : undefined,
                      corporateCountry: d.personType === "corporate" ? d.corporateCountry : undefined,
                      authorisedRepName: d.personType === "corporate" ? d.fullName : undefined,
                      email: d.email || undefined,
                      role: d.role,
                      sharesAllocated: d.sharesAllocated ? parseInt(d.sharesAllocated) : undefined,
                      shareClass: d.shareClass || undefined,
                    })),
                  });
                }}
                disabled={createAppMutation.isPending}
                data-testid="button-wizard-create"
              >
                {createAppMutation.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                  : <><Plus className="h-4 w-4 mr-2" />Create Application</>}
              </Button>
            )}
            {/* Skip / Finish uploads (step 6) */}
            {createWizardStep === 6 && (
              <>
                <Button variant="outline" onClick={() => setCreateWizardStep(7)} data-testid="button-wizard-skip-uploads">Skip</Button>
                <Button onClick={() => setCreateWizardStep(7)} disabled={wizardUploadMutation.isPending} data-testid="button-wizard-finish-uploads">Finish</Button>
              </>
            )}
            {/* Close (step 7 — done) */}
            {createWizardStep === 7 && (
              <Button variant="outline" onClick={() => { resetCreateWizard(); setCreateAppOpen(false); }} data-testid="button-wizard-close">Close</Button>
            )}
            {/* Cancel (pre-creation only) */}
            {createWizardStep <= 5 && (
              <Button variant="ghost" onClick={() => { resetCreateWizard(); setCreateAppOpen(false); }} className="text-muted-foreground" data-testid="button-wizard-cancel">Cancel</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document to Application Dialog */}
      <Dialog open={uploadDocOpen} onOpenChange={(open) => { setUploadDocOpen(open); if (!open) { setUploadDocApp(null); setUploadDocFile(null); setUploadDocChecklistItemId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a file for "{uploadDocApp?.companyName1 || `Application #${uploadDocApp?.id}`}" on behalf of the founder. If a lawyer is assigned, they will be notified automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const uploadableItems = uploadDocChecklist.filter(
                (i) => !i.status || i.status === "missing" || i.status === "rejected"
              );
              return uploadableItems.length === 0 && uploadDocChecklist.length > 0 ? (
                <p className="text-sm text-center text-muted-foreground py-4">
                  All checklist items are already provided or accepted. No upload needed.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label>Checklist Item <span className="text-destructive text-xs">*</span></Label>
                  <Select value={uploadDocChecklistItemId} onValueChange={setUploadDocChecklistItemId}>
                    <SelectTrigger data-testid="select-checklist-item">
                      <SelectValue placeholder="Select a missing or rejected item…" />
                    </SelectTrigger>
                    <SelectContent>
                      {uploadableItems.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.label}
                          {item.status === "rejected" ? " (rejected)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Only missing or rejected items are shown. Uploading marks the item as "provided".</p>
                </div>
              );
            })()}
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger data-testid="select-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uploaded_document">General Document</SelectItem>
                  <SelectItem value="passport_photo">Passport Photo</SelectItem>
                  <SelectItem value="id_document">Government ID</SelectItem>
                  <SelectItem value="address_proof">Proof of Address</SelectItem>
                  <SelectItem value="cac_form">CAC Form</SelectItem>
                  <SelectItem value="director_id">Director ID</SelectItem>
                  <SelectItem value="shareholder_form">Shareholder Form</SelectItem>
                  <SelectItem value="memorandum">Memorandum of Association</SelectItem>
                  <SelectItem value="articles">Articles of Association</SelectItem>
                  <SelectItem value="stamped_certificate">Stamped Certificate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>File <span className="text-destructive">*</span></Label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) setUploadDocFile(file);
                  };
                  input.click();
                }}
                data-testid="dropzone-upload-doc"
              >
                {uploadDocFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">{uploadDocFile.name}</span>
                    <span className="text-muted-foreground">({(uploadDocFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium">Click to select a file</p>
                    <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, DOC, DOCX — max 10 MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDocOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (uploadDocApp && uploadDocFile && uploadDocChecklistItemId) {
                  uploadDocMutation.mutate({
                    appId: uploadDocApp.id,
                    file: uploadDocFile,
                    checklistItemId: uploadDocChecklistItemId,
                    docType: uploadDocType,
                  });
                }
              }}
              disabled={uploadDocMutation.isPending || !uploadDocFile || !uploadDocChecklistItemId}
              data-testid="button-confirm-upload-doc"
            >
              {uploadDocMutation.isPending ? <LoadingSpinner size="sm" /> : (
                <><Upload className="h-4 w-4 mr-2" />Upload</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={(open) => { setEditProfileOpen(open); if (!open) setEditProfileApp(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Application Profile</DialogTitle>
            <DialogDescription>
              Update details for "{editProfileApp?.companyName1 || 'this application'}" on behalf of the founder. All changes are audit-logged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Company Names */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Company Names</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name1">Preferred Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-name1"
                    value={editCompanyName1}
                    onChange={(e) => setEditCompanyName1(e.target.value)}
                    placeholder="First choice company name"
                    data-testid="input-edit-name1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name2">Second Choice <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="edit-name2"
                    value={editCompanyName2}
                    onChange={(e) => setEditCompanyName2(e.target.value)}
                    placeholder="Alternative name"
                    data-testid="input-edit-name2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name3">Third Choice <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="edit-name3"
                    value={editCompanyName3}
                    onChange={(e) => setEditCompanyName3(e.target.value)}
                    placeholder="Third alternative name"
                    data-testid="input-edit-name3"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Company Type & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Company Type</Label>
                <Select value={editCompanyType} onValueChange={setEditCompanyType}>
                  <SelectTrigger data-testid="select-edit-company-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LTD">Private Limited (LTD)</SelectItem>
                    <SelectItem value="PLC">Public Limited (PLC)</SelectItem>
                    <SelectItem value="LLP">Limited Liability Partnership (LLP)</SelectItem>
                    <SelectItem value="BN">Business Name (BN)</SelectItem>
                    <SelectItem value="NGO">Non-Governmental Organisation (NGO)</SelectItem>
                    <SelectItem value="UNLIMITED">Unlimited Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Business Description</Label>
              <Textarea
                id="edit-description"
                value={editBusinessDescription}
                onChange={(e) => setEditBusinessDescription(e.target.value)}
                placeholder="Describe the nature and objectives of the business…"
                rows={3}
                data-testid="input-edit-description"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-activities">Selected Activities <span className="text-xs text-muted-foreground">(comma-separated)</span></Label>
              <Textarea
                id="edit-activities"
                value={editActivities}
                onChange={(e) => setEditActivities(e.target.value)}
                placeholder="e.g. Retail trading, Software development, Consulting services"
                rows={2}
                data-testid="input-edit-activities"
              />
            </div>

            <Separator />

            {/* Registered Address */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Registered Address</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="edit-reg-line1">Street Address (Line 1)</Label>
                  <Input id="edit-reg-line1" value={editRegLine1} onChange={(e) => setEditRegLine1(e.target.value)} placeholder="1 Example Street" data-testid="input-edit-reg-line1" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="edit-reg-line2">Line 2 (optional)</Label>
                  <Input id="edit-reg-line2" value={editRegLine2} onChange={(e) => setEditRegLine2(e.target.value)} placeholder="Flat / Suite / Floor" data-testid="input-edit-reg-line2" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-reg-city">City</Label>
                  <Input id="edit-reg-city" value={editRegCity} onChange={(e) => setEditRegCity(e.target.value)} placeholder="Lagos" data-testid="input-edit-reg-city" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-reg-state">State</Label>
                  <Input id="edit-reg-state" value={editRegState} onChange={(e) => setEditRegState(e.target.value)} placeholder="Lagos State" data-testid="input-edit-reg-state" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-reg-postal">Postal Code (optional)</Label>
                  <Input id="edit-reg-postal" value={editRegPostalCode} onChange={(e) => setEditRegPostalCode(e.target.value)} placeholder="100001" data-testid="input-edit-reg-postal" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-reg-country">Country</Label>
                  <Input id="edit-reg-country" value={editRegCountry} onChange={(e) => setEditRegCountry(e.target.value)} placeholder="Nigeria" data-testid="input-edit-reg-country" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Operating Address */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Operating Address</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="edit-ops-line1">Street Address (Line 1)</Label>
                  <Input id="edit-ops-line1" value={editOpsLine1} onChange={(e) => setEditOpsLine1(e.target.value)} placeholder="1 Example Street" data-testid="input-edit-ops-line1" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="edit-ops-line2">Line 2 (optional)</Label>
                  <Input id="edit-ops-line2" value={editOpsLine2} onChange={(e) => setEditOpsLine2(e.target.value)} placeholder="Flat / Suite / Floor" data-testid="input-edit-ops-line2" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-ops-city">City</Label>
                  <Input id="edit-ops-city" value={editOpsCity} onChange={(e) => setEditOpsCity(e.target.value)} placeholder="Lagos" data-testid="input-edit-ops-city" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-ops-state">State</Label>
                  <Input id="edit-ops-state" value={editOpsState} onChange={(e) => setEditOpsState(e.target.value)} placeholder="Lagos State" data-testid="input-edit-ops-state" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-ops-postal">Postal Code (optional)</Label>
                  <Input id="edit-ops-postal" value={editOpsPostalCode} onChange={(e) => setEditOpsPostalCode(e.target.value)} placeholder="100001" data-testid="input-edit-ops-postal" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-ops-country">Country</Label>
                  <Input id="edit-ops-country" value={editOpsCountry} onChange={(e) => setEditOpsCountry(e.target.value)} placeholder="Nigeria" data-testid="input-edit-ops-country" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Directors Data JSON */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Directors Data (JSON array)</p>
              <p className="text-xs text-muted-foreground mb-2">Leave blank to keep existing data. Must be a valid JSON array if provided.</p>
              <Textarea
                id="edit-directors-json"
                value={editDirectorsJson}
                onChange={(e) => { setEditDirectorsJson(e.target.value); setDirectorsJsonError(""); }}
                placeholder='[{"fullName": "John Doe", "role": "director", ...}]'
                rows={5}
                className="font-mono text-xs"
                data-testid="textarea-edit-directors-json"
              />
              {directorsJsonError && <p className="text-xs text-destructive mt-1">{directorsJsonError}</p>}
            </div>

            <Separator />

            {/* Shareholders Data JSON */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Shareholders Data (JSON array)</p>
              <p className="text-xs text-muted-foreground mb-2">Leave blank to keep existing data. Must be a valid JSON array if provided.</p>
              <Textarea
                id="edit-shareholders-json"
                value={editShareholdersJson}
                onChange={(e) => { setEditShareholdersJson(e.target.value); setShareholdersJsonError(""); }}
                placeholder='[{"fullName": "Jane Doe", "sharePercentage": 50, ...}]'
                rows={5}
                className="font-mono text-xs"
                data-testid="textarea-edit-shareholders-json"
              />
              {shareholdersJsonError && <p className="text-xs text-destructive mt-1">{shareholdersJsonError}</p>}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditProfileOpen(false)}>Cancel</Button>
            <Button
              onClick={submitEditProfile}
              disabled={editProfileMutation.isPending || !editCompanyName1.trim()}
              data-testid="button-save-edit-profile"
            >
              {editProfileMutation.isPending ? <LoadingSpinner size="sm" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
