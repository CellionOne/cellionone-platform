import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  UserPlus,
  Loader2,
  Mail,
  MailCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Trash2,
  ShieldCheck,
  Percent,
  FileCheck,
  Camera,
  PenTool,
  CreditCard,
  Fingerprint,
  Info,
  Building2,
  Eye,
  EyeOff,
  Upload,
  BellRing,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CompanyPerson {
  id: number;
  applicationId: number | null;
  companyProfileId: number | null;
  founderId: string;
  personUserId: string | null;
  inviteEmail: string | null;
  inviteStatus: string | null;
  inviteToken: string | null;
  inviteSentAt: string | null;
  role: string;
  title: string | null;
  sharesAllocated: number | null;
  shareClass: string | null;
  sharePercentage: string | null;
  isVerified: boolean | null;
  createdAt: string;
  entityType?: string | null;
  corporateName?: string | null;
  corporateRcNumber?: string | null;
  corporateBusinessType?: string | null;
  kybLookupStatus?: string | null;
  autoVerifyMethod?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  phoneNumber?: string | null;
  residentialAddress?: string | null;
}

const inviteSchema = z.object({
  inviteEmail: z.string().email("Valid email address required"),
  role: z.string().min(1, "Role is required"),
  title: z.string().optional(),
  sharesAllocated: z.string().optional(),
  shareClass: z.string().optional(),
  sharePercentage: z.string().optional(),
  fullName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  phoneNumber: z.string().optional(),
  nin: z.string().optional(),
  bvn: z.string().optional(),
  residentialAddress: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export default function CompanyPeoplePage() {
  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Directors & Shareholders" }]}
    >
      <div className="max-w-3xl mx-auto space-y-6 p-4 overflow-y-auto h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-company-people-title">
              <Users className="h-6 w-6" /> Directors & Shareholders
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage the directors, shareholders, and company secretary for your company. Each person must create their own account and complete identity verification.
            </p>
          </div>
          <InviteDialog />
        </div>

        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/20">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Invite Person vs. CAC Filing:</strong> Adding someone here invites them to your Cellion One company profile for internal management, KYC, and compliance — it does <em>not</em> register them with the Corporate Affairs Commission. To formally appoint a new director at the CAC, use the{" "}
            <Link href="/founder/registration-services?service=ADD_DIR" className="underline font-medium">
              Add a Director (CAC Filing)
            </Link>{" "}
            service.
          </AlertDescription>
        </Alert>

        <ReadinessSummary />
        <PeopleList />
      </div>
    </DashboardLayout>
  );
}

function InviteDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [personType, setPersonType] = useState<"individual" | "corporate" | "bn" | "it">("individual");
  const [corpForm, setCorpForm] = useState({ corporateName: "", corporateRcNumber: "", corporateCountry: "Nigeria", authorisedRepName: "", repEmail: "", role: "director" });
  const [detailsMode, setDetailsMode] = useState(false);
  const [showNin, setShowNin] = useState(false);
  const [showBvn, setShowBvn] = useState(false);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      inviteEmail: "",
      role: "",
      title: "",
      sharesAllocated: "",
      shareClass: "ordinary",
      sharePercentage: "",
      fullName: "",
      dateOfBirth: "",
      nationality: "Nigeria",
      phoneNumber: "",
      nin: "",
      bvn: "",
      residentialAddress: "",
    },
  });

  interface InviteResponse {
    id: number;
    isVerified?: boolean;
    _deduplicated?: boolean;
    [key: string]: unknown;
  }

  const inviteMutation = useMutation<InviteResponse, Error, Record<string, unknown>>({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/company-people", payload);
      return res.json() as Promise<InviteResponse>;
    },
    onSuccess: (data: InviteResponse) => {
      const isCorp = personType === "corporate" || personType === "bn" || personType === "it";
      const wasAutoVerified = isCorp && data?.isVerified;
      const wasDeduplicated = isCorp && data?._deduplicated;
      let desc = "An email has been sent to the invited person.";
      if (wasDeduplicated) desc = "This entity was already added. Showing existing record.";
      else if (wasAutoVerified) desc = "Entity auto-verified via CAC registry — no invitation needed.";
      else if (isCorp) desc = "Corporate entity added. The authorised rep will receive a verification invite.";
      toast({ title: wasDeduplicated ? "Already added" : "Done", description: desc });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people/readiness"] });
      form.reset();
      setCorpForm({ corporateName: "", corporateRcNumber: "", corporateCountry: "Nigeria", authorisedRepName: "", repEmail: "", role: "director" });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleIndividualSubmit = (data: InviteFormData) => {
    const isFullyDetailed = detailsMode && !!data.fullName?.trim();
    const payload: Record<string, unknown> = {
      inviteEmail: data.inviteEmail,
      role: data.role,
      title: data.title || null,
      shareClass: data.shareClass || null,
      sharePercentage: data.sharePercentage || null,
      entityType: "individual",
    };
    if (data.sharesAllocated) payload.sharesAllocated = parseInt(data.sharesAllocated);
    if (isFullyDetailed) {
      payload.fullName = data.fullName?.trim();
      payload.dateOfBirth = data.dateOfBirth?.trim() || null;
      payload.nationality = data.nationality?.trim() || null;
      payload.phoneNumber = data.phoneNumber?.trim() || null;
      payload.nin = data.nin?.trim() || null;
      payload.bvn = data.bvn?.trim() || null;
      payload.residentialAddress = data.residentialAddress?.trim() || null;
    }
    inviteMutation.mutate(payload);
  };

  const handleCorporateSubmit = () => {
    if (!corpForm.corporateName.trim() || !corpForm.corporateRcNumber.trim() || !corpForm.repEmail.trim()) return;
    const bizType = personType === "bn" ? "bn" : personType === "it" ? "it" : "co";
    inviteMutation.mutate({
      entityType: "corporate",
      corporateBusinessType: bizType,
      corporateName: corpForm.corporateName,
      corporateRcNumber: corpForm.corporateRcNumber,
      corporateCountry: corpForm.corporateCountry || "Nigeria",
      corporateAuthorisedRepName: corpForm.authorisedRepName || null,
      inviteEmail: corpForm.repEmail,
      role: corpForm.role,
      title: corpForm.corporateName,
      deferInvite: false,
    });
  };

  const selectedRole = form.watch("role");
  const showShares = selectedRole === "shareholder" || selectedRole === "director_shareholder";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-invite-person">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Person
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Director / Shareholder</DialogTitle>
          <DialogDescription>
            Add an individual person or a corporate entity to your company.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 rounded-md border p-0.5 bg-muted/40 w-fit flex-wrap" data-testid="toggle-invite-type">
          <button
            type="button"
            onClick={() => setPersonType("individual")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${personType === "individual" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-individual-invite"
          >
            <Users className="h-3 w-3 inline mr-1" />Individual
          </button>
          <button
            type="button"
            onClick={() => setPersonType("corporate")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${personType === "corporate" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-corporate-invite"
          >
            <Building2 className="h-3 w-3 inline mr-1" />Company (RC)
          </button>
          <button
            type="button"
            onClick={() => setPersonType("bn")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${personType === "bn" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-bn-invite"
          >
            <Building2 className="h-3 w-3 inline mr-1" />Business Name (BN)
          </button>
          <button
            type="button"
            onClick={() => setPersonType("it")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${personType === "it" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-it-invite"
          >
            <Building2 className="h-3 w-3 inline mr-1" />Trustee (IT)
          </button>
        </div>

        {personType === "individual" ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleIndividualSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="inviteEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="person@example.com" data-testid="input-invite-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-person-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="director">Director</SelectItem>
                        <SelectItem value="shareholder">Shareholder</SelectItem>
                        <SelectItem value="director_shareholder">Director & Shareholder</SelectItem>
                        <SelectItem value="secretary">Company Secretary</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title / Designation (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Managing Director, Chairman" data-testid="input-person-title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showShares && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="sharesAllocated"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Shares</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g. 500" data-testid="input-shares" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sharePercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentage (%)</FormLabel>
                          <FormControl>
                            <Input type="text" placeholder="e.g. 50" data-testid="input-share-percentage" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="shareClass"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Share Class</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-share-class">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ordinary">Ordinary Shares</SelectItem>
                            <SelectItem value="preference">Preference Shares</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Mode toggle */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 border">
                <div className="flex-1">
                  <p className="text-xs font-medium">{detailsMode ? "Enter all personal details" : "Send invite link"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{detailsMode ? "Full details submitted — person receives a notification email only." : "An invitation link is emailed to the person to fill in their own details."}</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="text-xs shrink-0" onClick={() => setDetailsMode(d => !d)} data-testid="button-toggle-details-mode">
                  {detailsMode ? "Switch to invite" : "Enter details"}
                </Button>
              </div>

              {detailsMode && (
                <div className="space-y-3 rounded-lg border p-3 bg-background">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal Details</p>
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Legal Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="As on official ID" data-testid="input-full-name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl><Input type="date" data-testid="input-dob" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nationality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nationality</FormLabel>
                        <FormControl><Input placeholder="Nigeria" data-testid="input-nationality" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl><Input type="tel" placeholder="+234 800 000 0000" data-testid="input-person-phone" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="nin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIN</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showNin ? "text" : "password"} placeholder="11-digit NIN" maxLength={11} data-testid="input-nin" {...field} className="pr-8" />
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNin(v => !v)}>
                              {showNin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="bvn" render={({ field }) => (
                      <FormItem>
                        <FormLabel>BVN</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showBvn ? "text" : "password"} placeholder="11-digit BVN" maxLength={11} data-testid="input-bvn" {...field} className="pr-8" />
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowBvn(v => !v)}>
                              {showBvn ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="residentialAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residential Address</FormLabel>
                      <FormControl><Textarea placeholder="Full residential address" rows={2} data-testid="input-residential-address" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                  {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : detailsMode ? <BellRing className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {detailsMode ? "Add & Notify" : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {personType === "bn" ? (
                <span>Business Names are verified via the CAC registry. If this business name is already registered on the platform it will be auto-verified. Otherwise, the proprietor's representative receives a verification invite.</span>
              ) : personType === "it" ? (
                <span>Incorporated Trustees are verified via the CAC registry. If this trustee body is already registered on the platform it will be auto-verified. Otherwise, the authorised representative receives a biometric identity verification invite.</span>
              ) : (
                <span>Limited companies are verified via the CAC registry. If this company is already registered on the platform it will be auto-verified. Otherwise, the authorised representative receives a biometric identity verification invite.</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">{personType === "bn" ? "Registered Business Name *" : personType === "it" ? "Registered Trustee Name *" : "Registered Company Name *"}</label>
                <Input className="mt-1" placeholder={personType === "bn" ? "e.g. Acme Ventures" : personType === "it" ? "e.g. Acme Foundation" : "e.g. Acme Holdings Ltd"} value={corpForm.corporateName} onChange={e => setCorpForm(p => ({ ...p, corporateName: e.target.value }))} data-testid="input-corp-name" />
              </div>
              <div>
                <label className="text-sm font-medium">{personType === "bn" ? "BN Number *" : personType === "it" ? "IT Number *" : "RC Number *"}</label>
                <Input className="mt-1" placeholder={personType === "bn" ? "e.g. BN1234567" : personType === "it" ? "e.g. IT12345" : "e.g. RC123456"} value={corpForm.corporateRcNumber} onChange={e => setCorpForm(p => ({ ...p, corporateRcNumber: e.target.value }))} data-testid="input-corp-rc" />
                <p className="text-xs text-muted-foreground mt-1">
                  {personType === "bn" ? "The BN number as it appears on the CAC certificate." : personType === "it" ? "The IT number as it appears on the CAC certificate of incorporation." : "The RC number as it appears on the Certificate of Incorporation."}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select value={corpForm.role} onValueChange={v => setCorpForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-corp-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="shareholder">Shareholder</SelectItem>
                    <SelectItem value="director_shareholder">Director & Shareholder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">{personType === "bn" ? "Proprietor / Representative Name" : "Authorised Representative Name"}</label>
                <Input className="mt-1" placeholder="e.g. Ada Nwosu" value={corpForm.authorisedRepName} onChange={e => setCorpForm(p => ({ ...p, authorisedRepName: e.target.value }))} data-testid="input-corp-rep-name" />
              </div>
              <div>
                <label className="text-sm font-medium">{personType === "bn" ? "Proprietor / Representative Email *" : "Authorised Representative Email *"}</label>
                <Input className="mt-1" type="email" placeholder={personType === "bn" ? "proprietor@example.com" : personType === "it" ? "trustee-rep@example.com" : "rep@acme.com"} value={corpForm.repEmail} onChange={e => setCorpForm(p => ({ ...p, repEmail: e.target.value }))} data-testid="input-corp-rep-email" />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCorporateSubmit}
                disabled={inviteMutation.isPending || !corpForm.corporateName.trim() || !corpForm.corporateRcNumber.trim() || !corpForm.repEmail.trim()}
                data-testid="button-add-corporate"
              >
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                {personType === "bn" ? "Add Business Name" : personType === "it" ? "Add Incorporated Trustee" : "Add Corporate Entity"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ReadinessData {
  people: {
    id: number | string;
    inviteEmail: string | null;
    role: string;
    inviteStatus: string;
    isVerified: boolean;
    personUserId: string | null;
    firstName: string | null;
    lastName: string | null;
    profileCompletion: number;
    isProfileComplete: boolean;
    hasPassportPhoto: boolean;
    hasSignature: boolean;
    hasIdDocument: boolean;
    hasNin: boolean;
    hasBvn: boolean;
    identityExpiresAt: string | null;
    identityDaysUntilExpiry: number | null;
    entityType?: string | null;
    corporateName?: string | null;
    corporateRcNumber?: string | null;
    corporateBusinessType?: string | null;
    kybLookupStatus?: string | null;
    autoVerifyMethod?: string | null;
  }[];
  summary: {
    totalPeople: number;
    readyCount: number;
    allReady: boolean;
  };
}

function ReadinessSummary() {
  const { data: readiness, isLoading } = useQuery<ReadinessData>({
    queryKey: ["/api/company-people/readiness"],
  });

  if (isLoading || !readiness) return null;

  const { summary } = readiness;

  return (
    <Card className={summary.allReady ? "border-green-300 dark:border-green-800" : "border-amber-300 dark:border-amber-800"} data-testid="card-readiness-summary">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Team Readiness</h3>
          <Badge variant={summary.allReady ? "default" : "secondary"}>
            {summary.readyCount} / {summary.totalPeople} ready
          </Badge>
        </div>
        <Progress
          value={(summary.readyCount / summary.totalPeople) * 100}
          className="h-2"
        />
        {summary.allReady ? (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            All team members have completed their profiles. You can proceed to checkout.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            {summary.totalPeople - summary.readyCount} team member(s) still need to complete their profiles before you can proceed to checkout.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileChecklist({ person }: { person: ReadinessData["people"][0] }) {
  if (person.inviteStatus !== "accepted" && person.role !== "founder") return null;

  const items = [
    { label: "Passport Photo", done: person.hasPassportPhoto, icon: Camera },
    { label: "Signature", done: person.hasSignature, icon: PenTool },
    { label: "ID Document", done: person.hasIdDocument, icon: FileCheck },
    { label: "NIN", done: person.hasNin, icon: Fingerprint },
    { label: "BVN", done: person.hasBvn, icon: CreditCard },
  ];

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Profile completion</span>
        <span className="text-xs font-medium">{person.profileCompletion}%</span>
      </div>
      <Progress value={person.profileCompletion} className="h-1.5" />
      <div className="flex flex-wrap gap-2 mt-1">
        {items.map(({ label, done, icon: Icon }) => (
          <div
            key={label}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              done
                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PersonDoc {
  id: number;
  docType: string;
  filename: string;
  storagePath: string;
  createdAt: string;
}

function PersonDocUpload({ personId, onUploaded }: { personId: number; onUploaded: () => void }) {
  const { toast } = useToast();
  const { data: docs, refetch } = useQuery<PersonDoc[]>({
    queryKey: ["/api/company-people", personId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/company-people/${personId}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
  });

  const slots = [
    { docType: "passport_photo", label: "Passport Photo", icon: Camera },
    { docType: "government_id", label: "Government-Issued ID", icon: CreditCard },
    { docType: "signature", label: "Signature Specimen", icon: PenTool },
  ];

  const uploadFile = async (file: File, docType: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docType", docType);
    const res = await fetch(`/api/company-people/${personId}/documents/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Upload failed" }));
      throw new Error(err.message || "Upload failed");
    }
    return res.json();
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Supporting Documents</p>
      <div className="grid grid-cols-1 gap-2">
        {slots.map(({ docType, label, icon: Icon }) => {
          const uploaded = docs?.find(d => d.docType === docType);
          return (
            <div key={docType} className={`flex items-center gap-2 rounded-md border px-3 py-2 ${uploaded ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20" : "border-dashed"}`}>
              {uploaded ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className="text-xs flex-1">{label}</span>
              {uploaded
                ? <span className="text-xs text-green-600 dark:text-green-400">Uploaded</span>
                : (
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await uploadFile(file, docType);
                        await refetch();
                        onUploaded();
                        toast({ title: "Document uploaded", description: `${label} uploaded successfully.` });
                      } catch (err: any) {
                        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                      }
                    }} />
                    <span className="text-xs text-primary underline flex items-center gap-1"><Upload className="h-3 w-3" />Upload</span>
                  </label>
                )
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeopleList() {
  const { toast } = useToast();
  const [docUploadOpenId, setDocUploadOpenId] = useState<number | null>(null);

  const { data: people, isLoading, refetch: refetchPeople } = useQuery<CompanyPerson[]>({
    queryKey: ["/api/company-people"],
  });

  const { data: readiness } = useQuery<ReadinessData>({
    queryKey: ["/api/company-people/readiness"],
  });

  const readinessMap = new Map<number, ReadinessData["people"][0]>();
  if (readiness) {
    for (const person of readiness.people) {
      if (typeof person.id === "number") {
        readinessMap.set(person.id, person);
      }
    }
  }


  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/company-people/resend-invite/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation resent", description: "A reminder email has been sent." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/company-people/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Person removed", description: "The person has been removed from your company." });
      queryClient.invalidateQueries({ queryKey: ["/api/company-people"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!people?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg mb-1">No directors or shareholders yet</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Start by inviting the people who will serve as directors, shareholders, or company secretary for your company. Each person receives an email invitation to create their account and complete their profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "director": return "Director";
      case "shareholder": return "Shareholder";
      case "director_shareholder": return "Director & Shareholder";
      case "secretary": return "Company Secretary";
      default: return role;
    }
  };

  const getAutoVerifyLabel = (method: string | null | undefined) => {
    switch (method) {
      case 'registry': return 'Verified via platform record';
      case 'rep_match': return 'Verified via representative';
      case 'smile_id': return 'Verified via CAC registry';
      case 'smile_id_reuse': return 'Verified via CAC registry (prior lookup)';
      case 'smile_id_live': return 'Verified via CAC registry (live check)';
      default: return 'Platform Verified';
    }
  };

  const getStatusBadge = (person: CompanyPerson, readinessInfo?: ReadinessData["people"][0]) => {
    // Use effective state: raw DB value OR retrospective computed value from readiness
    const effectiveIsVerified = person.isVerified || readinessInfo?.isVerified === true;
    if (effectiveIsVerified) {
      const isCorporateAutoVerified = person.entityType === 'corporate' && (person.autoVerifyMethod || readinessInfo?.autoVerifyMethod);
      const verifyMethod = person.autoVerifyMethod || readinessInfo?.autoVerifyMethod || null;

      if (isCorporateAutoVerified) {
        return (
          <div className="flex items-center gap-1 flex-wrap" title={getAutoVerifyLabel(verifyMethod)}>
            <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600" data-testid={`badge-auto-verified-${person.id}`}>
              <ShieldCheck className="h-3 w-3" /> Profile Ready
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs text-green-700 dark:text-green-400 border-green-300 dark:border-green-700" data-testid={`badge-platform-verified-${person.id}`}>
              Platform Verified
            </Badge>
          </div>
        );
      }

      const days = readinessInfo?.identityDaysUntilExpiry ?? null;
      const expired = days !== null && days <= 0;
      const expiringSoon = days !== null && days > 0 && days <= 30;
      if (expired) {
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
            <Badge variant="destructive" className="gap-1 text-xs" data-testid={`badge-expiry-${person.id}`}>ID Expired</Badge>
          </div>
        );
      }
      if (expiringSoon) {
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
            <Badge variant="secondary" className="gap-1 text-xs border border-yellow-500 text-yellow-700 dark:text-yellow-400" data-testid={`badge-expiry-${person.id}`}>{days}d remaining</Badge>
          </div>
        );
      }
      return <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" /> Verified</Badge>;
    }
    if (person.inviteStatus === "accepted") {
      return <Badge variant="secondary" className="gap-1"><MailCheck className="h-3 w-3" /> Accepted</Badge>;
    }
    if (person.inviteStatus === "notified") {
      return <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"><BellRing className="h-3 w-3" /> Notified</Badge>;
    }
    return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
  };

  return (
    <div className="space-y-3">
      {people.map((person) => (
        <Card key={person.id} data-testid={`card-person-${person.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {person.entityType === "corporate"
                    ? <Building2 className="h-4 w-4 text-primary shrink-0" />
                    : null
                  }
                  <span className="font-medium text-sm">{person.entityType === "corporate" ? (person.corporateName || person.title || person.inviteEmail) : (person.fullName || person.inviteEmail)}</span>
                  {person.entityType === "corporate" && (
                    <Badge variant="secondary" className="text-xs" data-testid={`badge-corporate-person-${person.id}`}>
                      {person.corporateBusinessType === "bn" ? "Business Name" : person.corporateBusinessType === "it" ? "Incorporated Trustee" : "Company"}
                    </Badge>
                  )}
                  {getStatusBadge(person, readinessMap.get(person.id))}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="font-medium text-foreground">{getRoleLabel(person.role)}</span>
                  {person.entityType === 'corporate' && person.corporateRcNumber && (
                    <span className="text-muted-foreground">
                      {person.corporateBusinessType === 'bn' ? 'BN' : person.corporateBusinessType === 'it' ? 'IT' : 'RC'} {person.corporateRcNumber}
                    </span>
                  )}
                  {person.entityType !== 'corporate' && person.title && <span>{person.title}</span>}
                  {person.sharesAllocated && (
                    <span className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      {person.sharesAllocated} shares ({person.sharePercentage || "—"}%)
                    </span>
                  )}
                  {person.shareClass && <span>{person.shareClass} shares</span>}
                </div>
                {readinessMap.has(person.id) && (
                  <ProfileChecklist person={readinessMap.get(person.id)!} />
                )}
                {docUploadOpenId === person.id && person.entityType !== "corporate" && (
                  <PersonDocUpload personId={person.id} onUploaded={() => refetchPeople()} />
                )}
              </div>
              <div className="flex items-center gap-1">
                {person.entityType !== "corporate" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDocUploadOpenId(docUploadOpenId === person.id ? null : person.id)}
                    data-testid={`button-docs-${person.id}`}
                    title="Upload supporting documents"
                  >
                    {docUploadOpenId === person.id ? <ChevronUp className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  </Button>
                )}
                {person.inviteStatus === "pending" && !readinessMap.get(person.id)?.isVerified && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resendMutation.mutate(person.id)}
                    disabled={resendMutation.isPending}
                    data-testid={`button-resend-${person.id}`}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid={`button-remove-${person.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove this person?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove {person.inviteEmail} as {getRoleLabel(person.role).toLowerCase()} from your company. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(person.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <strong>How it works:</strong> Each person you invite receives an email with a link to create their Cellion One account. Once they sign up and complete their personal profile, they can be individually verified. Identity verification covers BVN/NIN validation, document verification, biometric selfie matching, and AML screening — handled by Cellion at no extra cost to you.
      </div>
    </div>
  );
}
