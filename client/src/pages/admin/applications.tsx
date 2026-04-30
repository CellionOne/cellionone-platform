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
import { apiRequest, queryClient } from "@/lib/queryClient";
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update profile");
      }
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

  const resendCompletionMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const res = await apiRequest("POST", `/api/admin/applications/${applicationId}/resend-completion`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => toast({ title: "Email sent", description: "A completion link has been sent to the founder." }),
    onError: (e: Error) => toast({ title: "Email failed", description: e.message, variant: "destructive" }),
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
        <div>
          <h1 className="text-2xl font-bold">All Applications</h1>
          <p className="text-muted-foreground">View and manage all platform applications</p>
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
                              disabled={resendCompletionMutation.isPending}
                              data-testid={`button-resend-completion-${app.id}`}
                            >
                              {resendCompletionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <MailCheck className="h-4 w-4 mr-1" />
                              )}
                              Resend Link
                            </Button>
                          )}
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
