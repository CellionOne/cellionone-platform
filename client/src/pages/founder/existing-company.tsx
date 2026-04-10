import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  ArrowRight,
  ArrowLeft,
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
  ExternalLink,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const VERIFICATION_FEE_NGN = 25000;
const DIRECTOR_VERIFY_FEE_NGN = 10000;

const STEPS = [
  { id: 1, title: "RC Lookup", description: "Find your company in the CAC registry" },
  { id: 2, title: "Confirm Details", description: "Review and complete your company information" },
  { id: 3, title: "Directors", description: "Confirm director information" },
  { id: 4, title: "Documents", description: "Upload required company documents" },
  { id: 5, title: "Payment", description: "Complete payment to submit for verification" },
];

const REQUIRED_DOCS: { key: string; label: string; mandatory: boolean }[] = [
  { key: "coi", label: "Certificate of Incorporation (CAC CO2)", mandatory: true },
  { key: "memat", label: "Memorandum & Articles of Association (MEMAT)", mandatory: true },
  { key: "cac_status", label: "CAC Status Report (current)", mandatory: true },
  { key: "tin_cert", label: "TIN Certificate", mandatory: true },
  { key: "proof_address", label: "Proof of Operating Address", mandatory: true },
  { key: "director_id", label: "Director Government-Issued ID (at least one)", mandatory: true },
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
  shareCapital?: string;
  tinNumber?: string;
  directors?: { name: string; role?: string }[];
  smileJobId?: string;
  error?: string;
}

interface DirectorEntry {
  name: string;
  role: string;
  email: string;
  bvn: string;
  nin: string;
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

export default function ExistingCompanyPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [rcInput, setRcInput] = useState("");
  const [kybResult, setKybResult] = useState<KybResult | null>(null);
  const [kybLoading, setKybLoading] = useState(false);
  const [kybError, setKybError] = useState<string | null>(null);

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
  const [newDir, setNewDir] = useState<DirectorEntry>({ name: "", role: "Director", email: "", bvn: "", nin: "" });

