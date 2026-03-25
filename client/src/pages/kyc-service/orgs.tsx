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
  Timer,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import type { KycOrganisation } from "@shared/schema";

interface OrgWithRole extends KycOrganisation {
  memberRole?: string;
}

type ProfileMode = "full_hosted" | "prefill_selfie" | "selfie_only";

const INTEGRATION_PROFILES: {
  mode: ProfileMode;
  label: string;
  description: string;
  steps: string[];
  timing: string;
  timingColor: string;
  icon: any;
}[] = [
  {
    mode: "full_hosted",
    label: "Full Hosted",
    description: "Your system has no prior data. The subject provides their name, date of birth, ID document, and a liveness selfie.",
    steps: ["Identity details", "ID document", "Liveness selfie"],
    timing: "~2–5 min",
    timingColor: "text-amber-600 dark:text-amber-400",
    icon: Layers,
  },
  {
    mode: "prefill_selfie",
    label: "Prefill + Selfie",
    description: "Your system supplies the subject's name and date of birth. The subject only uploads their ID document and takes a selfie.",
    steps: ["ID document", "Liveness selfie"],
    timing: "~1–2 min",
    timingColor: "text-blue-600 dark:text-blue-400",
    icon: ScanFace,
  },
  {
    mode: "selfie_only",
    label: "Selfie Only",
    description: "Your system has all document data. The subject only takes a liveness selfie for biometric matching — fastest experience.",
    steps: ["Liveness selfie only"],
    timing: "~30 sec",
    timingColor: "text-green-600 dark:text-green-400",
    icon: Camera,
  },
];

export default function KycOrgsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<1 | 2>(1);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("corporate");
  const [contactEmail, setContactEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileMode | null>("full_hosted");

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
      toast({ title: "Organisation created", description: "Your integration profile has been saved. Create your first API key to get started." });
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
    setSelectedProfile("full_hosted");
    setDialogStep(1);
  }

  function handleOpenChange(open: boolean) {
    setCreateDialogOpen(open);
    if (!open) resetForm();
  }

  function handleCreate() {
    if (!selectedProfile) return;
    createMutation.mutate({
      name,
      category,
      contactEmail,
      termsAccepted,
      integrationProfile: { mode: selectedProfile, configuredAt: new Date().toISOString() },
    });
  }

  const step1Valid = name.trim().length >= 2 && contactEmail.trim().length > 0 && termsAccepted;

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
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      dialogStep === 1 ? "border-primary bg-primary text-primary-foreground" : "border-primary bg-primary text-primary-foreground"
                    )}>1</span>
                    <span className={cn("text-xs", dialogStep === 1 ? "text-primary font-medium" : "text-muted-foreground")}>Details</span>
                    <ChevronRight className="h-3 w-3 mx-1" />
                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      dialogStep === 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                    )}>2</span>
                    <span className={cn("text-xs", dialogStep === 2 ? "text-primary font-medium" : "text-muted-foreground")}>Integration</span>
                  </div>
                </div>
                <DialogTitle>{dialogStep === 1 ? "Create Organisation" : "Integration Profile"}</DialogTitle>
                <DialogDescription>
                  {dialogStep === 1
                    ? "Set up a new organisation for KYC verification management."
                    : "Choose how the hosted verification wizard works for your subjects. You can change this later in settings."}
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
                    <Button
                      onClick={() => setDialogStep(2)}
                      disabled={!step1Valid}
                      data-testid="button-next-step"
                    >
                      Next
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </DialogFooter>
                </>
              )}

              {dialogStep === 2 && (
                <>
                  <div className="space-y-3">
                    {INTEGRATION_PROFILES.map((profile) => {
                      const Icon = profile.icon;
                      const isSelected = selectedProfile === profile.mode;
                      return (
                        <div
                          key={profile.mode}
                          onClick={() => setSelectedProfile(profile.mode)}
                          className={cn(
                            "cursor-pointer rounded-lg border p-3 transition-all",
                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                          )}
                          data-testid={`card-onboard-profile-${profile.mode}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn("p-1.5 rounded-md shrink-0 transition-colors", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm">{profile.label}</p>
                                {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{profile.description}</p>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <div className="flex items-center gap-1">
                                  <Timer className={cn("h-3 w-3", profile.timingColor)} />
                                  <span className={cn("text-xs font-medium", profile.timingColor)}>{profile.timing}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {profile.steps.map((s) => (
                                    <span key={s} className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{s}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogStep(1)} data-testid="button-back-step">
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={!selectedProfile || createMutation.isPending}
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
