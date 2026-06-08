import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { saveDraft, getDraft, deleteDraft, isOnline, onOnlineStatusChange, type ApplicationDraft } from "@/lib/offline-storage";
import type { CompanyApplication, CompanyPerson } from "@shared/schema";
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Wifi,
  WifiOff,
  Save,
  MapPin,
  Mail,
  Shield,
  Users,
  UserPlus,
  Trash2,
  Info,
} from "lucide-react";

const steps = [
  { id: 1, title: "Company Type", description: "Choose your company structure" },
  { id: 2, title: "Company Names", description: "Propose up to 3 name options" },
  { id: 3, title: "Business Details", description: "Describe your business activities" },
  { id: 4, title: "Directors & Shareholders", description: "Declare your team members" },
  { id: 5, title: "Address", description: "Registered office address" },
  { id: 6, title: "Company Secretary", description: "Appoint or invite a company secretary" },
];

interface DirectorEntry {
  localId: string;
  personId?: number;
  personType: "individual" | "corporate";
  fullName: string;
  inviteEmail: string;
  role: string;
  sharesAllocated: string;
  shareClass: string;
  sharePercentage: string;
  corporateName?: string;
  corporateRcNumber?: string;
  corporateCountry?: string;
  authorisedRepName?: string;
}

const companyTypes = [
  { value: "LTD", label: "Private Limited Company (LTD)", description: "Most common for small to medium businesses" },
  { value: "SMC", label: "Single Member Company (SMC)", description: "For solo founders — one shareholder, full limited liability" },
  { value: "PLC", label: "Public Limited Company (PLC)", description: "For companies planning to go public" },
  { value: "LLP", label: "Limited Liability Partnership (LLP)", description: "For professional service firms" },
  { value: "Sole_Proprietorship", label: "Business Name (Sole Proprietorship)", description: "For individual business owners" },
];

// E2: Regulated industry keywords — CAC requires additional licences/approvals
const REGULATED_KEYWORDS = [
  "bank", "banking", "microfinance", "mortgage", "finance", "financial", "investment",
  "insurance", "assurance", "pension", "capital market", "stockbroker", "asset management",
  "telecoms", "telecom", "telecommunications", "wireless", "spectrum",
  "petroleum", "oil", "gas", "downstream", "upstream",
  "pharmaceutical", "pharmacy", "drug", "hospital", "healthcare", "medical",
  "aviation", "airline", "airport",
  "casino", "gaming", "lottery", "betting",
  "mining", "solid mineral",
];

// E3: Restricted/reserved words in company names per CAC regulations
const RESTRICTED_NAME_WORDS = [
  "federal", "national", "government", "state", "municipal", "royal", "imperial",
  "central", "cooperative society", "building society",
  "bank", "banking", "savings and loan", "mortgage",
  "insurance", "assurance", "re-insurance",
  "trust", "trustee",
  "stock exchange", "securities",
  "chartered", "institute", "council", "commission", "authority",
  "nigeria", "nigerian",
];

const nigerianStates = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara"
];

const countries = [
  "Nigeria",
  "Ghana", "Kenya", "South Africa", "Ethiopia", "Egypt", "Tanzania", "Uganda", "Rwanda", "Senegal",
  "Cameroon", "Côte d'Ivoire", "Angola", "Mozambique", "Zambia", "Zimbabwe", "Botswana", "Namibia",
  "United Kingdom", "United States", "Canada", "Australia", "Germany", "France", "Netherlands",
  "United Arab Emirates", "Saudi Arabia", "India", "China", "Singapore", "Malaysia",
  "Other country…",
];

const shareClassInfo: Record<string, { label: string; description: string }> = {
  ordinary: {
    label: "Ordinary",
    description: "Standard voting shares — the most common type in Nigerian companies. Each share carries one vote and participates equally in dividends and capital.",
  },
  preference: {
    label: "Preference",
    description: "Preference shares carry a fixed dividend paid before ordinary shareholders receive anything. They usually have limited or no voting rights and are suited to investors who want predictable returns.",
  },
  redeemable: {
    label: "Redeemable",
    description: "Redeemable shares can be bought back by the company at an agreed price or date, giving the company flexibility to return capital to the holder or restructure ownership.",
  },
};

const DRAFT_ID = "new-application-draft";

