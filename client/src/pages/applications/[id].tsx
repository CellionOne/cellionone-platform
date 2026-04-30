import { useState, useRef, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner, LoadingPage } from "@/components/loading-spinner";
import { ReadinessPanel } from "@/components/readiness-panel";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import {
  Building2,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  Truck,
  MessageSquare,
  Users,
  ShieldCheck,
  Mail,
  UserCheck,
  ArrowRight,
  Plus,
  X,
  Hash,
  Shield,
  MapPin,
  XCircle,
  Navigation,
  AlertTriangle,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { CompanyApplication, ApplicationChecklistItem, Payment, ClarificationRequest } from "@shared/schema";

interface ReadinessPerson {
  id: number | string;
  applicationId?: number | null;
  inviteEmail: string | null;
  role: string;
  inviteStatus: string | null;
  isVerified: boolean | null;
  personUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  profileCompletion: number;
  isProfileComplete: boolean;
  entityType?: string | null;
  autoVerifyMethod?: string | null;
  corporateBusinessType?: string | null;
}

interface ReadinessSummary {
  people: ReadinessPerson[];
  summary: {
    totalPeople: number;
    readyCount: number;
    allReady: boolean;
  };
}

interface ApplicationDetails {
  application: CompanyApplication;
  checklist: ApplicationChecklistItem[];
  payment: Payment | null;
  clarifications: ClarificationRequest[];
}

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  priceNgn: number;
  requiresManualPricing: boolean | null;
  metadata: Record<string, unknown> | null;
}

const ADD_ON_SKUS = ["TIN", "SCUML", "TM", "OFFICE_ONLY", "OFFICE_PLUS_MAIL"] as const;

const ADD_ON_META: Record<string, { icon: LucideIcon; label: string; description: string; benefit: string; badge?: string }> = {
  TIN: {
    icon: Hash,
    label: "TIN Registration",
    description: "Get your Tax Identification Number from FIRS. Required for opening a corporate bank account.",
    benefit: "Needed for corporate bank account",
  },
  SCUML: {
    icon: FileText,
    label: "SCUML Certificate",
    description: "Special Control Unit against Money Laundering certificate from the EFCC. Required for certain financial transactions.",
    benefit: "Ready in 5 business days",
  },
  TM: {
    icon: Shield,
    label: "Trademark Registration",
    description: "Protect your brand name with a registered trademark. Covers both stages of the trademark process.",
    benefit: "Full brand name protection",
  },
  OFFICE_ONLY: {
    icon: MapPin,
    label: "Registered Office (Address Only)",
    description: "Use our prestigious Ikoyi, Lagos address as your official CAC-registered office address.",
    benefit: "Annual subscription",
    badge: "/year",
  },
  OFFICE_PLUS_MAIL: {
    icon: Mail,
    label: "Registered Office + Mail Handling",
    description: "Our Ikoyi address plus mail receiving, scanning, and forwarding. Ideal for remote founders.",
    benefit: "Annual subscription",
    badge: "/year",
  },
};

const statusTimeline = [
  { status: "draft", label: "Draft", icon: FileText },
  { status: "pending_verification", label: "Awaiting Verification", icon: AlertCircle },
  { status: "submitted", label: "Submitted", icon: Clock },
  { status: "under_review", label: "Under Review", icon: AlertCircle },
  { status: "filed", label: "Filed", icon: CheckCircle2 },
  { status: "pending_originals", label: "Pending Originals", icon: FileText },
  { status: "courier_in_transit", label: "In Transit", icon: Truck },
  { status: "completed", label: "Completed", icon: CheckCircle2 },
];