  // Step 4 documents
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [createdProfileId, setCreatedProfileId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null);

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
      const res = await apiRequest("POST", "/api/founder/existing-company/kyb-lookup", { rcNumber: rcInput.trim() });
      const data: KybResult = await res.json();
      setKybResult(data);
      if (data.found) {
        setCompanyName(data.companyName || "");
        setCompanyType(data.companyType || "LTD");
        setIncorporationDate(data.registrationDate || "");
        setShareCapital(data.shareCapital || "");
        setTinNumber(data.tinNumber || "");
        if (data.address) {
          setRegisteredAddress(prev => ({ ...prev, line1: data.address || "" }));
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
        businessActivities: [],
      };
      const res = await apiRequest("POST", "/api/founder/company-profiles/existing", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to create profile" }));
        throw new Error(err.message);
      }
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (profile) => {
      setCreatedProfileId(profile.id);
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
    if (!file || !activeDocKey || !createdProfileId) return;

    setUploadingDoc(activeDocKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docKey", activeDocKey);

      const res = await fetch(`/api/founder/company-profiles/${createdProfileId}/documents/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errData.message);
      }

      setUploadedDocs(prev => {
        const filtered = prev.filter(d => d.key !== activeDocKey);
        return [...filtered, { key: activeDocKey!, fileName: file.name }];
      });
      const docLabel = REQUIRED_DOCS.find(d => d.key === activeDocKey)?.label || activeDocKey;
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

  // ── Checkout (Step 5) — Paystack redirect ─────────────────────────────────

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!createdProfileId) throw new Error("No company profile found");
      const res = await apiRequest("POST", `/api/founder/company-profiles/${createdProfileId}/checkout`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Checkout failed" }));
        throw new Error(err.message);
      }
      return res.json() as Promise<{ authorizationUrl: string; reference: string; orderId: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/company-profiles"] });
      window.location.href = data.authorizationUrl;
    },
    onError: (err: Error) => {
      toast({ title: "Checkout failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  // ── Step Validation ──────────────────────────────────────────────────────────

  const canProceedStep2 = companyName.trim().length >= 2 && (rcInput.trim() || kybResult?.rcNumber || "").length >= 2 && operatingAddress.line1.trim() && operatingAddress.city.trim() && operatingAddress.state.trim();
  const uploadedKeys = new Set(uploadedDocs.map(d => d.key));
  const mandatoryDocs = REQUIRED_DOCS.filter(d => d.mandatory);
  const allMandatoryUploaded = mandatoryDocs.every(d => uploadedKeys.has(d.key));
  const verifiableDirectors = directors.filter(d => d.bvn || d.nin);
  const totalFee = VERIFICATION_FEE_NGN + verifiableDirectors.length * DIRECTOR_VERIFY_FEE_NGN;

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
                <Label htmlFor="rc-number">CAC RC Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="rc-number"
                    value={rcInput}
                    onChange={e => setRcInput(e.target.value)}
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
              <CardDescription>Review and complete your company information. Fields pre-filled from the CAC registry can be edited.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Registered Company Name *</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Full legal name" data-testid="input-company-name" />
                </div>
                <div>
                  <Label>RC Number *</Label>
                  <Input value={rcInput} onChange={e => setRcInput(e.target.value)} placeholder="RC1234567" data-testid="input-rc-number-step2" />
                </div>
                <div>
                  <Label>Company Type</Label>
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
                </div>
                <div>
                  <Label>Incorporation Date</Label>
                  <Input type="date" value={incorporationDate} onChange={e => setIncorporationDate(e.target.value)} data-testid="input-inc-date" />
                </div>
                <div>
                  <Label>TIN Number</Label>
                  <Input value={tinNumber} onChange={e => setTinNumber(e.target.value)} placeholder="e.g. 12345678-0001" data-testid="input-tin" />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    We will verify your TIN against the FIRS database
                  </p>
                </div>
                <div>
                  <Label>Share Capital</Label>
                  <Input value={shareCapital} onChange={e => setShareCapital(e.target.value)} placeholder="e.g. ₦100,000" data-testid="input-share-capital" />
                </div>
              </div>

              <Separator />

              <AddressForm
                title="Registered Address (CAC)"
                value={registeredAddress}
                onChange={setRegisteredAddress}
              />

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
                {directors.length > 0 && kybResult?.found
                  ? "These directors were pre-filled from the CAC registry. Add BVN for each director you want to verify on Cellion One."
                  : "Add the directors and officers of your company."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {directors.length > 0 && (
                <div className="space-y-3">
                  {directors.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{d.name}</p>
                          <Badge variant="outline" className="text-xs">{d.role}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="col-span-2 sm:col-span-1">
                            <Label className="text-xs">Email</Label>
                            <Input
                              className="h-7 text-xs"
                              value={d.email}
                              onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, email: e.target.value } : dir))}
                              placeholder="director@company.com"
                              data-testid={`input-director-email-${i}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">BVN (optional)</Label>
                            <Input
                              className="h-7 text-xs"
                              value={d.bvn}
                              onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, bvn: e.target.value } : dir))}
                              placeholder="11-digit BVN"
                              data-testid={`input-director-bvn-${i}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">NIN (optional)</Label>
                            <Input
                              className="h-7 text-xs"
                              value={d.nin}
                              onChange={e => setDirectors(prev => prev.map((dir, idx) => idx === i ? { ...dir, nin: e.target.value } : dir))}
                              placeholder="11-digit NIN"
                              data-testid={`input-director-nin-${i}`}
                            />
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDirectors(prev => prev.filter((_, idx) => idx !== i))} data-testid={`button-remove-director-${i}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />
              <p className="text-sm font-medium">Add Director / Officer</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={newDir.name} onChange={e => setNewDir(prev => ({ ...prev, name: e.target.value }))} placeholder="Full legal name" data-testid="input-new-director-name" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={newDir.role} onValueChange={v => setNewDir(prev => ({ ...prev, role: v }))}>
                    <SelectTrigger data-testid="select-new-director-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Director">Director</SelectItem>
                      <SelectItem value="CEO">CEO / MD</SelectItem>
                      <SelectItem value="Secretary">Company Secretary</SelectItem>
                      <SelectItem value="Shareholder">Shareholder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={newDir.email} onChange={e => setNewDir(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" data-testid="input-new-director-email" />
                </div>
                <div>
                  <Label>BVN (optional)</Label>
                  <Input value={newDir.bvn} onChange={e => setNewDir(prev => ({ ...prev, bvn: e.target.value }))} placeholder="11-digit BVN" data-testid="input-new-director-bvn" />
                </div>
                <div>
                  <Label>NIN (optional)</Label>
                  <Input value={newDir.nin} onChange={e => setNewDir(prev => ({ ...prev, nin: e.target.value }))} placeholder="11-digit NIN" data-testid="input-new-director-nin" />
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => {
                if (!newDir.name.trim()) return;
                setDirectors(prev => [...prev, { ...newDir }]);
                setNewDir({ name: "", role: "Director", email: "", bvn: "", nin: "" });
              }} data-testid="button-add-director">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Director
              </Button>

              {verifiableDirectors.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {verifiableDirectors.length} director{verifiableDirectors.length > 1 ? "s" : ""} with BVN will be verified as part of your submission — ₦{DIRECTOR_VERIFY_FEE_NGN.toLocaleString()} per person.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)} data-testid="button-step3-back">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={handleEnterDocStep}
                  disabled={createProfileMutation.isPending}
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
                Upload the required documents. The first four are mandatory before proceeding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} data-testid="input-file-upload" />

