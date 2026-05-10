import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2, User, FileText, Upload, Loader2, CheckCircle2,
  ArrowLeft, ArrowRight, Trash2, Download, AlertCircle, Landmark,
} from "lucide-react";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi",
  "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const BUSINESS_CATEGORIES = [
  { value: "dealers_luxury_goods", label: "Dealers in Luxury Goods" },
  { value: "dealers_jewelry", label: "Dealers in Jewellery" },
  { value: "car_dealers", label: "Car Dealers" },
  { value: "supermarket", label: "Supermarket" },
  { value: "hotels_hospitality", label: "Hotels and Hospitality" },
  { value: "casinos_betting_lottery", label: "Casinos, Pool Betting & Lottery" },
  { value: "audit_firms", label: "Audit Firms" },
  { value: "tax_consultants", label: "Tax Consultants" },
  { value: "accounting_firms", label: "Accounting Firms" },
  { value: "estate_surveyors", label: "Estate Surveyors and Valuers" },
  { value: "dealers_real_estate", label: "Dealers in Real Estate" },
  { value: "mechanized_farming", label: "Mechanized Farming" },
  { value: "construction", label: "Construction Companies" },
  { value: "mortgage_brokers", label: "Mortgage Brokers" },
  { value: "consulting", label: "Consulting Companies" },
  { value: "clearing_forwarding", label: "Clearing & Forwarding Companies" },
  { value: "dealers_precious_metals", label: "Dealers in Precious Metals & Stones" },
  { value: "law_firms", label: "Law Firms" },
  { value: "npos", label: "Non-Profit Organizations (NPOs)" },
  { value: "other", label: "Other" },
];

const CAC_REGISTRATION_TYPES = [
  { value: "limited_liability", label: "Limited Liability Company" },
  { value: "business_name", label: "Business Name" },
];

const DOC_TYPES = [
  { value: "certificate_of_incorporation", label: "Certificate of Incorporation / Business Name Registration" },
  { value: "memart", label: "Memorandum and Articles of Association (MEMART)" },
  { value: "status_report", label: "Status Report (CAC 1.1 / CAC 7 / BN-01)" },
  { value: "tin_printout", label: "TIN Printout" },
  { value: "proof_of_address", label: "Proof of Address (Utility Bill / Tenancy Agreement)" },
  { value: "additional_certificate", label: "Additional Industry Certificate" },
];

const serviceProfileFormSchemaBase = z.object({
  category: z.string().min(1, "Business category is required"),
  cacRegistrationType: z.string().min(1, "Registration type is required"),
  sector: z.string().optional().default(""),
  mainBusinessObjectives: z.string().optional().default(""),
  incorporationNumber: z.string().min(1, "Incorporation/Registration number is required"),
  registeredName: z.string().min(1, "Registered company name is required"),
  dateIncorporated: z.string().optional().default(""),
  tinNumber: z.string().optional().default(""),
  headOfficeAddress: z.string().optional().default(""),
  state: z.string().optional().default(""),
  bankName: z.string().optional().default(""),
  bankPartnerId: z.number().optional(),
  accountNumber: z.string().optional().default(""),
  accountName: z.string().optional().default(""),
  organizationPhone: z.string().optional().default(""),
  organizationEmail: z.string().optional().default(""),
  contactPersonName: z.string().optional().default(""),
  contactPersonNin: z.string().optional().default(""),
  contactPersonAddress: z.string().optional().default(""),
  contactPersonEmail: z.string().optional().default(""),
  contactPersonMobile: z.string().optional().default(""),
});

const serviceProfileFormSchema = serviceProfileFormSchemaBase;

type ServiceProfileFormData = z.infer<typeof serviceProfileFormSchema>;

interface UploadedDoc {
  id: number;
  docType: string;
  filename: string;
  storagePath: string;
  sizeBytes: number | null;
  mimeType: string | null;
}

