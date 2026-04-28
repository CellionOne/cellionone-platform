import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getCsrfToken } from "@/lib/queryClient";
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  Search,
  Loader2,
  Info,
  Upload,
  FileText,
  X,
  Plus,
  User,
  CreditCard,
  AlertCircle,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const BASE_FEE_NGN = 15000;
const EXTRA_DIR_FEE_NGN = 2500;
const INCLUDED_DIRECTORS = 2;

const STEPS = [
  { id: 1, title: "RC Lookup", description: "Find your company in the CAC registry" },
  { id: 2, title: "Confirm Details", description: "Review and complete your company information" },
  { id: 3, title: "Directors", description: "Confirm director information" },
  { id: 4, title: "Documents", description: "Upload required company documents" },
  { id: 5, title: "Submit", description: "Submit your application for free verification" },
];

const VAULT_DOCS: { key: string; label: string }[] = [
  { key: "coi", label: "Certificate of Incorporation (CAC CO2)" },
  { key: "memat", label: "Memorandum & Articles of Association (MEMAT)" },
  { key: "cac_status", label: "CAC Status Report (current)" },
  { key: "tin_cert", label: "TIN Certificate" },
  { key: "proof_address", label: "Proof of Operating Address" },
  { key: "director_id", label: "Director Government-Issued ID (at least one)" },
];

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface KybResult {
  found: boolean;
  companyName?: string;
  rcNumber?: string;
  companyType?: string;
  registrationDate?: string;
  status?: string;
  address?: string;
  addressLine1?: string;
  addressState?: string;
  addressCountry?: string;
  shareCapital?: string;
  tinNumber?: string;
  directors?: { name: string; role?: string }[];
  smileJobId?: string;
  error?: string;
}

interface DirectorEntry {
  entityType: "individual" | "corporate";
  name: string;
  role: string;
  classification: "director" | "shareholder" | "director_shareholder";
  email: string;
  bvn: string;
  nin: string;
  rcNumber?: string;
  authorisedRepName?: string;
  countryOfIncorporation?: string;
  corporateBusinessType?: "co" | "bn";
  verified?: boolean;
  verifyMethod?: string;
}

interface PersistedDirector {
  name: string;
  role?: string;
  entityType?: string;
  classification?: string;
  email?: string;
  authorisedRepEmail?: string;
  bvn?: string;
  nin?: string;
  rcNumber?: string;
  authorisedRepName?: string;
  countryOfIncorporation?: string;
  corporateBusinessType?: "co" | "bn";
  verified?: boolean;
  verifyMethod?: string;
}

interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface UploadedDoc {
  key: string;
  fileName: string;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function AddressForm({ title, value, onChange }: {
  title: string;
  value: AddressFields;
  onChange: (v: AddressFields) => void;
}) {
  const set = (field: keyof AddressFields, val: string) => onChange({ ...value, [field]: val });
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid gap-3">
        <div>
          <Label>Address Line 1</Label>
          <Input value={value.line1} onChange={e => set("line1", e.target.value)} placeholder="Street address" data-testid={`input-${slug}-line1`} />
        </div>
        <div>
          <Label>Address Line 2 (optional)</Label>
          <Input value={value.line2} onChange={e => set("line2", e.target.value)} placeholder="Suite, floor, etc." data-testid={`input-${slug}-line2`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>City</Label>
            <Input value={value.city} onChange={e => set("city", e.target.value)} placeholder="City" data-testid={`input-${slug}-city`} />
          </div>
          <div>
            <Label>State</Label>
            <Select value={value.state} onValueChange={v => set("state", v)}>
              <SelectTrigger data-testid={`select-${slug}-state`}>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {NIGERIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface CompanyProfileSummary {
  id: number;
  companyName: string | null;
  rcNumber: string | null;
  isExistingCompany: boolean;
  existingCompanyStatus: string | null;
  directors: DirectorEntry[] | null;
  createdAt: string | null;
}

export default function ExistingCompanyPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [rcInput, setRcInput] = useState("");
  const [businessType, setBusinessType] = useState<"co" | "bn" | "it">("co");
  const [kybResult, setKybResult] = useState<KybResult | null>(null);
  const [kybLoading, setKybLoading] = useState(false);
  const [kybError, setKybError] = useState<string | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);

  // Step 2 fields
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("LTD");
  const [incorporationDate, setIncorporationDate] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [shareCapital, setShareCapital] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState<AddressFields>({ line1: "", line2: "", city: "", state: "", postalCode: "", country: "Nigeria" });
  const [operatingAddress, setOperatingAddress] = useState<AddressFields>({ line1: "", line2: "", city: "", state: "", postalCode: "", country: "Nigeria" });
  const [sameAddress, setSameAddress] = useState(false);

  // Step 3 directors
  const [directors, setDirectors] = useState<DirectorEntry[]>([]);
  const [newDirType, setNewDirType] = useState<"individual" | "corporate">("individual");
  const [newDir, setNewDir] = useState<DirectorEntry>({ entityType: "individual", name: "", role: "Director", classification: "director", email: "", bvn: "", nin: "", rcNumber: "", authorisedRepName: "", countryOfIncorporation: "Nigeria", corporateBusinessType: "co" });

  // Step 4 documents
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [createdProfileId, setCreatedProfileId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null);

  // ── On-mount profile recovery ─────────────────────────────────────────────
  // Parse optional query params from registrations page: ?profileId=123&step=5
  const queryParams = new URLSearchParams(searchString);
  const qProfileId = queryParams.get("profileId") ? parseInt(queryParams.get("profileId")!, 10) : null;
  const qStep = queryParams.get("step") ? parseInt(queryParams.get("step")!, 10) : null;

  // Fetch existing company profiles to detect resumable drafts
  const { data: allProfiles } = useQuery<CompanyProfileSummary[]>({
    queryKey: ["/api/founder/company-profiles"],
  });

  // Prefer explicitly requested profileId, fall back to first resumable draft/pending-payment.
  // When using profileId from URL, still constrain to resumable statuses so a founder can't
  // accidentally jump into a non-resumable profile via a stale link.
  const resumableProfile = (allProfiles || []).find(p => {
    if (!p.isExistingCompany) return false;
    const isResumable = p.existingCompanyStatus === "draft" || p.existingCompanyStatus === "pending_payment";
    if (qProfileId) return p.id === qProfileId && isResumable;
    return isResumable;
  }) ?? null;

  // If we navigated here fresh (no createdProfileId set) and there is a resumable profile,
  // pre-populate the in-memory profile ID automatically so uploads work right away.
  // Also jump to the requested step if provided via query param.
  useEffect(() => {
    if (resumableProfile && !createdProfileId) {
      setCreatedProfileId(resumableProfile.id);
      if (resumableProfile.companyName) setCompanyName(resumableProfile.companyName);
      if (resumableProfile.rcNumber) setRcInput(resumableProfile.rcNumber);
      if (resumableProfile.directors && Array.isArray(resumableProfile.directors)) {
        setDirectors(resumableProfile.directors);
      }
      // If a step was requested (e.g. step=5 from "Pay Now"), jump there directly
      if (qStep && qStep >= 1 && qStep <= 5) {
        setStep(qStep);
      }
    }
  }, [resumableProfile?.id]);

  // ── Step 1 validation ────────────────────────────────────────────────────────
  // KYB spec: only found=true permits advancing; genuine not-found BLOCKS progression
  // Service error (SDK crash, NOT_CONFIGURED etc) + network error → show warning + skip (dev mode)
  const kybServiceError = (kybResult?.found === false && !!kybResult?.error) || !!kybError;
  const kybGenuineNotFound = kybResult?.found === false && !kybResult?.error;
  const canProceedStep1 = kybResult?.found === true || kybServiceError;

  // ── KYB Lookup ──────────────────────────────────────────────────────────────

  const handleKybLookup = async () => {
    if (!rcInput.trim()) return;
    setKybLoading(true);
    setKybError(null);
    setKybResult(null);
    try {
      const res = await apiRequest("POST", "/api/founder/existing-company/kyb-lookup", { rcNumber: rcInput.trim(), businessType });
      const data: KybResult = await res.json();
      setKybResult(data);
      if (data.found) {
        setCompanyName(data.companyName || "");
        setCompanyType(data.companyType || "LTD");
        setIncorporationDate(data.registrationDate || "");
        setShareCapital(data.shareCapital || "");
        setTinNumber(data.tinNumber || "");
        if (data.addressLine1 || data.address) {
          setRegisteredAddress(prev => ({
            ...prev,
            line1: data.addressLine1 || data.address || "",
            state: data.addressState || prev.state,
            country: data.addressCountry || "Nigeria",
          }));
        }
        if (data.directors && data.directors.length > 0) {
          setDirectors(data.directors.map(d => ({ name: d.name, role: d.role || "Director", email: "", bvn: "", nin: "" })));
        }
      }
    } catch {
      setKybError("The lookup could not be completed. Please check your internet connection and try again.");
    } finally {
      setKybLoading(false);
    }
  };

  // ── Create Profile (Step 3 → 4 transition) ──────────────────────────────────
  // NOTE: smileKybResult is intentionally NOT sent — the server performs KYB authoritatively

  const createProfileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyName,
        companyType,
        rcNumber: rcInput || kybResult?.rcNumber || "",
        incorporationDate: incorporationDate || undefined,
        tinNumber: tinNumber || undefined,
        shareCapital: shareCapital || undefined,
        registeredAddress: sameAddress ? operatingAddress : registeredAddress,
        operatingAddress,
        directors,
        shareholders: directors
          .filter(d => d.classification === "shareholder" || d.classification === "director_shareholder")
          .map(d => ({ name: d.name })),
        businessActivities: [],
      };
      const res = await apiRequest("POST", "/api/founder/company-profiles/existing", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to create profile" }));
        throw new Error(err.message);
      }
      return res.json() as Promise<{ id: number; directors?: PersistedDirector[] }>;
    },
    onSuccess: (profile) => {
      setCreatedProfileId(profile.id);
      if (profile.directors && Array.isArray(profile.directors)) {
        setDirectors(profile.directors.map((d: PersistedDirector): DirectorEntry => ({
          entityType: (d.entityType === "corporate" ? "corporate" : "individual"),
          name: d.name || "",
          role: d.role || "Director",
          classification: (d.classification as DirectorEntry["classification"]) || "director",
          email: d.email || d.authorisedRepEmail || "",
          bvn: d.bvn || "",
          nin: d.nin || "",
          rcNumber: d.rcNumber || "",
          authorisedRepName: d.authorisedRepName || "",
          countryOfIncorporation: d.countryOfIncorporation || "Nigeria",
          corporateBusinessType: d.corporateBusinessType || "co",
          verified: d.verified || false,
          verifyMethod: d.verifyMethod || undefined,
        })));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "Failed to save company profile. Please try again.", variant: "destructive" });
    },
  });

  const handleEnterDocStep = async () => {
    if (!createdProfileId) {
      try {
        await createProfileMutation.mutateAsync();
      } catch {
        return;
      }
    }
    setStep(4);
  };

  // ── Document Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = (key: string) => {
    setActiveDocKey(key);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocKey) return;
    if (!createdProfileId) {
      toast({
        title: "Profile not found",
        description: "Please resume your registration using the banner above before uploading documents.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingDoc(activeDocKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docKey", activeDocKey);

      const csrf = await getCsrfToken();
      const res = await fetch(`/api/founder/company-profiles/${createdProfileId}/documents/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errData.message);
      }

      setUploadedDocs(prev => {
        const filtered = prev.filter(d => d.key !== activeDocKey);
        return [...filtered, { key: activeDocKey!, fileName: file.name }];
      });
      const docLabel = VAULT_DOCS.find(d => d.key === activeDocKey)?.label || activeDocKey;
      toast({ title: "Document uploaded", description: `${docLabel} has been uploaded.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setUploadingDoc(null);
      setActiveDocKey(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Submit (Step 5) — free verification, no payment required ─────────────────
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!createdProfileId) throw new Error("No company profile found");
      const res = await apiRequest("POST", `/api/founder/company-profiles/${createdProfileId}/checkout`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Submission failed" }));
        throw new Error(err.message);
      }
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles"] });
      toast({
        title: "Application Submitted",
        description: "Your company has been submitted for verification. We'll notify you when complete.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  // ── Step Validation ──────────────────────────────────────────────────────────

  const operatingAddressValid = sameAddress
    ? !!(registeredAddress.line1.trim() || operatingAddress.line1.trim()) // just needs some address
    : !!(operatingAddress.line1.trim() && operatingAddress.city.trim() && operatingAddress.state.trim());
  const canProceedStep2 = companyName.trim().length >= 2 && (rcInput.trim() || kybResult?.rcNumber || "").length >= 2 && operatingAddressValid;
  const uploadedKeys = new Set(uploadedDocs.map(d => d.key));
  const individualDirs = directors.filter(d => d.entityType !== "corporate");
  const corporateDirs = directors.filter(d => d.entityType === "corporate");
  const directorsWithoutId = individualDirs.filter(d => !d.bvn.trim() && !d.nin.trim());
  const corporateWithoutRc = corporateDirs.filter(d => !d.rcNumber?.trim());
  const canProceedStep3 = directors.length > 0 && directorsWithoutId.length === 0 && corporateWithoutRc.length === 0;
  const extraIndividualDirs = Math.max(0, individualDirs.length - INCLUDED_DIRECTORS);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "Register Existing Company" },
      ]}
    >
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Register Existing Company</h1>
            <p className="text-sm text-muted-foreground">Bring your already-incorporated company onto Cellion One</p>
          </div>
        </div>

        {/* Resume Banner — shown when a resumable draft exists and user hasn't dismissed it */}
        {resumableProfile && !resumeDismissed && step === 1 && createdProfileId === resumableProfile.id && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3" data-testid="banner-resume">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">You have a registration in progress</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-medium">{resumableProfile.companyName || "Unnamed Company"}</span>
                {resumableProfile.rcNumber && <span className="text-muted-foreground"> · RC {resumableProfile.rcNumber}</span>}
                {" — "}
                {"Draft saved"}
              </p>
              <div className="flex gap-2 mt-2.5">
                {(resumableProfile.existingCompanyStatus === "pending_payment" || resumableProfile.existingCompanyStatus === "draft") ? (
                  <Button size="sm" onClick={() => setStep(5)} data-testid="button-resume-to-payment">
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Go to Submit
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setStep(4)} data-testid="button-resume-to-documents">
                    <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                    Continue to Documents
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setResumeDismissed(true);
                    setCreatedProfileId(null);
                    setCompanyName("");
                    setRcInput("");
                    setDirectors([]);
                    setStep(1);
                  }}
                  data-testid="button-resume-dismiss"
                >
                  Start fresh instead
                </Button>
              </div>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
              onClick={() => setResumeDismissed(true)}
              data-testid="button-resume-close"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              {i > 0 && <div className={`h-0.5 flex-1 mr-1.5 ${step > s.id - 1 ? "bg-primary" : "bg-muted"}`} />}
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${step > s.id ? "bg-primary text-primary-foreground" : step === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {step > s.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
              </div>
            </div>
          ))}
        </div>

        {/* ── STEP 1: RC Lookup ── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: CAC Registry Lookup</CardTitle>
              <CardDescription>Enter your company's RC number to automatically pull details from the CAC database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  We verify your company details directly against the CAC registry database. Your company must be registered with the CAC to proceed.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="business-type">Registration Type</Label>
                <select
                  id="business-type"
                  value={businessType}
                  onChange={e => { setBusinessType(e.target.value as "co" | "bn" | "it"); setKybResult(null); setKybError(null); }}
                  data-testid="select-business-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="co">Limited Company (RC)</option>
                  <option value="bn">Business Name (BN)</option>
                  <option value="it">Incorporated Trustee (IT)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rc-number">CAC RC Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="rc-number"
                    value={rcInput}
                    onChange={e => { setRcInput(e.target.value); setKybResult(null); setKybError(null); }}
                    placeholder="e.g. RC1234567 or 1234567"
                    data-testid="input-rc-number"
                    onKeyDown={e => e.key === "Enter" && handleKybLookup()}
                  />
                  <Button onClick={handleKybLookup} disabled={kybLoading || !rcInput.trim()} data-testid="button-kyb-lookup">
                    {kybLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-1.5 hidden sm:inline">Lookup</span>
                  </Button>
                </div>
              </div>

              {/* Network/service error — allow manual entry fallback */}
              {kybError && (
                <>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{kybError}</AlertDescription>
                  </Alert>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      You can still continue — fill in your company details manually on the next step. Our team will verify them against the CAC registry during the review process.
                    </AlertDescription>
                  </Alert>
                </>
              )}

              {/* KYB Result */}
              {kybResult && (
                <div className={`rounded-lg border p-4 space-y-2 ${kybResult.found ? "border-green-500/40 bg-green-500/5" : kybGenuineNotFound ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"}`}>
                  {kybResult.found ? (
                    <>
                      <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Company found in CAC registry
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mt-2">
                        {kybResult.companyName && <><span className="text-muted-foreground">Name:</span><span className="font-medium">{kybResult.companyName}</span></>}
                        {kybResult.rcNumber && <><span className="text-muted-foreground">RC:</span><span className="font-medium">{kybResult.rcNumber}</span></>}
                        {kybResult.companyType && <><span className="text-muted-foreground">Type:</span><span>{kybResult.companyType}</span></>}
                        {kybResult.registrationDate && <><span className="text-muted-foreground">Reg. Date:</span><span>{kybResult.registrationDate}</span></>}
                        {kybResult.status && <><span className="text-muted-foreground">Status:</span><Badge variant="outline" className="text-xs">{kybResult.status}</Badge></>}
                        {kybResult.directors && kybResult.directors.length > 0 && (
                          <><span className="text-muted-foreground">Directors:</span><span>{kybResult.directors.map(d => d.name).join(", ")}</span></>
                        )}
                      </div>
                    </>
                  ) : kybGenuineNotFound ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        Company not found in the CAC registry
                      </div>
                      <p className="text-sm text-muted-foreground">
                        We could not find a company with RC number <strong>{rcInput}</strong> in the CAC database.
                        Please double-check the RC number and try again. If you believe this is an error, contact{" "}
                        <a href="mailto:support@cellionone.com" className="underline text-primary">support@cellionone.com</a>.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4" />
                        CAC registry lookup service is temporarily unavailable
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Please try again in a few minutes, or continue to fill in your details manually. If this issue persists, contact{" "}
                        <a href="mailto:support@cellionone.com" className="underline text-primary">support@cellionone.com</a>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div />
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1} data-testid="button-step1-next">
                  {kybServiceError ? "Continue (manual entry)" : "Continue"}
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 2: Confirm Details ── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Confirm Company Details</CardTitle>
              <CardDescription>
                {kybResult?.found
                  ? "Fields marked with a lock are sourced from the CAC registry and cannot be edited. Complete the remaining fields."
                  : "Fill in your company details. Our team will verify them against the CAC registry."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {kybResult?.found && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Company verified in the CAC registry. Key details are locked for accuracy.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Registered Company Name *</Label>
                  {kybResult?.found ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="display-company-name">
                      <span className="flex-1 font-medium">{companyName}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">CAC Verified</Badge>
                    </div>
                  ) : (
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Full legal name" data-testid="input-company-name" />
                  )}
                </div>
                <div>
                  <Label>RC Number *</Label>
                  {kybResult?.found ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="display-rc-number">
                      <span className="flex-1">{rcInput || kybResult?.rcNumber}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">CAC Verified</Badge>
                    </div>
                  ) : (
                    <Input value={rcInput} onChange={e => { setRcInput(e.target.value); setKybResult(null); }} placeholder="RC1234567" data-testid="input-rc-number-step2" />
                  )}
                </div>
                <div>
                  <Label>Company Type</Label>
                  {kybResult?.found ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="display-company-type">
                      <span className="flex-1">{companyType}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">CAC Verified</Badge>
                    </div>
                  ) : (
                    <Select value={companyType} onValueChange={setCompanyType}>
                      <SelectTrigger data-testid="select-company-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LTD">Private Limited (LTD)</SelectItem>
                        <SelectItem value="PLC">Public Limited (PLC)</SelectItem>
                        <SelectItem value="LLP">Limited Liability Partnership</SelectItem>
                        <SelectItem value="Sole_Proprietorship">Business Name</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Incorporation Date</Label>
                  {kybResult?.found && incorporationDate ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="display-inc-date">
                      <span className="flex-1">{incorporationDate}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">CAC Verified</Badge>
                    </div>
                  ) : (
                    <Input type="date" value={incorporationDate} onChange={e => setIncorporationDate(e.target.value)} data-testid="input-inc-date" />
                  )}
                </div>
                <div>
                  <Label>TIN Number</Label>
                  <Input value={tinNumber} onChange={e => setTinNumber(e.target.value)} placeholder="e.g. 12345678-0001" data-testid="input-tin" />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    We will automatically verify your TIN with FIRS after you submit
                  </p>
                </div>
                <div>
                  <Label>Share Capital</Label>
                  {kybResult?.found && kybResult?.shareCapital ? (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="display-share-capital">
                      <span className="flex-1">{shareCapital}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">CAC Verified</Badge>
                    </div>
                  ) : (
                    <Input value={shareCapital} onChange={e => setShareCapital(e.target.value)} placeholder="e.g. ₦100,000" data-testid="input-share-capital" />
                  )}
                </div>
              </div>

              <Separator />

              {kybResult?.found && (registeredAddress.line1 || registeredAddress.state) ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Registered Address (CAC)</p>
                  <div className="rounded-md border bg-muted/40 px-3 py-3 space-y-1 text-sm" data-testid="display-registered-address">
                    {registeredAddress.line1 && <p>{registeredAddress.line1}</p>}
                    {registeredAddress.line2 && <p>{registeredAddress.line2}</p>}
                    <p className="text-muted-foreground">
                      {[registeredAddress.city, registeredAddress.state, registeredAddress.postalCode, registeredAddress.country].filter(Boolean).join(", ")}
                    </p>
                    <Badge variant="secondary" className="text-xs mt-1">CAC Verified</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    This address is sourced from the CAC registry. Contact support if it is incorrect.
                  </p>
                </div>
              ) : (
                <AddressForm
                  title="Registered Address (CAC)"
                  value={registeredAddress}
                  onChange={setRegisteredAddress}
                />
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="same-address"
                  checked={sameAddress}
                  onChange={e => {
                    setSameAddress(e.target.checked);
                    if (e.target.checked) setOperatingAddress(registeredAddress);
                  }}
                  className="h-4 w-4 rounded border-input"
                  data-testid="checkbox-same-address"
                />
                <label htmlFor="same-address" className="text-sm">Operating address is the same as registered address</label>
              </div>

              {!sameAddress && (
                <AddressForm
                  title="Operating Address *"
                  value={operatingAddress}
                  onChange={setOperatingAddress}
                />
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)} data-testid="button-step2-back">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2} data-testid="button-step2-next">
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: Directors ── */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Directors & Officers</CardTitle>
              <CardDescription>
                Individual directors require a BVN or NIN for automated identity verification. Corporate entities (companies, trusts) require an RC Number instead.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Identity verification is required for all entries.</span> Individual directors need a BVN or NIN; corporate entities need an RC Number. After submission, we automatically verify identities and run AML/sanctions checks.
                </AlertDescription>
              </Alert>

              {directors.length > 0 && (
                <div className="space-y-3">
                  {directors.map((d, i) => {
                    const isCorp = d.entityType === "corporate";
                    const hasId = isCorp ? !!d.rcNumber?.trim() : (d.bvn.trim() || d.nin.trim());
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${!hasId ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {isCorp ? <Building2 className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{d.name}</p>
                            {isCorp && <Badge variant="secondary" className="text-xs">Corporate</Badge>}
                            <Badge variant="outline" className="text-xs">{d.role}</Badge>
                            {d.classification === "director_shareholder" && <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0">Director & Shareholder</Badge>}
                            {d.classification === "shareholder" && <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-0">Shareholder only</Badge>}
                            {isCorp && d.verified && (
                              <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0 flex items-center gap-1" data-testid={`badge-verified-director-${i}`}>
                                <CheckCircle2 className="h-3 w-3" />
                                Verified
                              </Badge>
                            )}
                            {!hasId && <Badge variant="secondary" className="text-xs text-amber-700 bg-amber-100 dark:bg-amber-900 dark:text-amber-300">{isCorp ? "RC Number required" : "BVN or NIN required"}</Badge>}
                          </div>
                          {isCorp ? (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="col-span-2 sm:col-span-1">
                                <Label className="text-xs">RC Number *</Label>
                                <Input
                                  className="h-7 text-xs"
                                  value={d.rcNumber || ""}
                                  onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, rcNumber: e.target.value } : dir))}
                                  placeholder="e.g. RC123456"
                                  data-testid={`input-director-rc-${i}`}
                                />
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                <Label className="text-xs">Authorised Rep Email</Label>
                                <Input
                                  className="h-7 text-xs"
                                  value={d.email}
                                  onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, email: e.target.value } : dir))}
                                  placeholder="rep@company.com"
                                  data-testid={`input-director-email-${i}`}
                                />
                              </div>
                              {!hasId && <p className="text-xs text-amber-700 dark:text-amber-400 col-span-2 mt-0.5">Enter the corporate entity's RC Number to continue.</p>}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="col-span-2 sm:col-span-1">
                                <Label className="text-xs">Email (for biometric invite)</Label>
                                <Input
                                  className="h-7 text-xs"
                                  value={d.email}
                                  onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, email: e.target.value } : dir))}
                                  placeholder="director@company.com"
                                  data-testid={`input-director-email-${i}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">BVN <span className="text-muted-foreground font-normal">(or NIN — one required)</span></Label>
                                <Input
                                  className="h-7 text-xs"
                                  value={d.bvn}
                                  onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, bvn: e.target.value } : dir))}
                                  placeholder="11-digit BVN"
                                  data-testid={`input-director-bvn-${i}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">NIN <span className="text-muted-foreground font-normal">(or BVN — one required)</span></Label>
                                <Input
                                  className="h-7 text-xs"
                                  value={d.nin}
                                  onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, nin: e.target.value } : dir))}
                                  placeholder="11-digit NIN"
                                  data-testid={`input-director-nin-${i}`}
                                />
                              </div>
                              {!hasId && <p className="text-xs text-amber-700 dark:text-amber-400 col-span-2 mt-0.5">Enter at least a BVN or NIN for this director to continue.</p>}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDirectors(prev => prev.filter((_, idx) => idx !== i))} data-testid={`button-remove-director-${i}`}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Add Director / Officer</p>
                <div className="flex items-center gap-1 rounded-md border p-0.5 bg-muted/40" data-testid="toggle-dir-type">
                  <button
                    type="button"
                    onClick={() => { setNewDirType("individual"); setNewDir(prev => ({ ...prev, entityType: "individual" })); }}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${newDirType === "individual" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="toggle-individual-dir"
                  >
                    <User className="h-3 w-3 inline mr-1" />Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewDirType("corporate"); setNewDir(prev => ({ ...prev, entityType: "corporate" })); }}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${newDirType === "corporate" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="toggle-corporate-dir"
                  >
                    <Building2 className="h-3 w-3 inline mr-1" />Corporate
                  </button>
                </div>
              </div>

              {newDirType === "corporate" && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Corporate entities (companies or trusts) are verified against the CAC registry as part of the free verification process. BVN/NIN is not required — use the entity's RC Number instead.</span>
                </div>
              )}

              {newDirType === "individual" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Full Name *</Label>
                    <Input value={newDir.name} onChange={e => setNewDir(prev => ({ ...prev, name: e.target.value }))} placeholder="Full legal name" data-testid="input-new-director-name" />
                  </div>
                  <div>
                    <Label>Role / Title</Label>
                    <Select value={newDir.role} onValueChange={v => setNewDir(prev => ({ ...prev, role: v }))}>
                      <SelectTrigger data-testid="select-new-director-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="CEO">CEO / MD</SelectItem>
                        <SelectItem value="Secretary">Company Secretary</SelectItem>
                        <SelectItem value="Shareholder">Shareholder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Classification <span className="text-muted-foreground font-normal text-xs">(used for dossier & bank reporting)</span></Label>
                    <Select value={newDir.classification} onValueChange={v => setNewDir(prev => ({ ...prev, classification: v as DirectorEntry["classification"] }))}>
                      <SelectTrigger data-testid="select-new-director-classification"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="director">Director only</SelectItem>
                        <SelectItem value="shareholder">Shareholder only</SelectItem>
                        <SelectItem value="director_shareholder">Director & Shareholder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Email (for biometric invite)</Label>
                    <Input type="email" value={newDir.email} onChange={e => setNewDir(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" data-testid="input-new-director-email" />
                  </div>
                  <div>
                    <Label>BVN <span className="text-muted-foreground font-normal text-xs">(or NIN — one required)</span></Label>
                    <Input value={newDir.bvn} onChange={e => setNewDir(prev => ({ ...prev, bvn: e.target.value }))} placeholder="11-digit BVN" data-testid="input-new-director-bvn" />
                  </div>
                  <div>
                    <Label>NIN <span className="text-muted-foreground font-normal text-xs">(or BVN — one required)</span></Label>
                    <Input value={newDir.nin} onChange={e => setNewDir(prev => ({ ...prev, nin: e.target.value }))} placeholder="11-digit NIN" data-testid="input-new-director-nin" />
                  </div>
                  {newDir.name.trim() && !newDir.bvn.trim() && !newDir.nin.trim() && (
                    <p className="sm:col-span-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Enter at least a BVN or NIN before adding this director.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Registered Company Name *</Label>
                    <Input value={newDir.name} onChange={e => setNewDir(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Acme Holdings Ltd" data-testid="input-new-director-name" />
                  </div>
                  <div>
                    <Label>Entity Type</Label>
                    <Select value={newDir.corporateBusinessType || "co"} onValueChange={v => setNewDir(prev => ({ ...prev, corporateBusinessType: v as "co" | "bn" }))}>
                      <SelectTrigger data-testid="select-new-director-biz-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="co">Limited Company (RC)</SelectItem>
                        <SelectItem value="bn">Business Name (BN)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>RC / BN Number *</Label>
                    <Input value={newDir.rcNumber || ""} onChange={e => setNewDir(prev => ({ ...prev, rcNumber: e.target.value }))} placeholder={newDir.corporateBusinessType === "bn" ? "e.g. BN123456" : "e.g. RC123456"} data-testid="input-new-director-rc" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={newDir.role} onValueChange={v => setNewDir(prev => ({ ...prev, role: v }))}>
                      <SelectTrigger data-testid="select-new-director-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="Shareholder">Shareholder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Classification</Label>
                    <Select value={newDir.classification} onValueChange={v => setNewDir(prev => ({ ...prev, classification: v as DirectorEntry["classification"] }))}>
                      <SelectTrigger data-testid="select-new-director-classification"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="director">Director only</SelectItem>
                        <SelectItem value="shareholder">Shareholder only</SelectItem>
                        <SelectItem value="director_shareholder">Director & Shareholder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Authorised Representative Name</Label>
                    <Input value={newDir.authorisedRepName || ""} onChange={e => setNewDir(prev => ({ ...prev, authorisedRepName: e.target.value }))} placeholder="e.g. Ada Nwosu" data-testid="input-new-director-rep-name" />
                  </div>
                  <div>
                    <Label>Authorised Representative Email</Label>
                    <Input type="email" value={newDir.email} onChange={e => setNewDir(prev => ({ ...prev, email: e.target.value }))} placeholder="rep@company.com" data-testid="input-new-director-email" />
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                disabled={
                  newDirType === "corporate"
                    ? !newDir.name.trim() || !newDir.rcNumber?.trim()
                    : !newDir.name.trim() || (!newDir.bvn.trim() && !newDir.nin.trim())
                }
                onClick={() => {
                  const entry: DirectorEntry = { ...newDir, entityType: newDirType };
                  setDirectors(prev => [...prev, entry]);
                  setNewDir({ entityType: newDirType, name: "", role: "Director", classification: "director", email: "", bvn: "", nin: "", rcNumber: "", authorisedRepName: "", countryOfIncorporation: "Nigeria", corporateBusinessType: "co" });
                }}
                data-testid="button-add-director"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {newDirType === "corporate" ? "Add Corporate Entity" : "Add Director"}
              </Button>

              {directors.length === 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>At least one director must be added to continue.</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} data-testid="button-step3-back">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={handleEnterDocStep}
                  disabled={createProfileMutation.isPending || !canProceedStep3}
                  data-testid="button-step3-next"
                >
                  {createProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 4: Documents ── */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Upload Company Documents</CardTitle>
              <CardDescription>
                All documents are optional at this stage. They are stored in your secure Cellion vault for bank account opening and future legal transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">No documents required to proceed.</span> Your company will be verified automatically using KYB, TIN, and director identity checks. Documents uploaded here go into your secure vault and may be requested by banks or government agencies.
                </AlertDescription>
              </Alert>

              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} data-testid="input-file-upload" />

              {VAULT_DOCS.map((doc) => {
                const uploaded = uploadedDocs.find(d => d.key === doc.key);
                const isUploading = uploadingDoc === doc.key;
                return (
                  <div key={doc.key} className={`flex items-center justify-between rounded-lg border p-3 gap-3 ${uploaded ? "border-green-500/40 bg-green-500/5" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${uploaded ? "bg-green-500/10" : "bg-muted"}`}>
                        {uploaded ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.label}</p>
                        {uploaded && <p className="text-xs text-muted-foreground truncate">{uploaded.fileName}</p>}
                      </div>
                    </div>
                    <Button
                      variant={uploaded ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => handleFileSelect(doc.key)}
                      disabled={isUploading}
                      className="shrink-0"
                      data-testid={`button-upload-${doc.key}`}
                    >
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      <span className="ml-1.5">{uploaded ? "Replace" : "Upload"}</span>
                    </Button>
                  </div>
                );
              })}

              <p className="text-xs text-muted-foreground">Accepted formats: PDF, JPEG, PNG, DOC, DOCX (max 10 MB each). Documents are encrypted at rest.</p>

              {uploadedKeys.size > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{uploadedKeys.size} of {VAULT_DOCS.length} documents uploaded to your vault</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)} data-testid="button-step4-back">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <div className="flex gap-2">
                  {uploadedKeys.size === 0 && (
                    <Button variant="ghost" onClick={() => setStep(5)} data-testid="button-step4-skip">
                      Skip for now — upload from profile later
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}
                  <Button onClick={() => setStep(5)} data-testid="button-step4-next">
                    {uploadedKeys.size > 0 ? "Continue" : "Continue without documents"}
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 5: Submit & Verify ── */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 5: Submit Application</CardTitle>
              <CardDescription>Review and submit your application. Verification is completely free.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Free verification banner */}
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">No payment required</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                    Verification for existing Nigerian companies is fully covered by Cellion One. Submit your application and our automated pipeline will verify your company at no cost.
                  </p>
                </div>
              </div>

              {/* What gets verified */}
              <div className="rounded-lg border divide-y">
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">CAC Registry (KYB)</p>
                    <p className="text-xs text-muted-foreground">Company found, active, name and RC number match</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400">Free</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">TIN Verification (FIRS)</p>
                    <p className="text-xs text-muted-foreground">Tax Identification Number cross-checked if provided</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400">Free</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Director Identity & AML Checks</p>
                    <p className="text-xs text-muted-foreground">BVN/NIN verification + sanctions/PEP screening for all directors</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400">Free</span>
                </div>
              </div>

              {/* What happens next */}
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">What happens after you submit</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Automated KYB cross-check with the live CAC registry</li>
                  <li>Automated TIN verification with FIRS (if TIN provided)</li>
                  <li>Director BVN/NIN identity checks + AML/sanctions screening</li>
                  <li>If all checks pass — company is instantly marked Verified</li>
                  <li>If any check requires review — our compliance team contacts you within 1 business day</li>
                </ol>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(4)} data-testid="button-step5-back">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending || checkoutMutation.isSuccess}
                  data-testid="button-submit-application"
                >
                  {checkoutMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Submitting…</>
                    : checkoutMutation.isSuccess
                    ? <><CheckCircle className="h-4 w-4 mr-1.5" />Submitted</>
                    : <><CheckCircle className="h-4 w-4 mr-1.5" />Submit Application — Free</>
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
