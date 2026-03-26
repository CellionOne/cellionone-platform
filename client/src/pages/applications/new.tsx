import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
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
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { saveDraft, getDraft, deleteDraft, isOnline, onOnlineStatusChange, type ApplicationDraft } from "@/lib/offline-storage";
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
];

interface DirectorEntry {
  localId: string;
  inviteEmail: string;
  role: string;
  sharesAllocated: string;
  shareClass: string;
  sharePercentage: string;
}

const companyTypes = [
  { value: "LTD", label: "Private Limited Company (LTD)", description: "Most common for small to medium businesses" },
  { value: "PLC", label: "Public Limited Company (PLC)", description: "For companies planning to go public" },
  { value: "LLP", label: "Limited Liability Partnership (LLP)", description: "For professional service firms" },
  { value: "Sole_Proprietorship", label: "Business Name (Sole Proprietorship)", description: "For individual business owners" },
];

const nigerianStates = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara"
];

const DRAFT_ID = "new-application-draft";

export default function NewApplicationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [online, setOnline] = useState(isOnline());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [directors, setDirectors] = useState<DirectorEntry[]>([]);
  const [newDirector, setNewDirector] = useState<Omit<DirectorEntry, "localId">>({
    inviteEmail: "",
    role: "director",
    sharesAllocated: "",
    shareClass: "ordinary",
    sharePercentage: "",
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
    },
    useRegisteredOffice: false,
    registeredOfficeTier: "" as "" | "office_only" | "office_plus_mail",
  });
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Fetch registered office options
  const { data: registeredOfficeOptions } = useQuery<{
    tiers: { id: string; name: string; priceNgn: number; description: string; features: string[] }[];
    location: { label: string; city: string; state: string; country: string };
    policyText: string;
    termMonths: number;
  }>({
    queryKey: ["/api/registered-office/options"],
  });

  // Load draft from localStorage on mount
  useEffect(() => {
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
      
      setFormData(prev => ({
        ...prev,
        applicationType: savedDraft.data.applicationType || prev.applicationType,
        companyType: savedDraft.data.companyType || prev.companyType,
        companyName1: savedDraft.data.companyName1 || prev.companyName1,
        companyName2: savedDraft.data.companyName2 || prev.companyName2,
        companyName3: savedDraft.data.companyName3 || prev.companyName3,
        businessDescription: savedDraft.data.businessDescription || prev.businessDescription,
        registeredAddress: restoredAddress,
      }));
      setCurrentStep(savedDraft.step);
      toast({
        title: "Draft restored",
        description: "Your previous draft has been loaded.",
      });
    }
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
      });
      const app = await response.json();
      
      if (data.useRegisteredOffice && data.registeredOfficeTier) {
        await apiRequest("POST", "/api/registered-office/select", {
          applicationId: app.id,
          tier: data.registeredOfficeTier,
        });
      }

      for (const dir of directors) {
        if (!dir.inviteEmail) continue;
        await apiRequest("POST", "/api/company-people", {
          inviteEmail: dir.inviteEmail,
          role: dir.role,
          applicationId: app.id,
          sharesAllocated: dir.sharesAllocated ? parseInt(dir.sharesAllocated, 10) : null,
          shareClass: dir.shareClass || null,
          sharePercentage: dir.sharePercentage || null,
        });
      }
      
      return app;
    },
    onSuccess: async (app) => {
      deleteDraft(DRAFT_ID);
      queryClient.invalidateQueries({ queryKey: ["/api/founder/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people"] });
      toast({
        title: "Application created",
        description: directors.length > 0
          ? `Application saved. Invitation emails sent to ${directors.length} team member${directors.length > 1 ? "s" : ""}.`
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

  const addDirector = () => {
    if (!newDirector.inviteEmail || !newDirector.role) return;
    setDirectors(prev => [...prev, { ...newDirector, localId: crypto.randomUUID() }]);
    setNewDirector({ inviteEmail: "", role: "director", sharesAllocated: "", shareClass: "ordinary", sharePercentage: "" });
  };

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

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!formData.companyType;
      case 2:
        return !!formData.companyName1;
      case 3:
        return !!formData.businessDescription;
      case 4:
        return true;
      case 5:
        if (formData.useRegisteredOffice) {
          return !!formData.registeredOfficeTier;
        }
        return !!formData.registeredAddress.line1 && !!formData.registeredAddress.city && !!formData.registeredAddress.state;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <DashboardLayout 
      role="founder" 
      breadcrumbs={[
        { label: "Dashboard", href: "/founder/dashboard" },
        { label: "Applications", href: "/founder/applications" },
        { label: "New Application" }
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">New Company Registration</h1>
            <p className="text-muted-foreground">
              Complete the following steps to start your company incorporation
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
              </div>
            )}

            {currentStep === 2 && (
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
                <p className="text-sm text-muted-foreground">
                  CAC will check name availability and register the first available option.
                </p>
              </div>
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
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3 text-sm" data-testid="directors-info-banner">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">
                    Add co-founders, directors, and shareholders. Each person will receive an email invitation to complete their profile and identity verification — required before your application can be processed. You can also manage this team later from your dashboard.
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
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{dir.inviteEmail}</p>
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
                  </div>
                )}

                <div className="space-y-4 rounded-lg border p-4" data-testid="add-director-form">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add a Team Member
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
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
                      <Select
                        value={newDirector.role}
                        onValueChange={(v) => setNewDirector(p => ({ ...p, role: v }))}
                      >
                        <SelectTrigger id="dir-role" data-testid="select-director-role">
                          <SelectValue />
                        </SelectTrigger>
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
                      <Select
                        value={newDirector.shareClass}
                        onValueChange={(v) => setNewDirector(p => ({ ...p, shareClass: v }))}
                      >
                        <SelectTrigger id="dir-share-class" data-testid="select-director-share-class">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ordinary">Ordinary</SelectItem>
                          <SelectItem value="preference">Preference</SelectItem>
                          <SelectItem value="redeemable">Redeemable</SelectItem>
                        </SelectContent>
                      </Select>
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDirector}
                    disabled={!newDirector.inviteEmail}
                    className="gap-2"
                    data-testid="button-add-director"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Person
                  </Button>
                </div>

                {directors.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2" data-testid="text-no-directors">
                    No team members added yet. You can add them later from your dashboard if preferred.
                  </p>
                )}
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
                          placeholder="Lagos"
                          value={formData.registeredAddress.city}
                          onChange={(e) => updateAddress("city", e.target.value)}
                          data-testid="input-address-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Select
                          value={formData.registeredAddress.state}
                          onValueChange={(value) => updateAddress("state", value)}
                        >
                          <SelectTrigger data-testid="select-address-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {nigerianStates.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        placeholder="100001"
                        value={formData.registeredAddress.postalCode}
                        onChange={(e) => updateAddress("postalCode", e.target.value)}
                        data-testid="input-address-postal"
                      />
                    </div>
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
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || createMutation.isPending}
                data-testid="button-next"
              >
                {createMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : currentStep === 5 ? (
                  "Create Application"
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