export default function NewApplicationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [online, setOnline] = useState(isOnline());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [directors, setDirectors] = useState<DirectorEntry[]>([]);
  // D2/D3: PSC and capital declarations — keyed by director localId
  const [pscDeclarations, setPscDeclarations] = useState<Record<string, boolean>>({});
  const [capitalDeclarations, setCapitalDeclarations] = useState<Record<string, boolean>>({});
  // F1: Company Secretary step
  const [secretaryMode, setSecretaryMode] = useState<"skip" | "appoint" | "invite">("skip");
  const [secretaryName, setSecretaryName] = useState("");
  const [secretaryEmail, setSecretaryEmail] = useState("");
  const [newDirector, setNewDirector] = useState<Omit<DirectorEntry, "localId">>({
    personType: "individual",
    fullName: "",
    inviteEmail: "",
    role: "director",
    sharesAllocated: "",
    shareClass: "ordinary",
    sharePercentage: "",
    corporateName: "",
    corporateRcNumber: "",
    corporateCountry: "Nigeria",
    authorisedRepName: "",
  });
  const [formData, setFormData] = useState({
    applicationType: "incorporation",
    companyType: "",
    companyName1: "",
    companyName2: "",
    companyName3: "",
    businessDescription: "",
    registeredAddress: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Nigeria",
    },
    operatingAddress: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Nigeria",
    },
    useRegisteredOffice: false,
    registeredOfficeTier: "" as "" | "office_only" | "office_plus_mail",
  });
  const [useCustomCountry, setUseCustomCountry] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [draftApplicationId, setDraftApplicationId] = useState<number | null>(null);
  const [sameAsRegistered, setSameAsRegistered] = useState(false);
  const [nameCheckSubmitted, setNameCheckSubmitted] = useState(false);
  const [submittedNameCheckAppId, setSubmittedNameCheckAppId] = useState<number | null>(null);
  const [resumeApplicationId, setResumeApplicationId] = useState<number | null>(null);
  const [resumeSelectedNames, setResumeSelectedNames] = useState<string[]>([]);

  // Fetch registered office options
  const { data: registeredOfficeOptions } = useQuery<{
    tiers: { id: string; name: string; priceNgn: number; description: string; features: string[] }[];
    location: { label: string; city: string; state: string; country: string };
    policyText: string;
    termMonths: number;
  }>({
    queryKey: ["/api/registered-office/options"],
  });

  // On mount (no ?draft param): read wizard-draft-id from localStorage so that
  // a subsequent Save & Exit will patch the existing draft rather than creating a duplicate.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("draft")) return; // will be handled by the effect below
    const storedId = localStorage.getItem("wizard-draft-id");
    if (!storedId) return;
    const id = parseInt(storedId);
    if (!isNaN(id)) setDraftApplicationId(id);
  }, []);

  // Load draft from server if ?draft=<id> is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftParam = params.get("draft");
    if (!draftParam) return;
    const id = parseInt(draftParam);
    if (isNaN(id)) return;
    setDraftApplicationId(id);

    Promise.all([
      apiRequest("GET", `/api/applications/${id}`).then(r => r.json()),
      apiRequest("GET", `/api/company-people`).then(r => r.json()),
    ])
      .then(([envelope, allPeople]: [{ application: CompanyApplication } | CompanyApplication, CompanyPerson[]]) => {
        // GET /api/applications/:id returns { application, checklist, people, ... }
        const app: CompanyApplication = "application" in envelope ? envelope.application : envelope;
        setFormData(prev => ({
          ...prev,
          applicationType: app.applicationType || prev.applicationType,
          companyType: app.companyType || prev.companyType,
          companyName1: app.companyName1 || prev.companyName1,
          companyName2: app.companyName2 || prev.companyName2,
          companyName3: app.companyName3 || prev.companyName3,
          businessDescription: app.businessDescription || prev.businessDescription,
          registeredAddress: (app.registeredAddress as typeof prev.registeredAddress) || prev.registeredAddress,
          operatingAddress: (app.operatingAddress as typeof prev.operatingAddress) || prev.operatingAddress,
        }));

        // Restore directors linked to this draft application
        const draftPeople: CompanyPerson[] = Array.isArray(allPeople)
          ? allPeople.filter((p) => p.applicationId === id)
          : [];
        if (draftPeople.length) {
          setDirectors(draftPeople.map((p) => ({
            localId: crypto.randomUUID(),
            personId: p.id,
            personType: (p.entityType === "corporate" ? "corporate" : "individual") as "individual" | "corporate",
            fullName: p.entityType !== "corporate" ? (p.title || "") : "",
            inviteEmail: p.inviteEmail || "",
            role: p.role || "director",
            sharesAllocated: p.sharesAllocated?.toString() || "",
            shareClass: p.shareClass || "ordinary",
            sharePercentage: p.sharePercentage || "",
            corporateName: p.corporateName || "",
            corporateRcNumber: p.corporateRcNumber || "",
            corporateCountry: p.corporateCountry || "Nigeria",
            authorisedRepName: p.corporateAuthorisedRepName || "",
          })));
        }

        // Restore the wizard step: server-persisted value takes priority over localStorage
        const serverStep = app.wizardStep;
        if (serverStep && serverStep >= 1 && serverStep <= 5) {
          setCurrentStep(serverStep);
        } else {
          // Fall back to localStorage, then infer from data
          const lsStep = localStorage.getItem(`wizard-draft-step-${id}`);
          if (lsStep) {
            const step = parseInt(lsStep);
            if (!isNaN(step) && step >= 1 && step <= 5) setCurrentStep(step);
          } else if (!app.companyType) setCurrentStep(1);
          else if (!app.companyName1) setCurrentStep(2);
          else if (!app.businessDescription) setCurrentStep(3);
          else if (!(app.operatingAddress as Record<string, string> | null)?.line1) setCurrentStep(4);
          else setCurrentStep(5);
        }

        toast({ title: "Draft loaded", description: "Your saved draft has been restored." });
      })
      .catch(() => {
        toast({ title: "Could not load draft", description: "Starting fresh.", variant: "destructive" });
      });
  }, []);

  // Load draft from localStorage on mount — skip when server draft is being loaded via ?draft= or resume mode via ?resume=
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.has("draft") || search.has("resume")) return;
    const savedDraft = getDraft(DRAFT_ID);
    if (savedDraft && savedDraft.data) {
      let restoredAddress = formData.registeredAddress;
      if (savedDraft.data.registeredAddress) {
        try {
          restoredAddress = typeof savedDraft.data.registeredAddress === 'string'
            ? JSON.parse(savedDraft.data.registeredAddress)
            : savedDraft.data.registeredAddress;
        } catch {
          restoredAddress = formData.registeredAddress;
        }
      }
      
      const mergedAddress = { country: "Nigeria", ...restoredAddress };
      const restoredCountry = mergedAddress.country;
      if (restoredCountry && restoredCountry !== "Nigeria" && !countries.includes(restoredCountry)) {
        setUseCustomCountry(true);
      }
      let restoredOperatingAddress = { line1: "", line2: "", city: "", state: "", postalCode: "", country: "Nigeria" };
      if (savedDraft.data.operatingAddress) {
        try {
          restoredOperatingAddress = typeof savedDraft.data.operatingAddress === 'string'
            ? JSON.parse(savedDraft.data.operatingAddress)
            : savedDraft.data.operatingAddress;
        } catch {
          // keep default
        }
      }

      setFormData(prev => ({
        ...prev,
        applicationType: savedDraft.data.applicationType || prev.applicationType,
        companyType: savedDraft.data.companyType || prev.companyType,
        companyName1: savedDraft.data.companyName1 || prev.companyName1,
        companyName2: savedDraft.data.companyName2 || prev.companyName2,
        companyName3: savedDraft.data.companyName3 || prev.companyName3,
        businessDescription: savedDraft.data.businessDescription || prev.businessDescription,
        registeredAddress: mergedAddress,
        operatingAddress: restoredOperatingAddress,
      }));
      setCurrentStep(savedDraft.step);
      toast({
        title: "Draft restored",
        description: "Your previous draft has been loaded.",
      });
    }
  }, []);

  // Load existing application when ?resume=<id> is in the URL (two-phase name availability workflow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resumeParam = params.get("resume");
    if (!resumeParam) return;
    const id = parseInt(resumeParam);
    if (isNaN(id)) return;
    setResumeApplicationId(id);
    setDraftApplicationId(id);

    Promise.all([
      apiRequest("GET", `/api/applications/${id}`).then(r => r.json()),
      apiRequest("GET", `/api/company-people`).then(r => r.json()),
    ])
      .then(([envelope, allPeople]: [{ application: CompanyApplication } | CompanyApplication, CompanyPerson[]]) => {
        const app: CompanyApplication = "application" in envelope ? envelope.application : envelope;
        setFormData(prev => ({
          ...prev,
          applicationType: app.applicationType || prev.applicationType,
          companyType: app.companyType || prev.companyType,
          companyName1: app.companyName1 || prev.companyName1,
          companyName2: app.companyName2 || prev.companyName2,
          companyName3: app.companyName3 || prev.companyName3,
          businessDescription: app.businessDescription || prev.businessDescription,
          registeredAddress: (app.registeredAddress as typeof prev.registeredAddress) || prev.registeredAddress,
          operatingAddress: (app.operatingAddress as typeof prev.operatingAddress) || prev.operatingAddress,
        }));
        if (app.selectedNames && app.selectedNames.length > 0) {
          setResumeSelectedNames(app.selectedNames as string[]);
        }
        // Restore directors/shareholders
        const appPeople = Array.isArray(allPeople)
          ? allPeople.filter((p: CompanyPerson) => p.applicationId === id)
          : [];
        if (appPeople.length > 0) {
          setDirectors(appPeople.map((p: CompanyPerson) => ({
            localId: crypto.randomUUID(),
            personId: p.id,
            personType: (p.entityType === "corporate" ? "corporate" : "individual") as "individual" | "corporate",
            fullName: p.entityType !== "corporate" ? (p.title || "") : "",
            inviteEmail: p.inviteEmail || "",
            role: p.role || "director",
            sharesAllocated: p.sharesAllocated?.toString() || "",
            shareClass: p.shareClass || "ordinary",
            sharePercentage: p.sharePercentage || "",
            corporateName: p.corporateName || "",
            corporateRcNumber: p.corporateRcNumber || "",
            corporateCountry: p.corporateCountry || "Nigeria",
            authorisedRepName: p.corporateAuthorisedRepName || "",
          })));
        }
        // Always start at Step 3 in resume mode (Steps 1 & 2 are read-only)
        setCurrentStep(3);
        toast({ title: "Resuming application", description: "Complete the remaining steps to submit your application." });
      })
      .catch(() => {
        toast({ title: "Could not load application", description: "Starting fresh.", variant: "destructive" });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track online status
  useEffect(() => {
    return onOnlineStatusChange((isOnline) => {
      setOnline(isOnline);
      if (isOnline) {
        toast({
          title: "Back online",
          description: "Your connection has been restored.",
        });
      } else {
        toast({
          title: "You're offline",
          description: "Changes will be saved locally.",
          variant: "destructive",
        });
      }
    });
  }, []);

  // Auto-save draft when form data or step changes
  const autoSave = useCallback(() => {
    saveDraft({
      id: DRAFT_ID,
      step: currentStep,
      data: {
        applicationType: formData.applicationType,
        companyType: formData.companyType,
        companyName1: formData.companyName1,
        companyName2: formData.companyName2,
        companyName3: formData.companyName3,
        businessDescription: formData.businessDescription,
        registeredAddress: JSON.stringify(formData.registeredAddress),
        operatingAddress: JSON.stringify(formData.operatingAddress),
      },
      updatedAt: new Date().toISOString(),
      synced: false,
    });
    setLastSaved(new Date());
  }, [formData, currentStep]);

  useEffect(() => {
    const timer = setTimeout(autoSave, 1000);
    return () => clearTimeout(timer);
  }, [formData, currentStep, autoSave]);

  // Mirror registered address into operating address when same-as checkbox is ticked
  useEffect(() => {
    if (!sameAsRegistered) return;
    setFormData(prev => ({
      ...prev,
      operatingAddress: { ...prev.registeredAddress },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sameAsRegistered,
    formData.registeredAddress.line1,
    formData.registeredAddress.line2,
    formData.registeredAddress.city,
    formData.registeredAddress.state,
    formData.registeredAddress.postalCode,
    formData.registeredAddress.country,
  ]);

  // saveDraftMutation — persists wizard state to the server mid-wizard
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/applications/draft", {
        draftApplicationId,
        wizardStep: currentStep,
        applicationType: formData.applicationType,
        companyType: formData.companyType || undefined,
        companyName1: formData.companyName1 || undefined,
        companyName2: formData.companyName2 || undefined,
        companyName3: formData.companyName3 || undefined,
        businessDescription: formData.businessDescription || undefined,
        registeredAddress: formData.useRegisteredOffice ? undefined : (formData.registeredAddress.line1 ? formData.registeredAddress : undefined),
        operatingAddress: sameAsRegistered
          ? { ...formData.registeredAddress }
          : (formData.operatingAddress.line1 ? formData.operatingAddress : undefined),
      });
      return response.json() as Promise<{ id: number }>;
    },
    onSuccess: (data) => {
      setDraftApplicationId(data.id);
      // Persist both the draft id and the current step so the wizard can reopen at the right step
      localStorage.setItem("wizard-draft-id", String(data.id));
      localStorage.setItem(`wizard-draft-step-${data.id}`, String(currentStep));
      queryClient.invalidateQueries({ queryKey: ["/api/founder/applications"] });
      toast({ title: "Draft saved", description: "Your progress has been saved. You can continue anytime from your Applications list." });
      navigate("/founder/applications");
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save your draft. Please try again.", variant: "destructive" });
    },
  });

  const persistDirectorMutation = useMutation({
    mutationFn: async (dir: Omit<DirectorEntry, "localId" | "personId">) => {
      const payload: Record<string, unknown> = {
        inviteEmail: dir.personType === "corporate" ? dir.inviteEmail : dir.inviteEmail,
        role: dir.role,
        title: dir.personType === "corporate" ? (dir.corporateName || null) : (dir.fullName || null),
        deferInvite: true,
        sharesAllocated: dir.sharesAllocated ? parseInt(dir.sharesAllocated, 10) : null,
        shareClass: dir.shareClass || null,
        sharePercentage: dir.sharePercentage || null,
        entityType: dir.personType,
      };
      if (dir.personType === "corporate") {
        payload.corporateName = dir.corporateName || null;
        payload.corporateRcNumber = dir.corporateRcNumber || null;
        payload.corporateCountry = dir.corporateCountry || null;
        payload.corporateAuthorisedRepName = dir.authorisedRepName || null;
      }
      const res = await apiRequest("POST", "/api/company-people", payload);
      return res.json() as Promise<{ id: number }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/applications", {
        applicationType: data.applicationType,
        companyType: data.companyType,
        companyName1: data.companyName1,
        companyName2: data.companyName2,
        companyName3: data.companyName3,
        businessDescription: data.businessDescription,
        registeredAddress: data.useRegisteredOffice ? null : data.registeredAddress,
        operatingAddress: data.operatingAddress,
      });
      const app = await response.json();
      
      if (data.useRegisteredOffice && data.registeredOfficeTier) {
        await apiRequest("POST", "/api/registered-office/select", {
          applicationId: app.id,
          tier: data.registeredOfficeTier,
        });
      }

      for (const dir of directors) {
        if (dir.personId) {
          await apiRequest("PUT", `/api/company-people/${dir.personId}`, {
            applicationId: app.id,
          });
        } else if (dir.inviteEmail) {
          const dirPayload: Record<string, unknown> = {
            inviteEmail: dir.inviteEmail,
            role: dir.role,
            title: dir.personType === "corporate" ? (dir.corporateName || null) : (dir.fullName || null),
            applicationId: app.id,
            deferInvite: true,
            sharesAllocated: dir.sharesAllocated ? parseInt(dir.sharesAllocated, 10) : null,
            shareClass: dir.shareClass || null,
            sharePercentage: dir.sharePercentage || null,
            entityType: dir.personType,
          };
          if (dir.personType === "corporate") {
            dirPayload.corporateName = dir.corporateName || null;
            dirPayload.corporateRcNumber = dir.corporateRcNumber || null;
            dirPayload.corporateCountry = dir.corporateCountry || null;
            dirPayload.corporateAuthorisedRepName = dir.authorisedRepName || null;
          }
          await apiRequest("POST", "/api/company-people", dirPayload);
        }
      }

      // F1: Save company secretary if provided
      if (secretaryMode === "invite" && secretaryEmail) {
        await apiRequest("POST", "/api/company-people", {
          inviteEmail: secretaryEmail,
          role: "secretary",
          title: secretaryName || null,
          applicationId: app.id,
          deferInvite: true,
        });
      } else if (secretaryMode === "appoint" && secretaryEmail) {
        // Appoint an existing member — add them as secretary too
        await apiRequest("POST", "/api/company-people", {
          inviteEmail: secretaryEmail,
          role: "secretary",
          title: secretaryName || null,
          applicationId: app.id,
          deferInvite: true,
        });
      }

      return app;
    },
    onSuccess: async (app) => {
      // If continuing from a saved draft, mark the old draft as legacy to avoid duplication
      if (draftApplicationId && draftApplicationId !== app.id) {
        apiRequest("PATCH", `/api/applications/${draftApplicationId}`, { isLegacyDraft: true }).catch(() => {});
        localStorage.removeItem(`wizard-draft-step-${draftApplicationId}`);
      }
      localStorage.removeItem("wizard-draft-id");
      deleteDraft(DRAFT_ID);
      queryClient.invalidateQueries({ queryKey: ["/api/founder/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people"] });
      toast({
        title: "Application created",
        description: directors.length > 0
          ? `Application saved. Invitation emails will be sent to ${directors.length} team member${directors.length > 1 ? "s" : ""} once payment is complete.`
          : formData.useRegisteredOffice 
            ? "Your application has been saved with registered office selection."
            : "Your application has been saved as a draft.",
      });
      navigate(`/applications/${app.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addDirector = async () => {
    if (newDirector.personType === "corporate") {
      if (!newDirector.corporateName || !newDirector.corporateRcNumber || !newDirector.inviteEmail) return;
    } else {
      if (!newDirector.fullName || !newDirector.inviteEmail || !newDirector.role) return;
    }
    const localId = crypto.randomUUID();
    try {
      const person = await persistDirectorMutation.mutateAsync({ ...newDirector });
      setDirectors(prev => [...prev, { ...newDirector, localId, personId: person.id }]);
    } catch {
      setDirectors(prev => [...prev, { ...newDirector, localId }]);
    }
    setNewDirector({
      personType: "individual",
      fullName: "",
      inviteEmail: "",
      role: "director",
      sharesAllocated: "",
      shareClass: "ordinary",
      sharePercentage: "",
      corporateName: "",
      corporateRcNumber: "",
      corporateCountry: "Nigeria",
      authorisedRepName: "",
    });
  };

  const totalSharePercentage = directors.reduce((sum, d) => sum + (parseFloat(d.sharePercentage) || 0), 0);

  const removeDirector = (localId: string) => {
    setDirectors(prev => prev.filter(d => d.localId !== localId));
  };

  const fetchAiSuggestions = async () => {
    if (!formData.businessDescription.trim()) return;
    
    setIsLoadingAi(true);
    try {
      const response = await apiRequest("POST", "/api/legal-ai/suggest-activities", {
        businessDescription: formData.businessDescription,
        companyType: formData.companyType,
      });
      const data = await response.json();
      setAiSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("AI suggestions error:", error);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateAddress = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      registeredAddress: {
        ...prev.registeredAddress,
        [field]: value,
      },
    }));
  };

  const updateOperatingAddress = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      operatingAddress: {
        ...prev.operatingAddress,
        [field]: value,
      },
    }));
  };

  const canProceed = () => {
    // In resume mode Steps 1 & 2 are read-only — always passable
    if (resumeApplicationId && (currentStep === 1 || currentStep === 2)) return true;
    switch (currentStep) {
      case 1:
        return !!formData.companyType;
      case 2:
        return !!formData.companyName1;
      case 3:
        return !!formData.businessDescription;
      case 4: {
        const hasShareholderRoles = directors.some(d =>
          ["shareholder", "director_shareholder"].includes(d.role)
        );
        if (hasShareholderRoles) return Math.abs(totalSharePercentage - 100) < 0.01;
        return true;
      }
      case 5: {
        // When same-as checkbox is ticked, the operating address will be auto-filled from registered
        const hasOperatingAddress = sameAsRegistered
          ? !!formData.registeredAddress.line1 && !!formData.registeredAddress.city && !!formData.registeredAddress.state
          : !!formData.operatingAddress.line1 && !!formData.operatingAddress.city && !!formData.operatingAddress.state;
        if (formData.useRegisteredOffice) {
          return !!formData.registeredOfficeTier && hasOperatingAddress;
        }
        return !!formData.registeredAddress.country && !!formData.registeredAddress.line1 && !!formData.registeredAddress.city && !!formData.registeredAddress.state && hasOperatingAddress;
      }
      case 6:
        // Secretary is optional for LTD/SMC under CAMA 2020 (required for PLC)
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else if (resumeApplicationId) {
      resumeCreateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveAndExit = () => {
    saveDraftMutation.mutate();
  };

  // Phase 1 names-only submission
  const submitNameCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/applications", {
        phase: "names_only",
        applicationType: formData.applicationType,
        companyType: formData.companyType,
        companyName1: formData.companyName1,
        companyName2: formData.companyName2 || undefined,
        companyName3: formData.companyName3 || undefined,
      });
      return response.json() as Promise<{ id: number }>;
    },
    onSuccess: (data) => {
      setSubmittedNameCheckAppId(data.id);
      setNameCheckSubmitted(true);
      localStorage.removeItem("wizard-draft-id");
      deleteDraft(DRAFT_ID);
      queryClient.invalidateQueries({ queryKey: ["/api/founder/applications"] });
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Could not submit your names. Please try again.", variant: "destructive" });
    },
  });

  // Resume-mode submission: PATCH existing application with full wizard data, create checklist, move to draft
  const resumeCreateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const appId = resumeApplicationId!;

      // Patch application fields (step 3 data + selected names + completion flag)
      const response = await apiRequest("PATCH", `/api/applications/${appId}`, {
        businessDescription: data.businessDescription,
        registeredAddress: data.useRegisteredOffice ? undefined : data.registeredAddress,
        operatingAddress: data.operatingAddress,
        selectedNames: resumeSelectedNames.length > 0 ? resumeSelectedNames : undefined,
        completingFromNamesReview: true,
      });
      const app = await response.json();

      // Mirror create-flow: attach/create Step 4 people records against this application
      for (const dir of directors) {
        if (dir.personId) {
          // Existing person record — attach to this application
          await apiRequest("PUT", `/api/company-people/${dir.personId}`, {
            applicationId: appId,
          });
        } else if (dir.inviteEmail) {
          // New person entry — create with applicationId
          const dirPayload: Record<string, unknown> = {
            inviteEmail: dir.inviteEmail,
            role: dir.role,
            title: dir.personType === "corporate" ? (dir.corporateName || null) : (dir.fullName || null),
            applicationId: appId,
            deferInvite: true,
            sharesAllocated: dir.sharesAllocated ? parseInt(dir.sharesAllocated, 10) : null,
            shareClass: dir.shareClass || null,
            sharePercentage: dir.sharePercentage || null,
            entityType: dir.personType,
          };
          if (dir.personType === "corporate") {
            dirPayload.corporateName = dir.corporateName || null;
            dirPayload.corporateRcNumber = dir.corporateRcNumber || null;
            dirPayload.corporateCountry = dir.corporateCountry || null;
            dirPayload.corporateAuthorisedRepName = dir.authorisedRepName || null;
          }
          await apiRequest("POST", "/api/company-people", dirPayload);
        }
      }

      // Handle registered office selection if chosen in step 3
      if (data.useRegisteredOffice && data.registeredOfficeTier) {
        await apiRequest("POST", "/api/registered-office/select", {
          applicationId: appId,
          tier: data.registeredOfficeTier,
        });
      }

      return app;
    },
    onSuccess: () => {
      deleteDraft(DRAFT_ID);
      localStorage.removeItem("wizard-draft-id");
      queryClient.invalidateQueries({ queryKey: ["/api/founder/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people"] });
      toast({ title: "Application ready", description: "Your application is saved as a draft. Please upload documents and proceed to payment." });
      navigate(`/applications/${resumeApplicationId}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save application. Please try again.", variant: "destructive" });
    },
  });

  // Holding card — shown after Phase 1 name check submission
  if (nameCheckSubmitted) {
    return (
      <DashboardLayout
        role="founder"
        breadcrumbs={[
          { label: "Dashboard", href: "/founder/dashboard" },
          { label: "Applications", href: "/founder/applications" },
          { label: "Names Submitted" },
        ]}
      >
        <div className="max-w-xl mx-auto">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-10 pb-10 text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Names Submitted for Review</h2>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                  Your company name options have been submitted. A lawyer will check availability with the CAC registry and notify you when results are ready.
                </p>
              </div>
              {submittedNameCheckAppId && (
                <p className="text-sm text-muted-foreground">
                  Application #{submittedNameCheckAppId} — you'll receive an email and in-app notification once results are ready.
                </p>
              )}
              <Button onClick={() => navigate("/founder/applications")} data-testid="button-back-to-applications">
                View My Applications
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      role="founder" 
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "Applications", href: "/founder/applications" },
        { label: resumeApplicationId ? "Complete Registration" : "New Application" }
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{resumeApplicationId ? "Complete Your Registration" : "New Company Registration"}</h1>
            <p className="text-muted-foreground">
              {resumeApplicationId ? "Complete the remaining steps to submit your application" : "Complete the following steps to start your company incorporation"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!online && (
              <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-offline">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            {lastSaved && (
              <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-saved">
                <Save className="h-3 w-3" />
                Saved
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${index > 0 ? "flex-1" : ""}`}>
                {index > 0 && (
                  <div className={`h-0.5 flex-1 ${currentStep > step.id - 1 ? "bg-primary" : "bg-muted"}`} />
                )}
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                    currentStep > step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              resumeApplicationId ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Company structure (locked)</p>
                    {companyTypes.filter(t => t.value === formData.companyType).map((type) => (
                      <div key={type.value} className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{type.label}</p>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    Company type was locked when you submitted your names for the CAC availability check.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {companyTypes.map((type) => (
                    <div
                      key={type.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover-elevate ${
                        formData.companyType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50"
                      }`}
                      onClick={() => updateFormData("companyType", type.value)}
                      data-testid={`company-type-${type.value}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          formData.companyType === type.value ? "bg-primary/20" : "bg-muted"
                        }`}>
                          <Building2 className={`h-5 w-5 ${
                            formData.companyType === type.value ? "text-primary" : "text-muted-foreground"
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-medium">{type.label}</h3>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* E1: SMC notice when Single Member Company selected */}
                  {formData.companyType === "SMC" && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 mt-2" data-testid="smc-notice">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Single Member Company (SMC)</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                        Under CAMA 2020, a Single Member Company may be incorporated with only one shareholder.
                        You will be the sole director and shareholder. All shares must be allocated 100% to one person in Step 4.
                      </p>
                    </div>
                  )}
                </div>
              )
            )}

            {currentStep === 2 && (
              resumeApplicationId ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted names (locked)</p>
                    {formData.companyName1 && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">Preferred:</span>
                        <span className="font-medium text-sm">{formData.companyName1}</span>
                      </div>
                    )}
                    {formData.companyName2 && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">Alternative 1:</span>
                        <span className="font-medium text-sm">{formData.companyName2}</span>
                      </div>
                    )}
                    {formData.companyName3 && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">Alternative 2:</span>
                        <span className="font-medium text-sm">{formData.companyName3}</span>
                      </div>
                    )}
                    {resumeSelectedNames.length > 0 && (
                      <div className="border-t border-muted pt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Your selection:</span>
                        {resumeSelectedNames.map(name => (
                          <Badge key={name} className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">{name}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    Names were submitted for a CAC availability check and cannot be edited here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName1">Preferred Company Name *</Label>
                    <Input
                      id="companyName1"
                      placeholder="e.g., TechVentures Nigeria"
                      value={formData.companyName1}
                      onChange={(e) => updateFormData("companyName1", e.target.value)}
                      data-testid="input-company-name-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName2">Alternative Name 1 (Optional)</Label>
                    <Input
                      id="companyName2"
                      placeholder="Second choice"
                      value={formData.companyName2}
                      onChange={(e) => updateFormData("companyName2", e.target.value)}
                      data-testid="input-company-name-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName3">Alternative Name 2 (Optional)</Label>
                    <Input
                      id="companyName3"
                      placeholder="Third choice"
                      value={formData.companyName3}
                      onChange={(e) => updateFormData("companyName3", e.target.value)}
                      data-testid="input-company-name-3"
                    />
                  </div>
                  {/* E3: Restricted name pre-check */}
                  {(() => {
                    const allNames = [formData.companyName1, formData.companyName2, formData.companyName3]
                      .filter(Boolean).map(n => n!.toLowerCase());
                    const flagged = RESTRICTED_NAME_WORDS.filter(word =>
                      allNames.some(name => name.includes(word.toLowerCase()))
                    );
                    if (flagged.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3" data-testid="restricted-name-warning">
                        <p className="text-sm font-medium text-red-900 dark:text-red-100">Restricted Name Warning</p>
                        <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                          One or more of your proposed names contains a word that is restricted or requires special approval under CAC regulations: <strong>{flagged.join(", ")}</strong>.
                          CAC may reject names containing these words unless you have the necessary licence or approval. You can still proceed, but consider choosing a different name.
                        </p>
                      </div>
                    );
                  })()}

                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">Two-step Name Process</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                      After submitting your names, a lawyer will check their availability with the CAC registry. You'll be notified when results are ready to continue your application.
                    </p>
                  </div>
                </div>
              )
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessDescription">Business Description *</Label>
                  <Textarea
                    id="businessDescription"
                    placeholder="Describe what your company will do..."
                    rows={4}
                    value={formData.businessDescription}
                    onChange={(e) => updateFormData("businessDescription", e.target.value)}
                    data-testid="input-business-description"
                  />
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchAiSuggestions}
                  disabled={!formData.businessDescription.trim() || isLoadingAi}
                  className="gap-2"
                  data-testid="button-ai-suggest"
                >
                  {isLoadingAi ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Suggest CAC Activities
                </Button>

                {aiSuggestions.length > 0 && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI-Suggested CAC Activities
                      </CardTitle>
                      <CardDescription className="text-xs">
                        These are suggestions only, not legal advice. Your lawyer will review.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {aiSuggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{suggestion.activity || suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* E2: Regulated industry warning */}
                {(() => {
                  const desc = formData.businessDescription.toLowerCase();
                  const matched = REGULATED_KEYWORDS.filter(k => desc.includes(k));
                  if (matched.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 p-3" data-testid="regulated-industry-warning">
                      <p className="text-sm font-medium text-orange-900 dark:text-orange-100">Regulated Industry Detected</p>
                      <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                        Your business description suggests activity in a regulated sector (<strong>{matched.slice(0, 3).join(", ")}</strong>
                        {matched.length > 3 ? `, +${matched.length - 3} more` : ""}).
                        These industries require additional licences or approvals from sector regulators (CBN, NAICOM, NCC, DPR, etc.) before operations can begin.
                        Your Cellion One lawyer can advise on the specific requirements.
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3 text-sm" data-testid="directors-info-banner">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">
                    Declare co-founders, directors, and shareholders. Each person is saved immediately — invitation emails are sent only after incorporation payment is confirmed. Shareholders must have share percentages totalling exactly 100%. You can also manage this team later from your dashboard.
                  </p>
                </div>

                {directors.length > 0 && (
                  <div className="space-y-2" data-testid="directors-list">
                    {directors.map((dir) => (
                      <div
                        key={dir.localId}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background"
                        data-testid={`director-row-${dir.localId}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {dir.personType === "corporate"
                              ? <Building2 className="h-4 w-4 text-primary" />
                              : <Users className="h-4 w-4 text-primary" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">
                                {dir.personType === "corporate" ? dir.corporateName : (dir.fullName || dir.inviteEmail)}
                              </p>
                              {dir.personType === "corporate" && (
                                <Badge variant="secondary" className="text-xs shrink-0" data-testid={`badge-corporate-${dir.localId}`}>Corporate</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{dir.inviteEmail}</p>
                            {dir.personType === "corporate" && dir.authorisedRepName && (
                              <p className="text-xs text-muted-foreground truncate">Rep: {dir.authorisedRepName}</p>
                            )}
                            <p className="text-xs text-muted-foreground capitalize">
                              {dir.role.replace(/_/g, " ")}
                              {dir.sharePercentage ? ` · ${dir.sharePercentage}% ${dir.shareClass || ""}` : ""}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeDirector(dir.localId)}
                          data-testid={`button-remove-director-${dir.localId}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {(() => {
                      const hasShareholderRoles = directors.some(d =>
                        ["shareholder", "director_shareholder"].includes(d.role)
                      );
                      if (totalSharePercentage > 100) {
                        return (
                          <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-share-pct-warning">
                            ⚠ Total share percentage is {totalSharePercentage.toFixed(2)}% — exceeds 100%. Please review allocations.
                          </p>
                        );
                      }
                      if (hasShareholderRoles && totalSharePercentage < 100) {
                        return (
                          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1" data-testid="text-share-pct-remaining">
                            ℹ {(100 - totalSharePercentage).toFixed(2)}% remaining — share percentages must total exactly 100% to proceed.
                          </p>
                        );
                      }
                      if (hasShareholderRoles && Math.abs(totalSharePercentage - 100) < 0.01) {
                        return (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1" data-testid="text-share-pct-complete">
                            ✓ 100% of shares allocated — you can proceed.
                          </p>
                        );
                      }
                      if (!hasShareholderRoles && totalSharePercentage > 0) {
                        return (
                          <p className="text-xs text-muted-foreground" data-testid="text-share-pct-total">
                            Total declared: {totalSharePercentage.toFixed(2)}% of shares allocated to listed members.
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                <div className="space-y-4 rounded-lg border p-4" data-testid="add-director-form">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Add a Team Member
                    </p>
                    <div className="flex items-center gap-1 rounded-md border p-0.5 bg-muted/40" data-testid="toggle-person-type">
                      <button
                        type="button"
                        onClick={() => setNewDirector(p => ({ ...p, personType: "individual" }))}
                        className={`px-3 py-1 text-xs rounded font-medium transition-colors ${newDirector.personType === "individual" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        data-testid="toggle-individual"
                      >
                        <Users className="h-3 w-3 inline mr-1" />Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDirector(p => ({ ...p, personType: "corporate" }))}
                        className={`px-3 py-1 text-xs rounded font-medium transition-colors ${newDirector.personType === "corporate" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        data-testid="toggle-corporate"
                      >
                        <Building2 className="h-3 w-3 inline mr-1" />Corporate
                      </button>
                    </div>
                  </div>

                  {newDirector.personType === "individual" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dir-name">Full Name *</Label>
                        <Input
                          id="dir-name"
                          type="text"
                          placeholder="e.g. Chukwuemeka Obi"
                          value={newDirector.fullName}
                          onChange={(e) => setNewDirector(p => ({ ...p, fullName: e.target.value }))}
                          data-testid="input-director-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dir-email">Email Address *</Label>
                        <Input
                          id="dir-email"
                          type="email"
                          placeholder="director@example.com"
                          value={newDirector.inviteEmail}
                          onChange={(e) => setNewDirector(p => ({ ...p, inviteEmail: e.target.value }))}
                          data-testid="input-director-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dir-role">Role *</Label>
                        <Select value={newDirector.role} onValueChange={(v) => setNewDirector(p => ({ ...p, role: v }))}>
                          <SelectTrigger id="dir-role" data-testid="select-director-role"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="shareholder">Shareholder</SelectItem>
                            <SelectItem value="director_shareholder">Director & Shareholder</SelectItem>
                            <SelectItem value="secretary">Company Secretary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dir-share-class">Share Class</Label>
                        <Select value={newDirector.shareClass} onValueChange={(v) => setNewDirector(p => ({ ...p, shareClass: v }))}>
                          <SelectTrigger id="dir-share-class" data-testid="select-director-share-class"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(shareClassInfo).map(([value, info]) => (
                              <SelectItem key={value} value={value}>{info.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {newDirector.shareClass && shareClassInfo[newDirector.shareClass] && (
                          <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-0.5">
                            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                            {shareClassInfo[newDirector.shareClass].description}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dir-shares">Shares Allocated</Label>
                        <Input
                          id="dir-shares"
                          type="number"
                          min="0"
                          placeholder="e.g. 5000"
                          value={newDirector.sharesAllocated}
                          onChange={(e) => setNewDirector(p => ({ ...p, sharesAllocated: e.target.value }))}
                          data-testid="input-director-shares"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dir-pct">Share Percentage (%)</Label>
                        <Input
                          id="dir-pct"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="e.g. 25"
                          value={newDirector.sharePercentage}
                          onChange={(e) => setNewDirector(p => ({ ...p, sharePercentage: e.target.value }))}
                          data-testid="input-director-percentage"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>A Corporate entity (company or trust) can be a director or shareholder. The entity's RC number will be verified via the CAC registry as part of the verification process.</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="corp-name">Registered Company Name *</Label>
                          <Input
                            id="corp-name"
                            type="text"
                            placeholder="e.g. Acme Holdings Ltd"
                            value={newDirector.corporateName || ""}
                            onChange={(e) => setNewDirector(p => ({ ...p, corporateName: e.target.value }))}
                            data-testid="input-corporate-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corp-rc">RC Number *</Label>
                          <Input
                            id="corp-rc"
                            type="text"
                            placeholder="e.g. RC123456"
                            value={newDirector.corporateRcNumber || ""}
                            onChange={(e) => setNewDirector(p => ({ ...p, corporateRcNumber: e.target.value }))}
                            data-testid="input-corporate-rc"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corp-country">Country of Incorporation</Label>
                          <Select
                            value={newDirector.corporateCountry || "Nigeria"}
                            onValueChange={(v) => setNewDirector(p => ({ ...p, corporateCountry: v }))}
                          >
                            <SelectTrigger id="corp-country" data-testid="select-corporate-country"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corp-role">Role *</Label>
                          <Select value={newDirector.role} onValueChange={(v) => setNewDirector(p => ({ ...p, role: v }))}>
                            <SelectTrigger id="corp-role" data-testid="select-corporate-role"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="director">Director</SelectItem>
                              <SelectItem value="shareholder">Shareholder</SelectItem>
                              <SelectItem value="director_shareholder">Director & Shareholder</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corp-rep-name">Authorised Representative Name</Label>
                          <Input
                            id="corp-rep-name"
                            type="text"
                            placeholder="e.g. Ada Nwosu"
                            value={newDirector.authorisedRepName || ""}
                            onChange={(e) => setNewDirector(p => ({ ...p, authorisedRepName: e.target.value }))}
                            data-testid="input-corporate-rep-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corp-rep-email">Authorised Representative Email *</Label>
                          <Input
                            id="corp-rep-email"
                            type="email"
                            placeholder="rep@acme.com"
                            value={newDirector.inviteEmail}
                            onChange={(e) => setNewDirector(p => ({ ...p, inviteEmail: e.target.value }))}
                            data-testid="input-corporate-rep-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corp-share-pct">Share Percentage (%)</Label>
                          <Input
                            id="corp-share-pct"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="e.g. 30"
                            value={newDirector.sharePercentage}
                            onChange={(e) => setNewDirector(p => ({ ...p, sharePercentage: e.target.value }))}
                            data-testid="input-corporate-share-pct"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="corp-share-class">Share Class</Label>
                          <Select value={newDirector.shareClass} onValueChange={(v) => setNewDirector(p => ({ ...p, shareClass: v }))}>
                            <SelectTrigger id="corp-share-class" data-testid="select-corporate-share-class"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(shareClassInfo).map(([value, info]) => (
                                <SelectItem key={value} value={value}>{info.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDirector}
                    disabled={
                      newDirector.personType === "corporate"
                        ? !newDirector.corporateName || !newDirector.corporateRcNumber || !newDirector.inviteEmail
                        : !newDirector.fullName || !newDirector.inviteEmail
                    }
                    className="gap-2"
                    data-testid="button-add-director"
                  >
                    <UserPlus className="h-4 w-4" />
                    {newDirector.personType === "corporate" ? "Add Corporate Entity" : "Add Person"}
                  </Button>
                </div>

                {directors.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2" data-testid="text-no-directors">
                    No team members added yet. You can add them later from your dashboard if preferred.
                  </p>
                )}

                {/* D2/D3: PSC and Capital Declarations for shareholders ≥25% */}
                {(() => {
                  const pscShareholders = directors.filter(d =>
                    ["shareholder", "director_shareholder"].includes(d.role) &&
                    parseFloat(d.sharePercentage || "0") >= 25
                  );
                  if (pscShareholders.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-4" data-testid="psc-declarations-section">
                      <div>
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">PSC &amp; Capital Declarations Required</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                          The following shareholders hold ≥25% and must complete PSC and capital declarations before you can proceed to registration.
                          These will be sent to each shareholder for confirmation; the founder can also complete on their behalf.
                        </p>
                      </div>
                      {pscShareholders.map(sh => (
                        <div key={sh.localId} className="space-y-2 border-t border-amber-200 dark:border-amber-700 pt-3">
                          <p className="text-sm font-medium">{sh.personType === "corporate" ? sh.corporateName : (sh.fullName || sh.inviteEmail)} ({sh.sharePercentage}%)</p>
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              id={`psc-${sh.localId}`}
                              checked={!!pscDeclarations[sh.localId]}
                              onChange={e => setPscDeclarations(prev => ({ ...prev, [sh.localId]: e.target.checked }))}
                              className="mt-0.5"
                              data-testid={`checkbox-psc-${sh.localId}`}
                            />
                            <label htmlFor={`psc-${sh.localId}`} className="text-xs leading-snug cursor-pointer text-amber-900 dark:text-amber-100">
                              I confirm this person is a <strong>Person with Significant Control (PSC)</strong> and consent to their details being entered in the PSC register as required by CAMA 2020.
                            </label>
                          </div>
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              id={`capital-${sh.localId}`}
                              checked={!!capitalDeclarations[sh.localId]}
                              onChange={e => setCapitalDeclarations(prev => ({ ...prev, [sh.localId]: e.target.checked }))}
                              className="mt-0.5"
                              data-testid={`checkbox-capital-${sh.localId}`}
                            />
                            <label htmlFor={`capital-${sh.localId}`} className="text-xs leading-snug cursor-pointer text-amber-900 dark:text-amber-100">
                              I confirm at least <strong>25% of the nominal share value</strong> allocated to this person has been or will be paid up on allotment (CAMA 2020, s.124).
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Choose Address Type</Label>
                  <RadioGroup 
                    value={formData.useRegisteredOffice ? "celion" : "own"}
                    onValueChange={(value) => {
                      updateFormData("useRegisteredOffice", value === "celion");
                      if (value === "own") {
                        updateFormData("registeredOfficeTier", "");
                      }
                    }}
                    className="space-y-3"
                  >
                    <div className="flex items-start space-x-3 border rounded-lg p-4 hover-elevate cursor-pointer" onClick={() => updateFormData("useRegisteredOffice", false)}>
                      <RadioGroupItem value="own" id="address-own" data-testid="radio-address-own" />
                      <div className="flex-1">
                        <Label htmlFor="address-own" className="font-medium cursor-pointer">Use My Own Address</Label>
                        <p className="text-sm text-muted-foreground mt-1">Provide your own registered office address</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 border rounded-lg p-4 hover-elevate cursor-pointer bg-primary/5 border-primary/30" onClick={() => updateFormData("useRegisteredOffice", true)}>
                      <RadioGroupItem value="celion" id="address-celion" data-testid="radio-address-celion" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="address-celion" className="font-medium cursor-pointer">Use Cellion Registered Office</Label>
                          <Badge variant="secondary" className="text-xs">Ikoyi, Lagos</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {registeredOfficeOptions?.location.label || "Premium business address in Ikoyi, Lagos"}
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {formData.useRegisteredOffice && registeredOfficeOptions && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Shield className="h-4 w-4 text-amber-600 mt-0.5" />
                        <p className="text-amber-800 dark:text-amber-200">{registeredOfficeOptions.policyText}</p>
                      </div>
                    </div>
                    
                    <Label className="text-sm font-medium">Select Service Tier</Label>
                    <div className="grid gap-4 md:grid-cols-2">
                      {registeredOfficeOptions.tiers.map((tier) => (
                        <Card
                          key={tier.id}
                          className={`cursor-pointer transition-all hover-elevate ${
                            formData.registeredOfficeTier === tier.id
                              ? "border-primary ring-2 ring-primary/20"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => updateFormData("registeredOfficeTier", tier.id as "office_only" | "office_plus_mail")}
                          data-testid={`card-tier-${tier.id}`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-base">{tier.name}</CardTitle>
                              {formData.registeredOfficeTier === tier.id && (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <CardDescription>{tier.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-2xl font-bold text-primary">
                              ₦{tier.priceNgn.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/year</span>
                            </p>
                            <ul className="space-y-1.5 text-sm">
                              {tier.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!formData.useRegisteredOffice && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Select
                        value={useCustomCountry ? "Other country…" : (formData.registeredAddress.country || "Nigeria")}
                        onValueChange={(value) => {
                          if (value === "Other country…") {
                            setUseCustomCountry(true);
                            updateAddress("country", "");
                            updateAddress("state", "");
                          } else {
                            setUseCustomCountry(false);
                            updateAddress("country", value);
                            updateAddress("state", "");
                          }
                        }}
                      >
                        <SelectTrigger id="country" data-testid="select-address-country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countries.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {useCustomCountry && (
                        <Input
                          placeholder="Type your country name"
                          value={formData.registeredAddress.country}
                          onChange={(e) => updateAddress("country", e.target.value)}
                          data-testid="input-address-country-custom"
                          autoFocus
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="line1">Street Address *</Label>
                      <Input
                        id="line1"
                        placeholder="123 Business Street"
                        value={formData.registeredAddress.line1}
                        onChange={(e) => updateAddress("line1", e.target.value)}
                        data-testid="input-address-line1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="line2">Address Line 2</Label>
                      <Input
                        id="line2"
                        placeholder="Suite, floor, building name (optional)"
                        value={formData.registeredAddress.line2}
                        onChange={(e) => updateAddress("line2", e.target.value)}
                        data-testid="input-address-line2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          placeholder={formData.registeredAddress.country === "Nigeria" ? "Lagos" : "City"}
                          value={formData.registeredAddress.city}
                          onChange={(e) => updateAddress("city", e.target.value)}
                          data-testid="input-address-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">
                          {formData.registeredAddress.country === "Nigeria" ? "State *" : "State / Region *"}
                        </Label>
                        {formData.registeredAddress.country === "Nigeria" ? (
                          <Select
                            value={formData.registeredAddress.state}
                            onValueChange={(value) => updateAddress("state", value)}
                          >
                            <SelectTrigger data-testid="select-address-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {nigerianStates.map((state) => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="state"
                            placeholder="State, province, or region"
                            value={formData.registeredAddress.state}
                            onChange={(e) => updateAddress("state", e.target.value)}
                            data-testid="input-address-state"
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        placeholder={formData.registeredAddress.country === "Nigeria" ? "e.g. 100001" : "Postal / ZIP code"}
                        value={formData.registeredAddress.postalCode}
                        onChange={(e) => updateAddress("postalCode", e.target.value)}
                        data-testid="input-address-postal"
                      />
                      {formData.registeredAddress.country === "Nigeria" && (
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5" data-testid="text-nipost-helper">
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                          Nigerian postcodes follow a 6-digit format (e.g. 100001 for Lagos Island).
                          Look yours up at{" "}
                          <a
                            href="https://nipost.gov.ng"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-primary hover:text-primary/80"
                          >
                            nipost.gov.ng
                          </a>.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4 border-t pt-6">
                  <div>
                    <Label className="text-base font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Operating Address *
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/70" />
                      The actual location where your business operates. This is the address you will need to prove with a utility bill or bank statement — it may be the same as your registered address or different.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox
                      id="same-as-registered"
                      checked={sameAsRegistered}
                      onCheckedChange={(checked) => setSameAsRegistered(!!checked)}
                      data-testid="checkbox-same-as-registered"
                    />
                    <label
                      htmlFor="same-as-registered"
                      className="text-sm font-medium leading-none cursor-pointer select-none"
                    >
                      Operating address is the same as the registered address
                    </label>
                  </div>
                  {!sameAsRegistered && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="op-line1">Street Address *</Label>
                        <Input
                          id="op-line1"
                          placeholder="123 Business Street"
                          value={formData.operatingAddress.line1}
                          onChange={(e) => updateOperatingAddress("line1", e.target.value)}
                          data-testid="input-operating-address-line1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="op-line2">Address Line 2</Label>
                        <Input
                          id="op-line2"
                          placeholder="Suite, floor, building name (optional)"
                          value={formData.operatingAddress.line2}
                          onChange={(e) => updateOperatingAddress("line2", e.target.value)}
                          data-testid="input-operating-address-line2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="op-city">City *</Label>
                          <Input
                            id="op-city"
                            placeholder="Lagos"
                            value={formData.operatingAddress.city}
                            onChange={(e) => updateOperatingAddress("city", e.target.value)}
                            data-testid="input-operating-address-city"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="op-state">State *</Label>
                          <Select
                            value={formData.operatingAddress.state}
                            onValueChange={(v) => updateOperatingAddress("state", v)}
                          >
                            <SelectTrigger data-testid="select-operating-address-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {nigerianStates.map((state) => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="op-postal">Postal Code</Label>
                        <Input
                          id="op-postal"
                          placeholder="e.g. 100001"
                          value={formData.operatingAddress.postalCode}
                          onChange={(e) => updateOperatingAddress("postalCode", e.target.value)}
                          data-testid="input-operating-address-postal"
                        />
                      </div>
                    </>
                  )}
                  {sameAsRegistered && formData.registeredAddress.line1 && (
                    <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground space-y-0.5">
                      <p className="font-medium text-foreground">Copied from registered address</p>
                      <p>{formData.registeredAddress.line1}{formData.registeredAddress.line2 ? `, ${formData.registeredAddress.line2}` : ""}</p>
                      <p>{formData.registeredAddress.city}, {formData.registeredAddress.state}{formData.registeredAddress.postalCode ? ` ${formData.registeredAddress.postalCode}` : ""}</p>
                      <p>{formData.registeredAddress.country}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* F1: Company Secretary step */}
            {currentStep === 6 && (
              <div className="space-y-6" data-testid="step-secretary">
                <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3 text-sm">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">
                      Under CAMA 2020, a Public Limited Company (PLC) must have a company secretary.
                      For Private Limited Companies (LTD/SMC), appointing a secretary is optional but recommended for good governance.
                    </p>
                    {formData.companyType === "PLC" && (
                      <p className="text-destructive text-xs mt-1 font-medium">Required for PLC — you must appoint a company secretary.</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3">
                  {[
                    { value: "skip" as const, label: "Skip for now", description: "I'll appoint a company secretary after incorporation." },
                    { value: "appoint" as const, label: "Appoint an existing member", description: "One of the declared directors will also serve as company secretary." },
                    { value: "invite" as const, label: "Invite a new person", description: "Send an invitation email to an external company secretary." },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        secretaryMode === opt.value ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                      }`}
                      onClick={() => setSecretaryMode(opt.value)}
                      data-testid={`secretary-mode-${opt.value}`}
                    >
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  ))}
                </div>

                {secretaryMode === "appoint" && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-medium">Select from declared team members</p>
                    {directors.filter(d => d.role !== "secretary").length === 0 ? (
                      <p className="text-sm text-muted-foreground">No team members declared yet. Please go back to Step 4 to add directors first.</p>
                    ) : (
                      <div className="space-y-2">
                        {directors.filter(d => d.role !== "secretary").map(d => (
                          <div
                            key={d.localId}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                              secretaryName === (d.fullName || d.inviteEmail || "") ? "border-primary bg-primary/5" : ""
                            }`}
                            onClick={() => {
                              setSecretaryName(d.fullName || d.inviteEmail || "");
                              setSecretaryEmail(d.inviteEmail || "");
                            }}
                            data-testid={`appoint-secretary-${d.localId}`}
                          >
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Users className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{d.personType === "corporate" ? d.corporateName : (d.fullName || d.inviteEmail)}</p>
                              <p className="text-xs text-muted-foreground capitalize">{d.role.replace(/_/g, " ")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {secretaryMode === "invite" && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-medium">Company Secretary Details</p>
                    <div className="space-y-2">
                      <Label htmlFor="secretary-name">Full Name</Label>
                      <Input
                        id="secretary-name"
                        placeholder="e.g., Adaeze Okonkwo"
                        value={secretaryName}
                        onChange={e => setSecretaryName(e.target.value)}
                        data-testid="input-secretary-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secretary-email">Email Address</Label>
                      <Input
                        id="secretary-email"
                        type="email"
                        placeholder="secretary@example.com"
                        value={secretaryEmail}
                        onChange={e => setSecretaryEmail(e.target.value)}
                        data-testid="input-secretary-email"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      An invitation email will be sent after incorporation payment is confirmed.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveAndExit}
                  disabled={saveDraftMutation.isPending}
                  data-testid="button-save-draft"
                >
                  {saveDraftMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save & Exit
                </Button>
                {currentStep === 2 && !resumeApplicationId ? (
                  <Button
                    type="button"
                    onClick={() => submitNameCheckMutation.mutate()}
                    disabled={!canProceed() || submitNameCheckMutation.isPending}
                    data-testid="button-submit-name-check"
                  >
                    {submitNameCheckMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit for Name Check
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed() || createMutation.isPending || resumeCreateMutation.isPending}
                    data-testid="button-next"
                  >
                    {(createMutation.isPending || resumeCreateMutation.isPending) ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Saving...
                      </>
                    ) : currentStep === 6 ? (
                      resumeApplicationId ? "Complete Application" : "Create Application"
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