              {REQUIRED_DOCS.map((doc) => {
                const uploaded = uploadedDocs.find(d => d.key === doc.key);
                const isUploading = uploadingDoc === doc.key;
                return (
                  <div key={doc.key} className={`flex items-center justify-between rounded-lg border p-3 gap-3 ${uploaded ? "border-green-500/40 bg-green-500/5" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${uploaded ? "bg-green-500/10" : "bg-muted"}`}>
                        {uploaded ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.label}
                          {doc.mandatory && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        {uploaded && <p className="text-xs text-muted-foreground truncate">{uploaded.fileName}</p>}
                      </div>
                    </div>
                    <Button
                      variant={uploaded ? "outline" : "default"}
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

              <p className="text-xs text-muted-foreground">Accepted formats: PDF, JPEG, PNG, DOC, DOCX (max 10 MB each)</p>

              {!allMandatoryUploaded && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Documents marked with <span className="text-red-500 font-medium">*</span> are required before you can proceed.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)} data-testid="button-step4-back">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button onClick={() => setStep(5)} disabled={!allMandatoryUploaded} data-testid="button-step4-next">
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 5: Payment & Submit ── */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 5: Payment</CardTitle>
              <CardDescription>Review the fee summary then complete payment via Paystack to submit for verification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border divide-y">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Existing Company Verification</p>
                    <p className="text-xs text-muted-foreground">KYB check, TIN lookup & legal team document review</p>
                  </div>
                  <p className="font-semibold">₦{VERIFICATION_FEE_NGN.toLocaleString()}</p>
                </div>
                {verifiableDirectors.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">Director Identity Verification</p>
                      <p className="text-xs text-muted-foreground">{verifiableDirectors.length} director{verifiableDirectors.length > 1 ? "s" : ""} with BVN × ₦{DIRECTOR_VERIFY_FEE_NGN.toLocaleString()}</p>
                    </div>
                    <p className="font-semibold">₦{(verifiableDirectors.length * DIRECTOR_VERIFY_FEE_NGN).toLocaleString()}</p>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                  <p className="font-semibold">Total</p>
                  <p className="font-bold text-lg">₦{totalFee.toLocaleString()}</p>
                </div>
              </div>

              <Alert>
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  You will be redirected to Paystack to complete payment securely. Once confirmed, our legal team will review your documents and verify your company within 1–2 business days.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">What happens next</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>You complete payment on Paystack's secure page</li>
                  <li>Payment is confirmed and your company enters our review queue</li>
                  <li>We cross-check your details against the CAC registry</li>
                  <li>Our legal team reviews your uploaded documents</li>
                  <li>You receive an email once verified — post-inc services unlock immediately</li>
                </ol>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(4)} data-testid="button-step5-back">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back
                </Button>
                <Button
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-pay-now"
                >
                  {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ExternalLink className="h-4 w-4 mr-1.5" />}
                  Pay ₦{totalFee.toLocaleString()} via Paystack
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