export default function ApplicationDetailsPage() {
  const [, params] = useRoute("/applications/:id");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const applicationId = params?.id;
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  const prevChecklistRef = useRef<ApplicationChecklistItem[] | null>(null);

  const { data, isLoading } = useQuery<ApplicationDetails>({
    queryKey: ["/api/applications", applicationId],
    enabled: !!applicationId,
    refetchInterval: (query) => {
      const d = query.state.data as ApplicationDetails | undefined;
      if (!d) return false;
      const preSubmitStatuses = ["draft", "pending_verification"];
      const isPreSubmit = preSubmitStatuses.includes(d.application?.status ?? "");
      const hasMissing = d.checklist?.some(
        (item) => item.required && item.status === "missing"
      );
      return isPreSubmit && hasMissing ? 5000 : false;
    },
  });

  useEffect(() => {
    if (!data?.checklist) return;
    const prev = prevChecklistRef.current;
    if (prev) {
      const autoResolved = data.checklist.filter((item) => {
        const prevItem = prev.find((p) => p.id === item.id);
        return (
          prevItem?.status === "missing" &&
          (item.status === "provided" || item.status === "accepted") &&
          item.isAutoResolved === true
        );
      });
      if (autoResolved.length > 0) {
        const labels: Record<string, string> = {
          director_id: "Director verification",
          shareholder_details: "Shareholder verification",
          id_document: "Identity document",
          passport_photo: "Passport photo",
        };
        autoResolved.forEach((item) => {
          const label = labels[item.key ?? ""] ?? "A checklist item";
          toast({
            title: `${label} verified`,
            description: "Your checklist has been automatically updated.",
          });
        });
      }
    }
    prevChecklistRef.current = data.checklist;
  }, [data?.checklist]);

  const { data: teamReadiness } = useQuery<ReadinessSummary>({
    queryKey: ["/api/company-people/readiness"],
  });
  const teamPeople = teamReadiness?.people ?? [];

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const addOnProducts = (products ?? []).filter(
    p => (ADD_ON_SKUS as readonly string[]).includes(p.sku) && !p.requiresManualPricing
  );

  const toggleAddOn = (sku: string) => {
    if (sku === "OFFICE_ONLY" || sku === "OFFICE_PLUS_MAIL") {
      const sibling = sku === "OFFICE_ONLY" ? "OFFICE_PLUS_MAIL" : "OFFICE_ONLY";
      setSelectedAddOns(prev =>
        prev.includes(sku)
          ? prev.filter(s => s !== sku)
          : [...prev.filter(s => s !== sibling), sku]
      );
    } else {
      setSelectedAddOns(prev =>
        prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]
      );
    }
  };

  const selectedAddOnProducts = addOnProducts.filter(p => selectedAddOns.includes(p.sku));
  const addOnsTotalKobo = selectedAddOnProducts.reduce((sum, p) => sum + p.priceNgn, 0);

  const [isFileUploading, setIsFileUploading] = useState(false);
  const [inviteSentTo, setInviteSentTo] = useState<Set<number>>(new Set());
  const [corpInviteSentTo, setCorpInviteSentTo] = useState<Set<number>>(new Set());

  const directors = teamPeople.filter(
    (p) =>
      (p.role === "director" || p.role === "director_shareholder") &&
      p.applicationId === parseInt(applicationId || "0", 10) &&
      p.inviteEmail &&
      p.entityType !== "corporate"
  );

  type InviteResponse = { success: boolean; message: string; emailSent?: boolean; uploadLink?: string };

  const directorInviteMutation = useMutation<InviteResponse, Error, number>({
    mutationFn: async (personId: number): Promise<InviteResponse> => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/director-upload-invite/${personId}`);
      return res.json() as Promise<InviteResponse>;
    },
    onSuccess: (data, personId) => {
      setInviteSentTo((prev) => { const next = new Set(prev); next.add(personId); return next; });
      if (data.emailSent === false && data.uploadLink) {
        toast({
          title: "Email delivery failed",
          description: `The email could not be sent. Share this link manually: ${data.uploadLink}`,
          variant: "destructive",
          duration: 15000,
        });
      } else {
        toast({ title: "Upload link sent", description: "The director will receive an email with the upload link." });
      }
    },
    onError: (error) => {
      toast({ title: "Failed to send link", description: error.message, variant: "destructive" });
    },
  });

  const { data: corporateInviteTokens } = useQuery<{
    tokens: Array<{ personId: number; status: "active" | "used" | "expired"; sentAt: string; expiresAt: string }>;
  }>({
    queryKey: ["/api/applications", applicationId, "corporate-invite-tokens"],
    queryFn: () => fetch(`/api/applications/${applicationId}/corporate-invite-tokens`).then(r => r.json()),
    enabled: !!applicationId,
  });

  const corpTokenStatusMap = new Map(
    (corporateInviteTokens?.tokens ?? []).map(t => [t.personId, t])
  );

  const corporateInviteMutation = useMutation<InviteResponse, Error, number>({
    mutationFn: async (personId: number): Promise<InviteResponse> => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/corporate-doc-invite/${personId}`);
      return res.json() as Promise<InviteResponse>;
    },
    onSuccess: (data, personId) => {
      setCorpInviteSentTo((prev) => { const next = new Set(prev); next.add(personId); return next; });
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId, "corporate-invite-tokens"] });
      if (data.emailSent === false && data.uploadLink) {
        toast({
          title: "Email delivery failed",
          description: `The email could not be sent. Share this link manually: ${data.uploadLink}`,
          variant: "destructive",
          duration: 15000,
        });
      } else {
        toast({ title: "Upload link sent", description: "The entity representative will receive an email with the document upload link." });
      }
    },
    onError: (error) => {
      toast({ title: "Failed to send link", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ checklistId, file }: { checklistId: number; file: File }) => {
      setIsFileUploading(true);
      try {
        const csrfToken = await getCsrfToken();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("checklistItemId", checklistId.toString());
        formData.append("docType", "uploaded_document");

        const response = await fetch(`/api/applications/${applicationId}/documents/upload`, {
          method: "POST",
          headers: {
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
          credentials: "include",
          body: formData,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ message: "Upload failed" }));
          throw new Error(err.message || "Upload failed");
        }

        return response.json();
      } finally {
        setIsFileUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId] });
      toast({ title: "Document uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/applications/${applicationId}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/dashboard"] });
      toast({ title: "Application submitted", description: "Your application is now under review." });
    },
    onError: (error: any) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePayment = () => {
    if (!applicationId) return;
    const params = new URLSearchParams({ applicationId });
    const allSkus = ["CAC_1M", ...selectedAddOns];
    params.set("initSkus", allSkus.join(","));
    setLocation(`/founder/checkout?${params.toString()}`);
  };

  const INCORPORATION_FEE_KOBO = 10000000;
  const estimatedSubtotal = INCORPORATION_FEE_KOBO + addOnsTotalKobo;
  const estimatedAdminFee = Math.round(estimatedSubtotal * 0.10);
  const estimatedTotal = estimatedSubtotal + estimatedAdminFee;

  if (isLoading) return <LoadingPage />;

  if (!data?.application) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Application Not Found" }]}>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Application not found</h2>
        </div>
      </DashboardLayout>
    );
  }

  const { application, checklist, payment, clarifications } = data;

  // Separate standard checklist items from per-person/entity document requirements
  const standardItems = checklist.filter(item => item.source !== "people_requirement");
  const peopleReqItems = checklist.filter(item => item.source === "people_requirement");
  
  const completedItems = checklist.filter(item => item.status === "provided" || item.status === "accepted").length;
  const requiredItems = checklist.filter(item => item.required).length;
  const progress = requiredItems > 0 ? (completedItems / requiredItems) * 100 : 0;

  const hasMissingRequired = checklist.some(
    item => item.required && item.status !== "provided" && item.status !== "accepted"
  );

  // Group people_req items by person (extract person name from label prefix before " — ")
  type PeopleDocGroup = {
    personName: string;
    personId: number | null;
    entityTypeBadge: "Individual" | "Limited Company" | "Business Name" | "NGO / Trustee";
    items: ApplicationChecklistItem[];
  };

  const peopleDocGroups: PeopleDocGroup[] = (() => {
    const groups = new Map<string, ApplicationChecklistItem[]>();
    for (const item of peopleReqItems) {
      const dashIdx = item.label.indexOf(" — ");
      const personName = dashIdx >= 0 ? item.label.substring(0, dashIdx) : item.label;
      if (!groups.has(personName)) groups.set(personName, []);
      groups.get(personName)!.push(item);
    }
    return Array.from(groups.entries()).map(([personName, items]) => {
      // Detect entity type from key slug patterns
      const keys = items.map(i => i.key ?? "");
      let entityTypeBadge: PeopleDocGroup["entityTypeBadge"] = "Individual";
      if (keys.some(k => k.includes("_cac_cert_registration") || k.includes("_proprietor_gov_id") || k.includes("_proof_business_address"))) {
        entityTypeBadge = "Business Name";
      } else if (keys.some(k => k.includes("_cac_cert_incorporation_trustees") || k.includes("_constitution_rules") || k.includes("_list_of_trustees"))) {
        entityTypeBadge = "NGO / Trustee";
      } else if (keys.some(k => k.includes("_cac_cert_incorporation") || k.includes("_memorandum_articles") || k.includes("_board_resolution") || k.includes("_list_of_directors"))) {
        entityTypeBadge = "Limited Company";
      }
      // Extract personId from the item key pattern: people_req_{personId}_{slug}
      const firstKey = items[0]?.key ?? "";
      const personIdMatch = firstKey.match(/^people_req_(\d+)_/);
      const personId = personIdMatch ? parseInt(personIdMatch[1], 10) : null;
      return { personName, personId, entityTypeBadge, items };
    });
  })();

  const currentStatusIndex = statusTimeline.findIndex(s => s.status === application.status);

  const canSubmit = application.status === "draft" &&
    !hasMissingRequired &&
    payment?.status === "success";

  return (
    <DashboardLayout 
      role="founder" 
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "Applications", href: "/founder/applications" },
        { label: application.companyName1 || "Application" }
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{application.companyName1 || "Untitled Application"}</h1>
              <p className="text-muted-foreground">
                {application.applicationType === "incorporation" ? "Company Incorporation" : "Post-Incorporation"} 
                {" "}&bull;{" "}
                {application.companyType || "LTD"}
              </p>
              {application.rcNumber && (
                <p className="text-sm font-medium text-primary mt-0.5" data-testid="text-rc-number">
                  RC Number: {application.rcNumber}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={application.status || "draft"} className="text-sm" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Application Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {statusTimeline.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = step.status === application.status;
                
                return (
                  <div key={step.status} className="flex items-center flex-1 min-w-0">
                    {index > 0 && (
                      <div className={`h-0.5 flex-1 min-w-4 ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                    )}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`text-xs text-center whitespace-nowrap ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {clarifications.filter(c => c.status === "pending").length > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-600" />
                Clarification Requested
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clarifications.filter(c => c.status === "pending").map((req) => (
                <div key={req.id} className="p-3 rounded-lg bg-background">
                  <p className="text-sm">{req.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <OfflineSyncStatus />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Required Documents</CardTitle>
                <CardDescription>
                  Upload the required documents to proceed with your application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>{completedItems} of {requiredItems} completed</span>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                
                <div className="divide-y mt-4">
                  {standardItems.map((item) => {
                    const isAutoResolved =
                      item.status === "provided" &&
                      item.isAutoResolved === true;

                    const isProvided = item.status === "provided" || item.status === "accepted";
                    const sourceLabel =
                      isProvided && item.source === "kyc_auto_resolved"
                        ? "Auto-verified via KYC"
                        : isProvided && item.source === "manual_upload"
                        ? "Manually uploaded"
                        : null;

                    return (
                    <div key={item.id} className="py-3" data-testid={`checklist-${item.key}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            item.status === "accepted" || item.status === "provided"
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-muted"
                          }`}>
                            {item.status === "accepted" || item.status === "provided" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.required && !isAutoResolved && !sourceLabel && (
                              <span className="text-xs text-muted-foreground">Required</span>
                            )}
                            {isAutoResolved && !sourceLabel && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                                <ShieldCheck className="h-3 w-3" />
                                Verified — on file
                              </span>
                            )}
                            {sourceLabel && (
                              <span className="text-xs text-muted-foreground" data-testid={`source-label-${item.key}`}>
                                {sourceLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.status || "missing"} />
                          {(item.status === "missing" || item.status === "rejected") && (
                            <div className="relative">
                              <Input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                disabled={uploadMutation.isPending || isFileUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    uploadMutation.mutate({ checklistId: item.id, file });
                                    e.target.value = "";
                                  }
                                }}
                                data-testid={`upload-${item.key}`}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="pointer-events-none"
                                disabled={uploadMutation.isPending || isFileUploading}
                              >
                                {(uploadMutation.isPending || isFileUploading) ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  <Upload className="h-4 w-4 mr-1" />
                                )}
                                {uploadMutation.isPending || isFileUploading ? "Uploading..." : "Upload"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {item.key === "director_id" &&
                        (item.status === "missing" || (item.status === "provided" && item.source === "manual_upload")) &&
                        directors.length > 0 && (
                        <div className="mt-2 ml-11 space-y-1" data-testid="director-upload-invite-section">
                          {directors.map((director) => {
                            const personId = typeof director.id === "number" ? director.id : parseInt(String(director.id), 10);
                            const sent = inviteSentTo.has(personId);
                            const name = director.firstName && director.lastName
                              ? `${director.firstName} ${director.lastName}`
                              : director.title || director.inviteEmail || "Director";
                            return (
                              <div key={String(director.id)} className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">{name}</span>
                                {sent ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400" data-testid={`invite-sent-${personId}`}>
                                    <CheckCircle2 className="h-3 w-3" />
                                    Link sent
                                  </span>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => directorInviteMutation.mutate(personId)}
                                    disabled={directorInviteMutation.isPending}
                                    data-testid={`btn-send-upload-link-${personId}`}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    Send upload link
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {item.key === "address_proof" && application.operatingAddress && (
                        <div className="mt-2 ml-11 flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2" data-testid="operating-address-hint">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Match this address: </span>
                            {[
                              application.operatingAddress.line1,
                              application.operatingAddress.line2,
                              application.operatingAddress.city,
                              application.operatingAddress.state,
                              application.operatingAddress.postalCode,
                            ].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      )}
                      {(item.status === "missing" || item.status === "rejected") && (
                        <p className="text-xs text-muted-foreground mt-1 ml-11">
                          PDF, JPEG, PNG, DOC or DOCX &middot; max 10 MB
                        </p>
                      )}
                    </div>
                  );
                  })}
                </div>
              </CardContent>
            </Card>

            {peopleDocGroups.length > 0 && (
              <Card data-testid="card-people-entity-documents">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    People &amp; Entity Documents
                  </CardTitle>
                  <CardDescription>
                    Supporting documents required for each unverified director or shareholder
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {peopleDocGroups.map((group) => {
                    const groupComplete = group.items.every(
                      i => i.status === "provided" || i.status === "accepted"
                    );
                    const badgeVariant =
                      group.entityTypeBadge === "Individual"
                        ? "secondary"
                        : "outline";
                    return (
                      <div key={group.personName} data-testid={`people-doc-group-${group.personName.replace(/\s+/g, "-")}`}>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          {group.entityTypeBadge === "Individual" ? (
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">{group.personName}</span>
                          <Badge variant={badgeVariant} className="text-xs">
                            {group.entityTypeBadge}
                          </Badge>
                          {groupComplete ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 ml-auto">
                              <CheckCircle2 className="h-3 w-3" />
                              Complete
                            </span>
                          ) : (
                            group.entityTypeBadge !== "Individual" &&
                            group.personId !== null &&
                            application.status === "draft" && (() => {
                              const pid = group.personId!;
                              const persistedToken = corpTokenStatusMap.get(pid);
                              const justSent = corpInviteSentTo.has(pid);
                              const isActive = justSent || persistedToken?.status === "active";
                              const isStale = !justSent && (persistedToken?.status === "used" || persistedToken?.status === "expired");
                              return (
                                <span className="ml-auto flex items-center gap-2">
                                  {isActive ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400" data-testid={`corp-invite-sent-${pid}`}>
                                        <CheckCircle2 className="h-3 w-3" />
                                        Link active
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-muted-foreground"
                                        onClick={() => corporateInviteMutation.mutate(pid)}
                                        disabled={corporateInviteMutation.isPending}
                                        data-testid={`btn-resend-corp-upload-link-${pid}`}
                                      >
                                        <Send className="h-3 w-3 mr-1" />
                                        Resend
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => corporateInviteMutation.mutate(pid)}
                                      disabled={corporateInviteMutation.isPending}
                                      data-testid={`btn-send-corp-upload-link-${pid}`}
                                    >
                                      <Send className="h-3 w-3 mr-1" />
                                      {isStale ? "Resend link" : "Send upload link"}
                                    </Button>
                                  )}
                                </span>
                              );
                            })()
                          )}
                        </div>
                        <div className="divide-y rounded-lg border">
                          {group.items.map((item) => {
                            const isProvided = item.status === "provided" || item.status === "accepted";
                            const isAutoRes = isProvided && item.isAutoResolved;
                            const docLabel = item.label.includes(" — ")
                              ? item.label.split(" — ").slice(1).join(" — ")
                              : item.label;
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 px-3 py-2.5"
                                data-testid={`people-doc-item-${item.key}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                                    isProvided ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                                  }`}>
                                    {isProvided ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium leading-tight">{docLabel}</p>
                                    {isAutoRes ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                                        <ShieldCheck className="h-3 w-3" />
                                        Verified — on file
                                      </span>
                                    ) : isProvided ? (
                                      <span className="text-xs text-muted-foreground">Uploaded</span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Required · PDF, JPEG or PNG</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <StatusBadge status={item.status || "missing"} />
                                  {(item.status === "missing" || item.status === "rejected") && (
                                    <div className="relative">
                                      <Input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        disabled={uploadMutation.isPending || isFileUploading}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            uploadMutation.mutate({ checklistId: item.id, file });
                                            e.target.value = "";
                                          }
                                        }}
                                        data-testid={`upload-people-doc-${item.key}`}
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="pointer-events-none h-7 px-2 text-xs"
                                        disabled={uploadMutation.isPending || isFileUploading}
                                      >
                                        {(uploadMutation.isPending || isFileUploading) ? (
                                          <LoadingSpinner size="sm" />
                                        ) : (
                                          <Upload className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Upload
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {peopleReqItems.some(i => i.status === "missing" || i.status === "rejected") && (
                    <p className="text-xs text-muted-foreground">
                      Once a director or shareholder completes their identity verification on the platform, their documents will be automatically resolved.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Company Name</Label>
                    <p className="font-medium">{application.companyName1 || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Company Type</Label>
                    <p className="font-medium">{application.companyType || "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-muted-foreground">Business Description</Label>
                    <p className="font-medium">{application.businessDescription || "—"}</p>
                  </div>
                  {application.registeredAddress && (
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground">Registered Address</Label>
                      <p className="font-medium" data-testid="text-registered-address">
                        {[
                          application.registeredAddress.line1,
                          application.registeredAddress.line2,
                          application.registeredAddress.city,
                          application.registeredAddress.state,
                          application.registeredAddress.postalCode
                        ].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                  {application.operatingAddress && (
                    <div className="sm:col-span-2">
                      <Label className="text-muted-foreground">Operating Address</Label>
                      <p className="font-medium" data-testid="text-operating-address">
                        {[
                          application.operatingAddress.line1,
                          application.operatingAddress.line2,
                          application.operatingAddress.city,
                          application.operatingAddress.state,
                          application.operatingAddress.postalCode,
                        ].filter(Boolean).join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Match your Proof of Operating Address document to this address
                      </p>
                      {application.addressVerificationStatus && application.addressVerificationStatus !== "none" && (
                        <div className="mt-1.5">
                          {application.addressVerificationStatus === "verified" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full" data-testid="badge-address-verified">
                              <CheckCircle2 className="h-3 w-3" /> Address verified by field agent
                            </span>
                          )}
                          {application.addressVerificationStatus === "not_verified" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full" data-testid="badge-address-not-verified">
                              <XCircle className="h-3 w-3" /> Address verification unsuccessful — an admin will contact you
                            </span>
                          )}
                          {application.addressVerificationStatus === "submitted" && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="badge-address-submitted">
                              <Clock className="h-3 w-3" /> Field agent visit pending
                            </span>
                          )}
                          {application.addressVerificationStatus === "agent_assigned" && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400" data-testid="badge-address-agent-assigned">
                              <Navigation className="h-3 w-3" /> Field agent assigned — visit in progress
                            </span>
                          )}
                          {application.addressVerificationStatus === "failed" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 px-2 py-0.5 rounded-full" data-testid="badge-address-failed">
                              <AlertTriangle className="h-3 w-3" /> Address verification could not be completed — our team will be in touch
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {application.status === "draft" && (
              <ReadinessPanel applicationId={parseInt(applicationId!)} />
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasMissingRequired && (() => {
                  const missingPeopleReq = peopleReqItems.filter(
                    i => i.required && i.status !== "provided" && i.status !== "accepted"
                  ).length;
                  const missingStandard = standardItems.filter(
                    i => i.required && i.status !== "provided" && i.status !== "accepted"
                  ).length;
                  return (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                        {missingStandard > 0 && <p>Upload all required documents before proceeding to payment.</p>}
                        {missingPeopleReq > 0 && (
                          <p data-testid="alert-people-docs-missing">
                            {missingPeopleReq} supporting document{missingPeopleReq > 1 ? "s" : ""} still required from directors/shareholders.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {payment?.status === "success" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Status</span>
                      <StatusBadge status={payment.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Amount paid</span>
                      <span className="font-semibold text-sm">
                        ₦{((payment.amountTotalKobo || 0) / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between" data-testid="fee-line-incorporation">
                        <span className="text-muted-foreground">Company Incorporation</span>
                        <span className="font-medium">₦100,000</span>
                      </div>
                      {selectedAddOnProducts.map(p => (
                        <div key={p.sku} className="flex items-center justify-between" data-testid={`fee-line-addon-${p.sku}`}>
                          <span className="text-muted-foreground">{ADD_ON_META[p.sku]?.label || p.name}</span>
                          <span className="font-medium">₦{(p.priceNgn / 100).toLocaleString()}</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex items-center justify-between text-sm text-muted-foreground" data-testid="fee-line-subtotal">
                        <span>Subtotal</span>
                        <span>₦{(estimatedSubtotal / 100).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground" data-testid="fee-line-admin-fee">
                        <span>Administration Fee (10%)</span>
                        <span>₦{(estimatedAdminFee / 100).toLocaleString()}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between font-semibold" data-testid="fee-line-total">
                        <span>Estimated Total</span>
                        <span>₦{(estimatedTotal / 100).toLocaleString()}</span>
                      </div>
                    </div>

                    {payment && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Previous payment</span>
                        <StatusBadge status={payment.status || "initialized"} />
                      </div>
                    )}

                    <Button
                      className="w-full"
                      onClick={handlePayment}
                      disabled={hasMissingRequired}
                      data-testid="button-pay"
                    >
                      Continue to Checkout
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {application.status === "draft" && payment?.status !== "success" && (
              <Card data-testid="card-optional-addons">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Optional Services</CardTitle>
                  <CardDescription>
                    Add these to your checkout to complete everything in one payment.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {addOnProducts.map(p => {
                    const meta = ADD_ON_META[p.sku];
                    const Icon = meta?.icon || FileText;
                    const isSelected = selectedAddOns.includes(p.sku);
                    return (
                      <div
                        key={p.sku}
                        className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => toggleAddOn(p.sku)}
                        data-testid={`addon-card-${p.sku}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                              <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{meta?.label || p.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{meta?.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold">₦{(p.priceNgn / 100).toLocaleString()}{meta?.badge ?? ""}</span>
                            {isSelected ? (
                              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center" data-testid={`addon-selected-${p.sku}`}>
                                <X className="h-3 w-3 text-primary-foreground" />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center" data-testid={`addon-add-${p.sku}`}>
                                <Plus className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                        {meta?.benefit && (
                          <p className="text-xs text-primary mt-2 ml-9">{meta.benefit}</p>
                        )}
                      </div>
                    );
                  })}

                </CardContent>
              </Card>
            )}

            {application.status === "draft" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Submit Application</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      {progress === 100 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={progress === 100 ? "text-green-600" : "text-muted-foreground"}>
                        All documents uploaded
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {payment?.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={payment?.status === "success" ? "text-green-600" : "text-muted-foreground"}>
                        Payment completed
                      </span>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!canSubmit || submitMutation.isPending}
                      onClick={() => submitMutation.mutate()}
                      data-testid="button-submit-application"
                    >
                      {submitMutation.isPending ? <LoadingSpinner size="sm" /> : "Submit Application"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {teamPeople.filter(p => p.role === "founder" || p.applicationId === parseInt(applicationId || "0", 10)).length > 0 && (
              <Card data-testid="card-team-verification-status">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Verification
                  </CardTitle>
                  <CardDescription>
                    All directors and shareholders must verify their identity before submission.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teamPeople.filter(p => p.role === "founder" || p.applicationId === parseInt(applicationId || "0", 10)).map((person) => {
                    const name = person.firstName && person.lastName
                      ? `${person.firstName} ${person.lastName}`
                      : person.title || person.inviteEmail || "Unknown";
                    const isVerified = !!person.isVerified;
                    const hasProfile = person.isProfileComplete;
                    const isPending = person.inviteStatus === "pending" && !person.personUserId;
                    const isCorporateAutoVerified = person.entityType === 'corporate' && !!person.autoVerifyMethod;
                    const verifyMethodLabel = person.autoVerifyMethod === 'registry'
                      ? 'Verified via platform record'
                      : person.autoVerifyMethod === 'rep_match'
                      ? 'Verified via representative'
                      : person.autoVerifyMethod === 'smile_id_reuse'
                      ? 'Verified via CAC registry (prior lookup)'
                      : person.autoVerifyMethod === 'smile_id_live'
                      ? 'Verified via CAC registry (live check)'
                      : person.autoVerifyMethod === 'smile_id'
                      ? 'Verified via CAC registry'
                      : 'Platform Verified';

                    return (
                      <div
                        key={String(person.id)}
                        className="flex items-center justify-between gap-2 py-1.5"
                        data-testid={`team-person-${person.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                            isVerified
                              ? "bg-green-100 dark:bg-green-950"
                              : isPending
                              ? "bg-amber-100 dark:bg-amber-950"
                              : "bg-muted"
                          }`}>
                            {isVerified ? (
                              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                            ) : isPending ? (
                              <Mail className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {person.role.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                        {isCorporateAutoVerified ? (
                          <div className="flex items-center gap-1 flex-wrap justify-end" title={verifyMethodLabel}>
                            <Badge variant="default" className="text-xs shrink-0 bg-green-600 hover:bg-green-600" data-testid={`badge-profile-ready-${person.id}`}>
                              Profile Ready
                            </Badge>
                            <Badge variant="outline" className="text-xs shrink-0 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700" data-testid={`badge-platform-verified-${person.id}`}>
                              Platform Verified
                            </Badge>
                          </div>
                        ) : (
                          <Badge
                            variant={isVerified ? "default" : "secondary"}
                            className={`text-xs shrink-0 ${isVerified ? "bg-green-600 hover:bg-green-600" : ""}`}
                            data-testid={`badge-status-${person.id}`}
                          >
                            {isVerified ? "Verified" : isPending ? "Invited" : hasProfile ? "Profile Ready" : "Profile Incomplete"}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t">
                    <Link href="/founder/company-people">
                      <Button variant="outline" size="sm" className="w-full" data-testid="button-manage-team-from-app">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        Manage Team
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">What Happens Next</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {application.status === "draft" && (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <span>Upload all required documents</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <span>Complete payment</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <span>Submit for processing</span>
                      </li>
                    </>
                  )}
                  {application.status === "submitted" && (
                    <li>Your application is being assigned to a lawyer for review.</li>
                  )}
                  {application.status === "under_review" && (
                    <li>A lawyer is reviewing your application. You may be contacted for clarification.</li>
                  )}
                  {application.status === "filed" && (
                    <li>Your company has been filed with CAC. Waiting for stamped originals.</li>
                  )}
                  {application.status === "courier_in_transit" && (
                    <li>Your documents are on the way! Check tracking for updates.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