export default function ServiceRequestFormPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const editProfileId = params.get("profileId");
  const serviceType = params.get("service");
  const orderId = params.get("orderId");
  const cpIdParam = params.get("cpId");
  const [step, setStep] = useState(1);
  const [profileId, setProfileId] = useState<number | null>(editProfileId ? parseInt(editProfileId) : null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  // For BANK_ACCOUNT without cpId in URL: let founder pick which verified company
  const [manualCpId, setManualCpId] = useState<number | null>(null);

  const { data: orderData, isLoading: orderLoading } = useQuery<any>({
    queryKey: ["/api/founder/orders", orderId],
    enabled: !!orderId,
  });

  const orderIsPaid = !orderId || orderData?.order?.status === "paid";

  const { data: orderServiceRequests } = useQuery<any[]>({
    queryKey: ["/api/founder/orders", orderId, "service-requests"],
    enabled: !!orderId && orderIsPaid,
  });

  const { data: existingProfiles, isLoading: profilesLoading } = useQuery<any[]>({
    queryKey: ["/api/founder/service-profiles"],
  });

  interface BankPartner { id: number; name: string; }
  interface CompanyProfile { id: number; companyName: string; status?: string; existingCompanyStatus?: string; }

  const bankPartnersQuery = useQuery<BankPartner[]>({
    queryKey: ["/api/founder/bank-partners"],
    enabled: serviceType === "BANK_ACCOUNT",
  });

  const companyProfilesQuery = useQuery<CompanyProfile[]>({
    queryKey: ["/api/founder/company-profiles"],
    enabled: serviceType === "BANK_ACCOUNT" && !cpIdParam,
  });

  // Use the explicit cpId from the URL when provided (e.g. from checklist/dashboard links).
  // Fall back to a manually selected company (via selector) or the first verified company found.
  const cpIdFromUrl = cpIdParam ? parseInt(cpIdParam, 10) : null;
  const verifiedProfiles = companyProfilesQuery.data?.filter(p => p.existingCompanyStatus === "verified") ?? [];
  const verifiedProfileId: number | null =
    (cpIdFromUrl && !isNaN(cpIdFromUrl))
      ? cpIdFromUrl
      : (manualCpId ?? verifiedProfiles[0]?.id ?? null);

  const { data: profileDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/founder/service-profiles", profileId],
    enabled: !!profileId,
  });

  const uploadedDocs: UploadedDoc[] = profileDetail?.documents || [];

  const form = useForm<ServiceProfileFormData>({
    resolver: zodResolver(serviceProfileFormSchema),
    defaultValues: {
      category: "",
      cacRegistrationType: "",
      sector: "",
      mainBusinessObjectives: "",
      incorporationNumber: "",
      registeredName: "",
      dateIncorporated: "",
      tinNumber: "",
      headOfficeAddress: "",
      state: "",
      bankName: "",
      bankPartnerId: undefined,
      accountNumber: "",
      accountName: "",
      organizationPhone: "",
      organizationEmail: "",
      contactPersonName: "",
      contactPersonNin: "",
      contactPersonAddress: "",
      contactPersonEmail: "",
      contactPersonMobile: "",
    },
  });

  useEffect(() => {
    if (profileDetail && profileDetail.id) {
      form.reset({
        category: profileDetail.category || "",
        cacRegistrationType: profileDetail.cacRegistrationType || "",
        sector: profileDetail.sector || "",
        mainBusinessObjectives: profileDetail.mainBusinessObjectives || "",
        incorporationNumber: profileDetail.incorporationNumber || "",
        registeredName: profileDetail.registeredName || "",
        dateIncorporated: profileDetail.dateIncorporated || "",
        tinNumber: profileDetail.tinNumber || "",
        headOfficeAddress: profileDetail.headOfficeAddress || "",
        state: profileDetail.state || "",
        bankName: profileDetail.bankName || "",
        accountNumber: profileDetail.accountNumber || "",
        accountName: profileDetail.accountName || "",
        organizationPhone: profileDetail.organizationPhone || "",
        organizationEmail: profileDetail.organizationEmail || "",
        contactPersonName: profileDetail.contactPersonName || "",
        contactPersonNin: profileDetail.contactPersonNin || "",
        contactPersonAddress: profileDetail.contactPersonAddress || "",
        contactPersonEmail: profileDetail.contactPersonEmail || "",
        contactPersonMobile: profileDetail.contactPersonMobile || "",
      });
    }
  }, [profileDetail, form]);

  const linkProfileToServiceRequests = async (pId: number) => {
    if (!orderServiceRequests || !orderId) return;
    for (const sr of orderServiceRequests) {
      if (!sr.companyProfileId) {
        try {
          await apiRequest("PUT", `/api/founder/service-requests/${sr.id}/profile`, { companyProfileId: pId });
        } catch (err) {
          console.error("Failed to link profile to service request:", err);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/founder/orders", orderId, "service-requests"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ServiceProfileFormData) => {
      if (profileId) {
        const res = await apiRequest("PUT", `/api/founder/service-profiles/${profileId}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/founder/service-profiles", data);
        return res.json();
      }
    },
    onSuccess: async (result) => {
      const savedProfileId = profileId || result.id;
      if (!profileId) {
        setProfileId(savedProfileId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/founder/service-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/service-profiles", savedProfileId] });

      await linkProfileToServiceRequests(savedProfileId);

      if (serviceType === "BANK_ACCOUNT") {
        const bpId = form.getValues("bankPartnerId");
        if (bpId && verifiedProfileId) {
          const instrRes = await apiRequest("POST", "/api/founder/bank-account-instructions", {
            companyProfileId: verifiedProfileId,
            bankPartnerId: bpId,
          });
          if (!instrRes.ok) {
            const err = await instrRes.json().catch(() => ({ error: "Unknown error" }));
            // Hard block: consent instruction must be recorded before the flow advances
            toast({ title: "Bank instruction not saved", description: err.error || "Failed to record bank account instruction. Please try again.", variant: "destructive" });
            return;
          }
          queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles", verifiedProfileId, "bank-account-instructions"] });
        } else if (!verifiedProfileId) {
          toast({ title: "No verified company found", description: "A verified company profile is required to submit a bank account instruction. Please contact support.", variant: "destructive" });
          return;
        }
      }

      toast({ title: "Company details saved", description: "Your company information has been saved successfully." });
      setStep(3);
    },
    onError: (error: Error) => {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      if (!profileId) throw new Error("Save company details first");

      const urlRes = await apiRequest("POST", `/api/founder/service-profiles/${profileId}/documents/upload-url`, {
        name: file.name,
        size: file.size,
        contentType: file.type,
        docType,
      });
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      const docRes = await apiRequest("POST", `/api/founder/service-profiles/${profileId}/documents`, {
        docType,
        filename: file.name,
        storagePath: objectPath,
        sizeBytes: file.size,
        mimeType: file.type,
      });
      return docRes.json();
    },
    onSuccess: () => {
      setUploadingDocType(null);
      queryClient.invalidateQueries({ queryKey: ["/api/founder/service-profiles", profileId] });
      toast({ title: "Document uploaded", description: "Your document has been uploaded successfully." });
    },
    onError: (error: Error) => {
      setUploadingDocType(null);
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/founder/service-profiles/${profileId}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/service-profiles", profileId] });
      toast({ title: "Document removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (docType: string, file: File) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only PDF, JPEG, and PNG files are allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }
    setUploadingDocType(docType);
    uploadDocMutation.mutate({ file, docType });
  };

  const onSubmitCompanyDetails = (data: ServiceProfileFormData) => {
    if (serviceType === "BANK_ACCOUNT" && !data.bankPartnerId) {
      form.setError("bankPartnerId", { type: "manual", message: "Please select a bank partner to proceed." });
      return;
    }
    saveMutation.mutate(data);
  };

  const handlePrefill = (existingProfile: any) => {
    setProfileId(existingProfile.id);
    queryClient.invalidateQueries({ queryKey: ["/api/founder/service-profiles", existingProfile.id] });
  };

  if (orderLoading || profilesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="form-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orderId && !orderIsPaid) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold" data-testid="text-payment-required">Payment Required</h2>
            <p className="text-muted-foreground">
              Payment for this order has not been confirmed yet. You can fill in your company details and upload documents after your payment is processed.
            </p>
            <Button
              variant="outline"
              onClick={() => setLocation(`/founder/orders/${orderId}`)}
              data-testid="button-view-order"
            >
              View Order Status
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/founder/checkout")}
          data-testid="button-back-checkout"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-form-title">
            Service Request Form
          </h1>
          <p className="text-muted-foreground mt-1">
            {serviceType
              ? `Complete your ${serviceType.toUpperCase()} registration details`
              : "Fill in your company details for service registration"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2" data-testid="step-indicator">
        {[
          { num: 1, label: "Company Details" },
          { num: 2, label: "Contact Person" },
          { num: 3, label: "Documents" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2">
            {idx > 0 && <div className="h-px w-8 bg-border" />}
            <button
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                step === s.num
                  ? "text-primary"
                  : step > s.num
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
              }`}
              onClick={() => {
                if (s.num <= 2 || profileId) setStep(s.num);
              }}
              data-testid={`step-${s.num}`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.num
                    ? "bg-primary text-primary-foreground"
                    : step > s.num
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </div>
        ))}
      </div>

      {existingProfiles && existingProfiles.length > 0 && !profileId && step === 1 && (
        <Card data-testid="card-existing-profiles">
          <CardHeader>
            <CardTitle className="text-base">Use Existing Company Details</CardTitle>
            <CardDescription>You have previously saved company profiles. Select one to pre-fill the form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingProfiles.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 p-3 rounded-md border cursor-pointer hover-elevate"
                onClick={() => handlePrefill(p)}
                data-testid={`prefill-profile-${p.id}`}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.registeredName}</p>
                  <p className="text-xs text-muted-foreground">RC: {p.incorporationNumber}</p>
                </div>
                <Badge variant="secondary">Use this</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitCompanyDetails)}>
          {step === 1 && (
            <Card data-testid="card-section-company">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Section 1: Company Details
                </CardTitle>
                <CardDescription>
                  Enter your company registration details as they appear on your CAC documents.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Choose Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BUSINESS_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="cacRegistrationType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CAC Registration Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-cac-type">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CAC_REGISTRATION_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="sector" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sector</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Technology, Agriculture, Finance" {...field} data-testid="input-sector" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="mainBusinessObjectives" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Business Objectives</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe your main business activities" {...field} data-testid="input-business-objectives" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="incorporationNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incorporation / Registration Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="CAC/NEPZA Reg Number" {...field} data-testid="input-rc-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="registeredName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registered Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="As on Certificate" {...field} data-testid="input-registered-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="dateIncorporated" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Incorporated</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-date-incorporated" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="tinNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID Number (TIN)</FormLabel>
                      <FormControl>
                        <Input placeholder="TIN Number" {...field} data-testid="input-tin" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="headOfficeAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Head Office Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Physical address of head office" {...field} data-testid="input-head-office" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-state">
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NIGERIAN_STATES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />
                <p className="text-sm font-medium text-muted-foreground">Bank Details</p>

                {serviceType === "BANK_ACCOUNT" && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <Landmark className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Select a Cellion bank partner below. Your bank account instruction will be recorded when you save — you can then send your verified company dossier to the bank from your Document Vault.
                      </p>
                    </div>
                    {/* Company selector: only shown when cpId is not in the URL */}
                    {!cpIdParam && !companyProfilesQuery.isLoading && verifiedProfiles.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-700 dark:text-blue-300 shrink-0">Company:</span>
                        <Select
                          value={String(verifiedProfileId ?? "")}
                          onValueChange={val => setManualCpId(Number(val))}
                          data-testid="select-company-for-instruction"
                        >
                          <SelectTrigger className="h-7 text-xs" data-testid="trigger-company-for-instruction">
                            <SelectValue placeholder="Select company…" />
                          </SelectTrigger>
                          <SelectContent>
                            {verifiedProfiles.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.companyName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!cpIdParam && !companyProfilesQuery.isLoading && verifiedProfiles.length === 1 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Company: <span className="font-medium">{verifiedProfiles[0].companyName}</span>
                      </p>
                    )}
                    {!cpIdParam && !companyProfilesQuery.isLoading && verifiedProfiles.length === 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                        No verified company found. Please verify your company first before submitting a bank account instruction.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {serviceType === "BANK_ACCOUNT" ? (
                    <FormField control={form.control} name="bankPartnerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Partner</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ? String(field.value) : ""}
                            onValueChange={val => field.onChange(Number(val))}
                            disabled={bankPartnersQuery.isLoading}
                            data-testid="select-bank-partner"
                          >
                            <SelectTrigger data-testid="trigger-bank-partner">
                              <SelectValue placeholder={bankPartnersQuery.isLoading ? "Loading…" : "Select a bank partner"} />
                            </SelectTrigger>
                            <SelectContent>
                              {(bankPartnersQuery.data || []).map(bp => (
                                <SelectItem key={bp.id} value={String(bp.id)}>{bp.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ) : (
                    <FormField control={form.control} name="bankName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank</FormLabel>
                        <FormControl>
                          <Input placeholder="Bank Name" {...field} data-testid="input-bank" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="accountNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Account Number" {...field} data-testid="input-account-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="accountName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Account Name" {...field} data-testid="input-account-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="organizationPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Phone (+234)</FormLabel>
                      <FormControl>
                        <Input placeholder="080-000-0000" {...field} data-testid="input-org-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="organizationEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="company@example.com" {...field} data-testid="input-org-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="button" onClick={() => setStep(2)} data-testid="button-next-step-2">
                    Next: Contact Person <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card data-testid="card-section-contact">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Section 2: Contact Person Details
                </CardTitle>
                <CardDescription>
                  Provide the details of the company's contact person (typically a Director).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="contactPersonName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name of contact person" {...field} data-testid="input-contact-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contactPersonNin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>National Identity Number (NIN)</FormLabel>
                    <FormControl>
                      <Input placeholder="000-0000-0000 (11 digits)" {...field} data-testid="input-contact-nin" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contactPersonAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Residential address" {...field} data-testid="input-contact-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="contactPersonEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@example.com" {...field} data-testid="input-contact-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="contactPersonMobile" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile (+234)</FormLabel>
                      <FormControl>
                        <Input placeholder="080-000-0000" {...field} data-testid="input-contact-mobile" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 flex-wrap">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-back-step-1">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    data-testid="button-save-and-continue"
                  >
                    {saveMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <>Save & Continue to Documents <ArrowRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>

      {step === 3 && (
        <Card data-testid="card-section-documents">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Section 3: Document Uploads
            </CardTitle>
            <CardDescription>
              Upload the required documents. All documents must be in PDF, JPEG, or PNG format (max 10MB each).
              SCUML recommends merging all documents into a single PDF not exceeding 2.5MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DOC_TYPES.map((dt) => {
              const existingDoc = uploadedDocs.find(d => d.docType === dt.value);
              const isUploading = uploadingDocType === dt.value && uploadDocMutation.isPending;

              return (
                <div
                  key={dt.value}
                  className="flex items-center justify-between gap-4 p-3 rounded-md border"
                  data-testid={`doc-row-${dt.value}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{dt.label}</p>
                    {existingDoc ? (
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{existingDoc.filename}</span>
                        {existingDoc.sizeBytes && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({(existingDoc.sizeBytes / 1024).toFixed(0)} KB)
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Not uploaded yet</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {existingDoc && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteDocMutation.mutate(existingDoc.id)}
                        disabled={deleteDocMutation.isPending}
                        data-testid={`button-delete-doc-${dt.value}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <label>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(dt.value, file);
                          e.target.value = "";
                        }}
                        disabled={isUploading}
                        data-testid={`input-upload-${dt.value}`}
                      />
                      <Button
                        size="sm"
                        variant={existingDoc ? "outline" : "default"}
                        disabled={isUploading}
                        asChild
                      >
                        <span className="cursor-pointer">
                          {isUploading ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading</>
                          ) : existingDoc ? (
                            <><Upload className="h-3 w-3 mr-1" /> Replace</>
                          ) : (
                            <><Upload className="h-3 w-3 mr-1" /> Upload</>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              );
            })}

            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium">Required documents vary by business category:</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>Limited Liability: Certificate of Incorporation, MEMART, Status Report (CAC 1.1/CAC 7/CAC 2), TIN</li>
                  <li>Business Name: Certificate of Registration, Status Report (BN-01), TIN</li>
                  <li>Some industries require additional certificates (e.g., ICAN/ANAN for audit firms)</li>
                  <li>Proof of address is required for most registrations</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 flex-wrap">
              <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-back-step-2">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                onClick={() => {
                  toast({ title: "Form submitted", description: "Your service request details have been saved. A lawyer will review your submission." });
                  setLocation("/founder/checkout");
                }}
                data-testid="button-complete-form"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Complete Submission
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
