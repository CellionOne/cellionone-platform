import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Building2,
  Plus,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
  Layers,
  ScanFace,
  Camera,
  CheckCircle2,
  ChevronRight,
  Info,
  FileText,
} from "lucide-react";
import type { KycOrganisation } from "@shared/schema";

interface OrgWithRole extends KycOrganisation {
  memberRole?: string;
}

type ProfileMode = "full_hosted" | "prefill_selfie" | "selfie_only" | "data_collection";

function deriveProfile(hasIdentity: boolean, hasDocument: boolean, needsBiometric: boolean): ProfileMode {
  if (!needsBiometric) return "data_collection";
  if (hasIdentity && hasDocument) return "selfie_only";
  if (hasIdentity) return "prefill_selfie";
  return "full_hosted";
}

const PROFILE_LABELS: Record<ProfileMode, { label: string; description: string; steps: string[]; icon: any; color: string; timing: string }> = {
  full_hosted: {
    label: "Full Hosted",
    description: "Subjects will provide their name, date of birth, ID document, and a liveness selfie.",
    steps: ["Identity details", "ID document upload", "Liveness selfie"],
    icon: Layers,
    color: "text-amber-600 dark:text-amber-400",
    timing: "Webhook",
  },
  prefill_selfie: {
    label: "Prefill + Selfie",
    description: "Subjects will upload their ID document and take a liveness selfie. You supply their name and DOB via the API.",
    steps: ["ID document upload", "Liveness selfie"],
    icon: ScanFace,
    color: "text-blue-600 dark:text-blue-400",
    timing: "Webhook",
  },
  selfie_only: {
    label: "Selfie Only",
    description: "Subjects only take a liveness selfie. You supply all identity data via the API — fastest experience.",
    steps: ["Liveness selfie only"],
    icon: Camera,
    color: "text-green-600 dark:text-green-400",
    timing: "Webhook",
  },
  data_collection: {
    label: "Data Collection",
    description: "Subjects provide their identity details and upload their ID document. No selfie required — results are returned instantly.",
    steps: ["Identity details", "ID document upload"],
    icon: FileText,
    color: "text-violet-600 dark:text-violet-400",
    timing: "Instant",
  },
};

export default function KycOrgsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<1 | 2>(1);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("corporate");
  const [contactEmail, setContactEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [hasIdentityData, setHasIdentityData] = useState<boolean | null>(null);
  const [hasDocumentData, setHasDocumentData] = useState<boolean | null>(null);
  const [needsBiometric, setNeedsBiometric] = useState<boolean | null>(null);

  const { data: orgs, isLoading } = useQuery<OrgWithRole[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/kyc-service/organisations", data);
      return res.json();
    },
    onSuccess: (org: KycOrganisation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations"] });
      setCreateDialogOpen(false);
      resetForm();
      navigate(`/kyc/org/${org.id}`);
      toast({ title: "Organisation created", description: "Your integration profile is saved. Generate an API key to start creating verification sessions." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create organisation", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setName("");
    setCategory("corporate");
    setContactEmail("");
    setTermsAccepted(false);
    setHasIdentityData(null);
    setHasDocumentData(null);
    setNeedsBiometric(null);
    setDialogStep(1);
  }

  function handleOpenChange(open: boolean) {
    setCreateDialogOpen(open);
    if (!open) resetForm();
  }

  function handleCreate() {
    const hasId = hasIdentityData ?? false;
    const hasDoc = hasDocumentData ?? false;
    const biometric = needsBiometric ?? true;
    const mode = deriveProfile(hasId, hasDoc, biometric);
    const requiresBiometric = mode !== "data_collection";
    const resultTiming = requiresBiometric ? "webhook" : "instant";
    createMutation.mutate({
      name,
      category,
      contactEmail,
      termsAccepted,
      integrationProfile: { mode, requiresBiometric, resultTiming, configuredAt: new Date().toISOString() },
    });
  }

  const step1Valid = name.trim().length >= 2 && contactEmail.trim().length > 0 && termsAccepted;

  const step2Q1Done = hasIdentityData !== null;
  const step2Q2Done = !hasIdentityData || hasDocumentData !== null;
  const step2Q3Done = needsBiometric !== null;
  const step2Valid = step2Q1Done && step2Q2Done && step2Q3Done;

  const derivedProfile = step2Valid
    ? deriveProfile(hasIdentityData ?? false, hasDocumentData ?? false, needsBiometric ?? true)
    : null;

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service" }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-kyc-service-title">KYC Service</h1>
            <p className="text-muted-foreground text-sm">Manage your KYC verification organisations</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-org">
                <Plus className="h-4 w-4 mr-2" />
                New Organisation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2",
                    "border-primary bg-primary text-primary-foreground"
                  )}>1</span>
                  <span className={cn("text-xs", dialogStep === 1 ? "text-primary font-medium" : "text-muted-foreground")}>Details</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2",
                    dialogStep === 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground text-muted-foreground"
                  )}>2</span>
                  <span className={cn("text-xs", dialogStep === 2 ? "text-primary font-medium" : "text-muted-foreground")}>Integration</span>
                </div>
                <DialogTitle>{dialogStep === 1 ? "Create Organisation" : "Integration Setup"}</DialogTitle>
                <DialogDescription>
                  {dialogStep === 1
                    ? "Set up a new organisation for KYC verification management."
                    : "Tell us what data your system already holds. This determines which steps your subjects need to complete."}
                </DialogDescription>
              </DialogHeader>

              {dialogStep === 1 && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Organisation Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" data-testid="input-create-name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger data-testid="select-create-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corporate">Corporate</SelectItem>
                          <SelectItem value="government">Government</SelectItem>
                          <SelectItem value="ngo">NGO</SelectItem>
                          <SelectItem value="educational">Educational</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="admin@company.com" data-testid="input-create-email" />
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        data-testid="checkbox-terms"
                      />
                      <Label htmlFor="terms" className="text-sm leading-relaxed">
                        I accept the{" "}
                        <a href="/kyc/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          KYC Service Agreement
                        </a>{" "}
                        on behalf of this organisation.
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={() => setDialogStep(2)} disabled={!step1Valid} data-testid="button-next-step">
                      Next <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </DialogFooter>
                </>
              )}

              {dialogStep === 2 && (
                <>
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Q1. Does your system already hold the subject's name and date of birth?</p>
                        <p className="text-xs text-muted-foreground mt-0.5">e.g. you collected these during sign-up</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ value: true, label: "Yes, we have it" }, { value: false, label: "No, we don't" }].map(({ value, label }) => (
                          <button
                            key={String(value)}
                            type="button"
                            onClick={() => {
                              setHasIdentityData(value);
                              if (!value) setHasDocumentData(null);
                            }}
                            className={cn(
                              "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                              hasIdentityData === value
                                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                : "border-border hover:border-primary/40"
                            )}
                            data-testid={`button-q1-${value ? "yes" : "no"}`}
                          >
                            {hasIdentityData === value && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {hasIdentityData === true && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium">Q2. Does your system also have a copy of their government-issued ID document?</p>
                          <p className="text-xs text-muted-foreground mt-0.5">e.g. you already scanned or stored their passport or NIN card</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[{ value: true, label: "Yes, we have it" }, { value: false, label: "No, we don't" }].map(({ value, label }) => (
                            <button
                              key={String(value)}
                              type="button"
                              onClick={() => setHasDocumentData(value)}
                              className={cn(
                                "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                                hasDocumentData === value
                                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                  : "border-border hover:border-primary/40"
                              )}
                              data-testid={`button-q2-${value ? "yes" : "no"}`}
                            >
                              {hasDocumentData === value && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Q3. Do you need biometric identity matching?</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Biometric matching requires the subject to take a selfie — results are delivered via webhook</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ value: true, label: "Yes, require a selfie" }, { value: false, label: "No, data collection only" }].map(({ value, label }) => (
                          <button
                            key={String(value)}
                            type="button"
                            onClick={() => setNeedsBiometric(value)}
                            className={cn(
                              "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                              needsBiometric === value
                                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                                : "border-border hover:border-primary/40"
                            )}
                            data-testid={`button-q3-${value ? "yes" : "no"}`}
                          >
                            {needsBiometric === value && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {derivedProfile && (() => {
                      const profile = PROFILE_LABELS[derivedProfile];
                      const Icon = profile.icon;
                      return (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4 shrink-0", profile.color)} />
                              <p className="text-sm font-semibold">Recommended: {profile.label}</p>
                            </div>
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                              profile.timing === "Instant"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            )}>
                              {profile.timing} result
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{profile.description}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {profile.steps.map(s => (
                              <span key={s} className="text-xs bg-background border rounded-full px-2 py-0.5">{s}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>You can change this at any time in your organisation settings under the Integration tab.</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogStep(1)} data-testid="button-back-step">
                      <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={!step2Valid || createMutation.isPending}
                      data-testid="button-submit-create-org"
                    >
                      {createMutation.isPending ? <LoadingSpinner className="h-4 w-4 mr-2" /> : null}
                      {createMutation.isPending ? "Creating..." : "Create Organisation"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : !orgs || orgs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organisations yet"
            description="Create your first organisation to start managing KYC verifications."
            action={
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-empty-create-org">
                <Plus className="h-4 w-4 mr-2" />
                Create Organisation
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <Card key={org.id} className="hover-elevate" data-testid={`card-org-${org.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base" data-testid={`text-org-name-${org.id}`}>{org.name}</CardTitle>
                        <CardDescription>{org.category}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="border-0">{org.memberRole?.replace("org_", "") || "member"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{org.status}</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild data-testid={`button-open-org-${org.id}`}>
                      <Link href={`/kyc/org/${org.id}`}>
                        Open
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
