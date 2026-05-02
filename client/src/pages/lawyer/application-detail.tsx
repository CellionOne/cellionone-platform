import { useState, useEffect, type ReactNode } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner, LoadingPage } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
  Shield,
  FileCheck,
  Send,
  Sparkles,
  ArrowLeft,
  Eye,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  MapPin,
  Mail,
  Download,
  ShieldCheck,
  Loader2,
  Users,
  XCircle,
  TrendingUp,
  ChevronRight,
  Hash,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Calendar,
  ImageIcon,
  PenLine,
  FileImage,
  FilePlus2,
  Inbox,
} from "lucide-react";
import type { 
  CompanyApplication, 
  ApplicationChecklistItem, 
  Payment, 
  ClarificationRequest,
  ExecutionDeclaration,
  DocumentFile,
  CompanyPerson,
  LawyerDocumentRequest,
} from "@shared/schema";
import { insertClarificationRequestSchema } from "@shared/schema";

interface RegisteredOfficeInfo {
  subscription: {
    id: number;
    tier: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    useAsRegisteredAddress: boolean | null;
    registeredAddressConfirmedAt: string | null;
    registeredAddressConsentText: string | null;
    proofOfAddressStatus: string | null;
  };
  address: {
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string | null;
    country: string;
  } | null;
}

interface FounderKyc {
  status: string;
  bvnNinVerified: boolean | null;
  docSubmitted: boolean;
  biometricSubmitted: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
  method: string | null;
  externalProvider: string | null;
}

interface PersonVerificationStep {
  status: string | null;
  bvnNinVerified: boolean | null;
  docSubmitted: boolean;
  biometricSubmitted: boolean;
  verifiedAt: string | null;
}

type EnrichedPerson = Omit<CompanyPerson, "inviteToken"> & {
  verificationStep: PersonVerificationStep | null;
  displayName: string | null;
};

interface ApplicationDetailData {
  application: CompanyApplication;
  checklist: ApplicationChecklistItem[];
  payment: Payment | null;
  clarifications: ClarificationRequest[];
  documents: DocumentFile[];
  registeredOffice: RegisteredOfficeInfo | null;
  people: EnrichedPerson[];
  founderKyc: FounderKyc | null;
}

function NameAvailabilityReviewPanel({ applicationId, application }: { applicationId: number; application: CompanyApplication }) {
  const { toast } = useToast();
  const [name1Avail, setName1Avail] = useState("");
  const [name2Avail, setName2Avail] = useState("");
  const [name3Avail, setName3Avail] = useState("");
  const [saved, setSaved] = useState(false);

  const availabilityOptions = [
    { value: "available", label: "Available" },
    { value: "unavailable", label: "Unavailable" },
    { value: "similar_found", label: "Similar Found" },
  ];

  const saveAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/applications/${applicationId}/name-availability`, {
        name1Availability: name1Avail || undefined,
        name2Availability: application.companyName2 ? (name2Avail || undefined) : undefined,
        name3Availability: application.companyName3 ? (name3Avail || undefined) : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId] });
      toast({ title: "Availability saved", description: "The founder has been notified to select their preferred name." });
      setSaved(true);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save availability.", variant: "destructive" });
    },
  });

  const canSave = !!name1Avail && (!application.companyName2 || !!name2Avail) && (!application.companyName3 || !!name3Avail);

  const nameEntries = [
    { name: application.companyName1, label: "Preferred Name", value: name1Avail, setter: setName1Avail },
    application.companyName2 ? { name: application.companyName2, label: "Alternative 1", value: name2Avail, setter: setName2Avail } : null,
    application.companyName3 ? { name: application.companyName3, label: "Alternative 2", value: name3Avail, setter: setName3Avail } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  if (saved) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            Name Availability Submitted
          </CardTitle>
          <CardDescription>Results recorded. The founder has been notified to select their preferred name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {nameEntries.map(item => (
            <div key={item.name} className="flex items-center justify-between text-sm p-2 rounded border bg-background">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground capitalize">{item.value.replace("_", " ")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          CAC Name Availability Review
        </CardTitle>
        <CardDescription>
          Check these names against the CAC registry and record the availability for each option.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nameEntries.map((item) => (
          <div key={item.name} className="flex items-center gap-4 p-3 rounded-lg border bg-background">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-medium text-sm">{item.name}</p>
            </div>
            <Select value={item.value} onValueChange={item.setter}>
              <SelectTrigger className="w-44" data-testid={`select-availability-${item.name}`}>
                <SelectValue placeholder="Select result…" />
              </SelectTrigger>
              <SelectContent>
                {availabilityOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button
          onClick={() => saveAvailabilityMutation.mutate()}
          disabled={!canSave || saveAvailabilityMutation.isPending}
          data-testid="button-save-availability"
        >
          {saveAvailabilityMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save &amp; Notify Founder
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function LawyerApplicationDetail() {
  const [, params] = useRoute("/lawyer/applications/:id");
  const { toast } = useToast();
  const applicationId = params?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, error } = useQuery<ApplicationDetailData>({
    queryKey: ["/api/applications", applicationId],
    enabled: !!applicationId,
  });

  const { data: declarations } = useQuery<ExecutionDeclaration[]>({
    queryKey: ["/api/applications", applicationId, "execution-declarations"],
    enabled: !!applicationId,
  });

  if (isLoading) return <LoadingPage />;

  if (error) {
    return (
      <DashboardLayout role="lawyer" breadcrumbs={[{ label: "Error" }]}>
        <div className="text-center py-12" data-testid="error-state">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Failed to load application</h2>
          <p className="text-muted-foreground mt-2">Please try again later</p>
          <Button variant="ghost" asChild className="mt-4" data-testid="btn-back-error">
            <Link href="/lawyer/applications">Back to Cases</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.application) {
    return (
      <DashboardLayout role="lawyer" breadcrumbs={[{ label: "Application Not Found" }]}>
        <div className="text-center py-12" data-testid="not-found-state">
          <h2 className="text-xl font-semibold">Application not found</h2>
          <Button variant="ghost" asChild className="mt-4" data-testid="btn-back-notfound">
            <Link href="/lawyer/applications">Back to Cases</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { application, checklist, payment, clarifications, documents, registeredOffice, people, founderKyc } = data;

  return (
    <DashboardLayout 
      role="lawyer" 
      breadcrumbs={[
        { label: "Dashboard", href: "/lawyer/dashboard" },
        { label: "Assigned Cases", href: "/lawyer/applications" },
        { label: application.companyName1 || "Application" }
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="btn-back">
            <Link href="/lawyer/applications">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex flex-1 flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{application.companyName1 || "Untitled Application"}</h1>
                <p className="text-muted-foreground">
                  {application.applicationType === "incorporation" ? "Company Incorporation" : "Post-Incorporation"} 
                  {" "}&bull;{" "}
                  Application #{application.id}
                  {application.rcNumber && (
                    <> &bull; <span className="font-medium text-primary">RC {application.rcNumber}</span></>
                  )}
                </p>
              </div>
            </div>
            <StatusBadge status={application.status || "draft"} className="text-sm" />
          </div>
        </div>

        {application.status === 'names_submitted' && (
          <NameAvailabilityReviewPanel
            applicationId={parseInt(applicationId!)}
            application={application}
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-container">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Eye className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="people" data-testid="tab-people">
              <Users className="h-4 w-4 mr-2" />
              People
              {people && people.length > 0 && (
                <Badge variant="secondary" className="ml-2">{people.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="clarifications" data-testid="tab-clarifications">
              <MessageSquare className="h-4 w-4 mr-2" />
              Clarifications
              {clarifications.filter(c => c.status === "pending").length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {clarifications.filter(c => c.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="execution" data-testid="tab-execution">
              <Shield className="h-4 w-4 mr-2" />
              Execution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <OverviewTab 
              application={application} 
              checklist={checklist} 
              payment={payment}
              registeredOffice={registeredOffice}
              people={people || []}
              founderKyc={founderKyc || null}
            />
          </TabsContent>

          <TabsContent value="people" className="space-y-6 mt-6">
            <PeopleTab people={people || []} applicationId={parseInt(applicationId!)} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-6">
            <DocumentsTab 
              applicationId={parseInt(applicationId!)} 
              checklist={checklist}
              documents={documents || []}
              operatingAddress={application.operatingAddress}
              addressVerificationStatus={application.addressVerificationStatus}
            />
          </TabsContent>

          <TabsContent value="clarifications" className="space-y-6 mt-6">
            <ClarificationsTab 
              applicationId={parseInt(applicationId!)}
              clarifications={clarifications}
            />
          </TabsContent>

          <TabsContent value="execution" className="space-y-6 mt-6">
            <ExecutionTab 
              applicationId={parseInt(applicationId!)}
              declarations={declarations || []}
              application={application}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function OverviewTab({ 
  application, 
  checklist, 
  payment,
  registeredOffice,
  people,
  founderKyc,
}: { 
  application: CompanyApplication; 
  checklist: ApplicationChecklistItem[];
  payment: Payment | null;
  registeredOffice: RegisteredOfficeInfo | null;
  people: EnrichedPerson[];
  founderKyc: FounderKyc | null;
}) {
  const { toast } = useToast();
  const completedDocs = checklist.filter(item => item.status === "provided" || item.status === "accepted").length;
  const totalDocs = checklist.length;

  const poaDownloadMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      const res = await apiRequest("GET", `/api/lawyer/registered-office/${subscriptionId}/proof-of-address`);
      return res.json() as Promise<{ downloadUrl: string }>;
    },
    onSuccess: (result) => {
      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: (error: Error) => {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
    },
  });

  const getRegisteredOfficeBadge = (status: string) => {
    switch (status) {
      case "active":
      case "beta_activated":
        return <Badge className="bg-primary gap-1"><CheckCircle2 className="h-3 w-3" />Active</Badge>;
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "expired":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case "office_only": return "Office Only";
      case "office_plus_mail": return "Office + Mail";
      default: return tier;
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label className="text-muted-foreground text-sm">Company Name</Label>
              <p className="font-medium">{application.companyName1 || "—"}</p>
            </div>
            {application.companyName2 && (
              <div>
                <Label className="text-muted-foreground text-sm">Alternative Name</Label>
                <p className="font-medium">{application.companyName2}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground text-sm">Company Type</Label>
              <p className="font-medium">{application.companyType || "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Business Description</Label>
              <p className="font-medium">{application.businessDescription || "—"}</p>
            </div>
            {application.selectedActivities && application.selectedActivities.length > 0 && (
              <div>
                <Label className="text-muted-foreground text-sm">CAC Activities</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {application.selectedActivities.map((activity: string, i: number) => (
                    <Badge key={i} variant="secondary">{activity}</Badge>
                  ))}
                </div>
              </div>
            )}
            {(() => {
              const shareholders = people.filter(p => p.role === "shareholder" || p.role === "director_shareholder");
              const fallbackShareholders = (application.shareholdersData || []) as Array<{ name: string; shares?: number; percentage?: number }>;
              const hasPeople = shareholders.length > 0;
              const hasFallback = fallbackShareholders.length > 0;
              if (!hasPeople && !hasFallback && !application.shareCapital) return null;

              // Derive total shares from company_people when shareCapital is not set
              const derivedTotalShares = hasPeople
                ? shareholders.reduce((sum, p) => sum + (p.sharesAllocated || 0), 0)
                : hasFallback
                ? fallbackShareholders.reduce((sum, s) => sum + (s.shares || 0), 0)
                : 0;

              return (
                <div className="mt-1 pt-3 border-t" data-testid="shareholding-summary">
                  <Label className="text-muted-foreground text-sm flex items-center gap-1 mb-2">
                    <TrendingUp className="h-3 w-3" />
                    Share Capital & Shareholding
                  </Label>
                  {application.shareCapital ? (
                    <p className="text-sm font-medium mb-2">
                      Authorised Capital: ₦{Number(application.shareCapital).toLocaleString()}
                    </p>
                  ) : derivedTotalShares > 0 ? (
                    <p className="text-sm font-medium mb-2 text-muted-foreground" data-testid="derived-share-total">
                      Total Shares Allocated: {derivedTotalShares.toLocaleString()} (authorised capital not recorded)
                    </p>
                  ) : null}
                  {hasPeople ? (
                    <div className="text-xs space-y-1">
                      {shareholders.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 py-0.5">
                          <span className="text-foreground truncate">
                            {p.entityType === "corporate" ? p.corporateName : (p.displayName || p.inviteEmail || "—")}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                            {p.shareClass && <span>{p.shareClass}</span>}
                            {p.sharesAllocated && <span>{p.sharesAllocated.toLocaleString()} shares</span>}
                            {p.sharePercentage && <span className="font-medium text-foreground">{p.sharePercentage}%</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : hasFallback ? (
                    <div className="text-xs space-y-1">
                      {fallbackShareholders.map((s, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                          <span className="text-foreground truncate">{s.name}</span>
                          <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                            {s.shares && <span>{s.shares.toLocaleString()} shares</span>}
                            {s.percentage && <span className="font-medium text-foreground">{s.percentage}%</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()}
            {registeredOffice?.address && (registeredOffice.subscription.status === "active" || registeredOffice.subscription.status === "beta_activated") ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="registered-office-section">
                <div className="flex items-start justify-between mb-2">
                  <Label className="text-muted-foreground text-sm flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Registered Office (Cellion One)
                  </Label>
                  <div className="flex items-center gap-2">
                    {registeredOffice.subscription.tier === "office_plus_mail" && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Mail className="h-3 w-3" />
                        Mail
                      </Badge>
                    )}
                    {getRegisteredOfficeBadge(registeredOffice.subscription.status)}
                  </div>
                </div>
                <p className="font-medium">{registeredOffice.address.label}</p>
                <p className="text-sm text-muted-foreground">
                  {registeredOffice.address.line1}
                  {registeredOffice.address.line2 && `, ${registeredOffice.address.line2}`}
                  <br />
                  {registeredOffice.address.city}, {registeredOffice.address.state} {registeredOffice.address.postalCode}
                  <br />
                  {registeredOffice.address.country}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Tier: {getTierLabel(registeredOffice.subscription.tier)}</span>
                  {registeredOffice.subscription.endDate && (
                    <span>Expires: {new Date(registeredOffice.subscription.endDate).toLocaleDateString()}</span>
                  )}
                </div>
                {registeredOffice.subscription.useAsRegisteredAddress && (
                  <div className="mt-3 pt-3 border-t border-primary/20 space-y-2">
                    {registeredOffice.subscription.registeredAddressConfirmedAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-app-consent-record">
                        <ShieldCheck className="h-3 w-3 text-primary flex-shrink-0" />
                        <span>
                          Founder consented on{" "}
                          {new Date(registeredOffice.subscription.registeredAddressConfirmedAt).toLocaleDateString("en-NG", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {registeredOffice.subscription.proofOfAddressStatus === "verified" && (
                      <div className="space-y-2" data-testid="poa-download-section">
                        <p className="text-xs text-muted-foreground">
                          Utility bill provided by the virtual office provider — use for CAC filing
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => poaDownloadMutation.mutate(registeredOffice.subscription.id)}
                          disabled={poaDownloadMutation.isPending}
                          data-testid="button-download-poa-app"
                        >
                          {poaDownloadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download Proof of Address
                        </Button>
                      </div>
                    )}
                    {registeredOffice.subscription.proofOfAddressStatus === "uploaded" && (
                      <p className="text-xs text-muted-foreground">
                        Utility bill uploaded, pending verification by admin.
                      </p>
                    )}
                    {registeredOffice.subscription.proofOfAddressStatus === "pending" && (
                      <p className="text-xs text-muted-foreground">
                        Waiting for admin to upload the utility bill.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : registeredOffice?.subscription ? (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20 p-4" data-testid="registered-office-pending">
                <div className="flex items-start justify-between mb-2">
                  <Label className="text-muted-foreground text-sm flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Registered Office (Cellion One)
                  </Label>
                  {getRegisteredOfficeBadge(registeredOffice.subscription.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Address details will be available once subscription is activated
                </p>
              </div>
            ) : application.registeredAddress ? (
              <div>
                <Label className="text-muted-foreground text-sm">Registered Address (Custom)</Label>
                <p className="font-medium">
                  {[
                    application.registeredAddress.line1,
                    application.registeredAddress.line2,
                    application.registeredAddress.city,
                    application.registeredAddress.state,
                    application.registeredAddress.postalCode
                  ].filter(Boolean).join(", ")}
                </p>
              </div>
            ) : null}
            {application.operatingAddress && (
              <div className="mt-3 pt-3 border-t">
                <Label className="text-muted-foreground text-sm">Operating Address</Label>
                <p className="font-medium">
                  {[
                    application.operatingAddress.line1,
                    application.operatingAddress.line2,
                    application.operatingAddress.city,
                    application.operatingAddress.state,
                    application.operatingAddress.postalCode,
                  ].filter(Boolean).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cross-reference the uploaded Proof of Operating Address against this address.
                </p>
                {application.addressVerificationStatus && application.addressVerificationStatus !== "none" && (
                  <div className="mt-1.5">
                    {application.addressVerificationStatus === "verified" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                        Field agent confirmed address
                      </span>
                    )}
                    {application.addressVerificationStatus === "not_verified" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                        Field agent could not confirm address
                      </span>
                    )}
                    {(application.addressVerificationStatus === "submitted" || application.addressVerificationStatus === "agent_assigned") && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        Field agent visit in progress
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Document Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground">{completedDocs} of {totalDocs} uploaded</span>
              <Badge variant={completedDocs === totalDocs ? "default" : "secondary"}>
                {completedDocs === totalDocs ? "Complete" : "In Progress"}
              </Badge>
            </div>
            <div className="space-y-2">
              {checklist.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{item.label}</span>
                  <StatusBadge status={item.status || "missing"} />
                </div>
              ))}
              {checklist.length > 5 && (
                <p className="text-sm text-muted-foreground">
                  +{checklist.length - 5} more documents
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {payment ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={payment.status || "initialized"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">
                    ₦{((payment.amountTotalKobo || 0) / 100).toLocaleString()}
                  </span>
                </div>
                {payment.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Paid On</span>
                    <span>{new Date(payment.paidAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No payment recorded yet</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-founder-kyc">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Founder Identity (KYC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {founderKyc ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Overall Status</span>
                  <Badge
                    variant={founderKyc.status === "verified" ? "default" : founderKyc.status === "rejected" ? "destructive" : "secondary"}
                    className={founderKyc.status === "verified" ? "bg-green-600" : ""}
                    data-testid="badge-kyc-overall"
                  >
                    {founderKyc.status === "verified" ? "Verified" :
                     founderKyc.status === "rejected" ? "Rejected" :
                     founderKyc.status === "in_progress" ? "In Progress" :
                     founderKyc.status === "pending" ? "Pending" : "Not Started"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2" data-testid="kyc-steps">
                  {[
                    {
                      label: "BVN / NIN",
                      done: !!founderKyc.bvnNinVerified,
                      testId: "kyc-step-bvnnin",
                    },
                    {
                      label: "Document",
                      done: founderKyc.docSubmitted,
                      testId: "kyc-step-document",
                    },
                    {
                      label: "Biometric",
                      done: founderKyc.biometricSubmitted,
                      testId: "kyc-step-biometric",
                    },
                    {
                      label: "AML / Sanctions",
                      done: founderKyc.status === "verified",
                      failed: founderKyc.status === "rejected",
                      testId: "kyc-step-aml",
                    },
                  ].map((step) => (
                    <div
                      key={step.label}
                      data-testid={step.testId}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs border ${
                        step.failed
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : step.done
                          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 text-green-800 dark:text-green-300"
                          : "border-muted bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {step.failed ? (
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                      ) : step.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="font-medium">{step.label}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                  {founderKyc.verifiedAt && (
                    <div className="flex items-center justify-between">
                      <span>Verified On</span>
                      <span className="text-foreground font-medium">{new Date(founderKyc.verifiedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {founderKyc.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span>Expires</span>
                      <span className="text-foreground font-medium">{new Date(founderKyc.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {founderKyc.externalProvider && (
                    <div className="flex items-center justify-between">
                      <span>Provider</span>
                      <span className="text-foreground font-medium capitalize">{founderKyc.externalProvider.replace(/_/g, " ")}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>No identity verification record found for this founder.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DossierIndividual {
  personId: number;
  entityType: "individual";
  inviteEmail: string | null;
  personUserId: string | null;
  profile: {
    fullName: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    nationality: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    idType: string | null;
    hasSignature: boolean;
    hasPassportPhoto: boolean;
    hasIdDocument: boolean;
  } | null;
  verificationStatus: {
    status: string | null;
    bvnNinVerified: boolean | null;
    docSubmitted: boolean;
    biometricSubmitted: boolean;
    livenessScore: number | null;
    hasSelfie: boolean;
    selfieIsExternal: boolean;
    selfieUrl: string | null;
    verifiedAt: string | null;
  } | null;
  inviteUploadDocs: {
    hasSignature: boolean;
    hasPassportPhoto: boolean;
    hasIdDocument: boolean;
  } | null;
}

interface DossierCorporate {
  personId: number;
  entityType: "corporate";
  corporateName: string | null;
  corporateRcNumber: string | null;
  corporateCountry: string | null;
  corporateBusinessType: string | null;
  kybLookupStatus: string | null;
  autoVerifyMethod: string | null;
  corporateInfo: Record<string, unknown> | null;
}

type DossierItem = DossierIndividual | DossierCorporate;

function PersonDocumentButton({
  applicationId,
  personId,
  docType,
  label,
  icon,
}: {
  applicationId: number;
  personId: number;
  docType: "signature" | "passport_photo" | "id_document";
  label: string;
  icon: ReactNode;
}) {
  const { toast } = useToast();
  const fetchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/lawyer/applications/${applicationId}/people/${personId}/document/${docType}`);
      return res.json() as Promise<{ downloadURL: string }>;
    },
    onSuccess: (data) => {
      if (data.downloadURL) {
        window.open(data.downloadURL, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: "Document unavailable", description: "No download URL returned.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Failed to open document", variant: "destructive" });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => fetchMutation.mutate()}
      disabled={fetchMutation.isPending}
      data-testid={`btn-view-${docType}-${personId}`}
      className="text-xs gap-1.5"
    >
      {fetchMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

function PersonDocumentPreview({
  applicationId,
  personId,
  docType,
  label,
  prefetchedUrl,
}: {
  applicationId: number;
  personId: number;
  docType: "signature" | "passport_photo" | "id_document" | "selfie";
  label: string;
  prefetchedUrl?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(prefetchedUrl ?? null);
  const [loading, setLoading] = useState(!prefetchedUrl);
  const [failed, setFailed] = useState(false);

  const isImageType = docType === "passport_photo" || docType === "signature" || docType === "selfie";

  useEffect(() => {
    if (prefetchedUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", `/api/lawyer/applications/${applicationId}/people/${personId}/document/${docType}`);
        const data = await res.json() as { downloadURL?: string };
        if (!cancelled) {
          if (data.downloadURL) setUrl(data.downloadURL);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applicationId, personId, docType, prefetchedUrl]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docType}-${personId}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-1.5" data-testid={`preview-${docType}-${personId}`}>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      {loading && !url && !failed ? (
        <div className="w-24 h-16 rounded border bg-muted flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : failed || !url ? (
        <div className="w-24 h-16 rounded border bg-muted flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : isImageType ? (
        <>
          <a href={url} target="_blank" rel="noopener noreferrer" data-testid={`link-view-${docType}-${personId}`}>
            <img
              src={url}
              alt={label}
              className="max-w-[120px] max-h-[80px] rounded border object-contain hover:opacity-80 transition-opacity cursor-pointer"
            />
          </a>
          <div className="flex gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
              data-testid={`btn-view-${docType}-${personId}`}
            >
              View
            </a>
            <span className="text-xs text-muted-foreground">·</span>
            <button
              onClick={handleDownload}
              className="text-xs text-primary hover:underline"
              data-testid={`btn-download-${docType}-${personId}`}
            >
              Download
            </button>
          </div>
        </>
      ) : (
        <>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            data-testid={`link-view-${docType}-${personId}`}
          >
            <FileImage className="h-3.5 w-3.5" />
            View {label}
          </a>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            data-testid={`btn-download-${docType}-${personId}`}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </>
      )}
    </div>
  );
}

interface CorpDoc {
  id: number;
  docType: string;
  filename: string;
  downloadURL: string | null;
  createdAt: string | null;
}

function CorporateDocsPanel({
  applicationId,
  personId,
  personIsVerifiedInitial,
  onVerified,
}: {
  applicationId: number;
  personId: number;
  personIsVerifiedInitial: boolean;
  onVerified: () => void;
}) {
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<{ docs: CorpDoc[]; personIsVerified: boolean }>({
    queryKey: ["/api/lawyer/applications", applicationId, "people", personId, "corporate-docs"],
    retry: false,
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/lawyer/applications/${applicationId}/people/${personId}/verify-corporate`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Corporate entity verified", description: "All uploaded documents have been accepted." });
      queryClient.invalidateQueries({ queryKey: ["/api/lawyer/applications", applicationId, "people", personId, "corporate-docs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId] });
      onVerified();
    },
    onError: (err: Error) => {
      toast({ title: "Could not verify", description: err.message, variant: "destructive" });
    },
  });

  const isVerified = data?.personIsVerified ?? personIsVerifiedInitial;
  const docs = data?.docs ?? [];

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground" data-testid={`corp-docs-loading-${personId}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading uploaded documents…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-destructive" data-testid={`corp-docs-error-${personId}`}>
        <AlertCircle className="h-3 w-3" />
        Failed to load corporate documents.
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-3" data-testid={`corp-docs-panel-${personId}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          Corporate Documents
        </p>
        {isVerified ? (
          <Badge className="bg-green-600 text-xs gap-1" data-testid={`badge-corp-verified-${personId}`}>
            <ShieldCheck className="h-3 w-3" />Docs Verified
          </Badge>
        ) : docs.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
            disabled={verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
            data-testid={`btn-verify-corporate-${personId}`}
          >
            {verifyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Mark as Verified
          </Button>
        ) : null}
      </div>

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic" data-testid={`corp-docs-empty-${personId}`}>
          No documents uploaded yet — awaiting the authorised representative.
        </p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-muted/50" data-testid={`corp-doc-row-${doc.id}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <FileCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground font-medium capitalize">{doc.docType.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground truncate hidden sm:inline">— {doc.filename}</span>
              </div>
              {doc.downloadURL ? (
                <a
                  href={doc.downloadURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-primary hover:underline"
                  data-testid={`link-corp-doc-${doc.id}`}
                >
                  <Download className="h-3 w-3" />
                  View
                </a>
              ) : (
                <span className="text-muted-foreground shrink-0">Unavailable</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PeopleTab({ people, applicationId }: { people: EnrichedPerson[]; applicationId: number }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: dossier, isLoading: dossierLoading } = useQuery<DossierItem[]>({
    queryKey: ["/api/lawyer/applications", applicationId, "people-dossier"],
    enabled: people.length > 0,
    retry: false,
  });

  const dossierById = new Map<number, DossierItem>();
  if (dossier) {
    for (const item of dossier) {
      dossierById.set(item.personId, item);
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getVerificationBadge = (person: EnrichedPerson) => {
    if (person.entityType === "corporate") {
      if (person.kybLookupStatus === "found") {
        return <Badge className="bg-green-600 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />KYB Verified</Badge>;
      }
      if (person.isVerified) {
        return <Badge className="bg-green-600 text-xs gap-1"><ShieldCheck className="h-3 w-3" />Docs Verified</Badge>;
      }
      switch (person.kybLookupStatus) {
        case "not_found":
          return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" />KYB Failed</Badge>;
        case "error":
          return <Badge variant="destructive" className="text-xs gap-1"><AlertCircle className="h-3 w-3" />KYB Error</Badge>;
        default:
          return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />KYB Pending</Badge>;
      }
    }
    if (person.isVerified) {
      return <Badge className="bg-green-600 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Verified</Badge>;
    }
    if (person.verificationStep) {
      const step = person.verificationStep;
      if (step.status === "verified") {
        return <Badge className="bg-green-600 text-xs gap-1"><CheckCircle2 className="h-3 w-3" />KYC Verified</Badge>;
      }
      if (step.status === "rejected") {
        return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" />KYC Failed</Badge>;
      }
      if (step.biometricSubmitted) {
        return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />Biometric Submitted</Badge>;
      }
      if (step.docSubmitted) {
        return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />Doc Submitted</Badge>;
      }
      if (step.bvnNinVerified) {
        return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />BVN/NIN Done</Badge>;
      }
      return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />KYC In Progress</Badge>;
    }
    switch (person.inviteStatus) {
      case "accepted":
        return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />Pending Verification</Badge>;
      case "pending":
        return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />Invite Sent</Badge>;
      case "not_invited":
        return <Badge variant="outline" className="text-xs gap-1"><AlertCircle className="h-3 w-3" />Not Invited</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" />Failed / Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs capitalize">{person.inviteStatus || "Unknown"}</Badge>;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "director": return "Director";
      case "shareholder": return "Shareholder";
      case "director_shareholder": return "Director & Shareholder";
      default: return role;
    }
  };

  if (people.length === 0) {
    return (
      <Card data-testid="people-empty-state">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">No People Records Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Directors and shareholders have not been added to this application. 
            Use the Clarifications channel to request this information from the founder.
          </p>
        </CardContent>
      </Card>
    );
  }

  const directors = people.filter(p => p.role === "director" || p.role === "director_shareholder");
  const shareholders = people.filter(p => p.role === "shareholder" || p.role === "director_shareholder");

  return (
    <div className="space-y-6" data-testid="people-tab">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Directors & Shareholders</h3>
          <p className="text-sm text-muted-foreground">
            {directors.length} director{directors.length !== 1 ? "s" : ""} · {shareholders.length} shareholder{shareholders.length !== 1 ? "s" : ""}
          </p>
        </div>
        {dossierLoading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading identity data…
          </span>
        )}
      </div>

      <div className="space-y-4">
        {people.map((person) => {
          const dossierItem = dossierById.get(person.id!);
          const isExpanded = expandedIds.has(person.id!);

          return (
            <Card key={person.id} data-testid={`person-card-${person.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {person.entityType === "corporate" ? (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate" data-testid={`text-person-name-${person.id}`}>
                          {person.entityType === "corporate"
                            ? person.corporateName || "Corporate Entity"
                            : person.displayName || person.inviteEmail || "—"}
                        </p>
                        {person.entityType === "corporate" && (
                          <Badge variant="outline" className="text-xs shrink-0">Corporate</Badge>
                        )}
                        {person.autoVerifyMethod && (
                          <Badge variant="secondary" className="text-xs shrink-0 gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Auto-verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{getRoleLabel(person.role)}</p>

                      {person.entityType === "corporate" ? (
                        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                          {person.corporateRcNumber && (
                            <p className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />RC: {person.corporateRcNumber}
                            </p>
                          )}
                          {person.corporateCountry && <p>Country: {person.corporateCountry}</p>}
                          {(person.corporateAuthorisedRepName || person.inviteEmail) && (
                            <div className="mt-1.5 pt-1.5 border-t border-dashed border-muted-foreground/20">
                              <p className="font-medium text-foreground/70 mb-0.5">Authorised Representative</p>
                              {person.corporateAuthorisedRepName && <p>{person.corporateAuthorisedRepName}</p>}
                              {person.inviteEmail && <p>{person.inviteEmail}</p>}
                              <div className="flex items-center gap-1 mt-1">
                                {person.inviteStatus === "accepted" ? (
                                  <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3" />Rep invite accepted
                                  </span>
                                ) : person.inviteStatus === "pending" ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />Rep invite sent, awaiting response
                                  </span>
                                ) : person.inviteStatus === "not_invited" ? (
                                  <span className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />Rep not yet invited
                                  </span>
                                ) : person.inviteStatus === "rejected" ? (
                                  <span className="flex items-center gap-1 text-destructive">
                                    <XCircle className="h-3 w-3" />Rep invite rejected
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                          {person.inviteEmail && <p>{person.inviteEmail}</p>}
                          <div className="flex items-center gap-3 flex-wrap mt-1">
                            {person.sharesAllocated != null && (
                              <span>{person.sharesAllocated.toLocaleString()} shares</span>
                            )}
                            {person.shareClass && <span>Class: {person.shareClass}</span>}
                            {person.sharePercentage && <span>{person.sharePercentage}%</span>}
                          </div>
                        </div>
                      )}

                      {(dossierItem || person.entityType === "corporate") && (
                        <button
                          className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() => toggleExpand(person.id!)}
                          data-testid={`btn-expand-person-${person.id}`}
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isExpanded
                            ? "Hide details"
                            : person.entityType === "corporate"
                              ? "View documents & details"
                              : "View identity details"}
                        </button>
                      )}

                      {isExpanded && dossierItem && dossierItem.entityType === "individual" && (
                        <div className="mt-3 pt-3 border-t space-y-3" data-testid={`dossier-individual-${person.id}`}>
                          {dossierItem.profile ? (
                            <>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                {dossierItem.profile.fullName && (
                                  <div>
                                    <p className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Full Name</p>
                                    <p className="font-medium">{dossierItem.profile.fullName}</p>
                                  </div>
                                )}
                                {dossierItem.profile.phone && (
                                  <div>
                                    <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Phone</p>
                                    <p className="font-medium">{dossierItem.profile.phone}</p>
                                  </div>
                                )}
                                {dossierItem.profile.dateOfBirth && (
                                  <div>
                                    <p className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Date of Birth</p>
                                    <p className="font-medium">{dossierItem.profile.dateOfBirth}</p>
                                  </div>
                                )}
                                {dossierItem.profile.gender && (
                                  <div>
                                    <p className="text-muted-foreground">Gender</p>
                                    <p className="font-medium capitalize">{dossierItem.profile.gender}</p>
                                  </div>
                                )}
                                {dossierItem.profile.nationality && (
                                  <div>
                                    <p className="text-muted-foreground">Nationality</p>
                                    <p className="font-medium">{dossierItem.profile.nationality}</p>
                                  </div>
                                )}
                                {dossierItem.profile.idType && (
                                  <div>
                                    <p className="text-muted-foreground">ID Type</p>
                                    <p className="font-medium capitalize">{dossierItem.profile.idType.replace(/_/g, " ")}</p>
                                  </div>
                                )}
                              </div>
                              {(dossierItem.profile.addressLine1 || dossierItem.profile.city || dossierItem.profile.state) && (
                                <div className="text-xs">
                                  <p className="text-muted-foreground flex items-center gap-1 mb-0.5"><MapPin className="h-3 w-3" />Address</p>
                                  <p className="font-medium">
                                    {[dossierItem.profile.addressLine1, dossierItem.profile.addressLine2, dossierItem.profile.city, dossierItem.profile.state, dossierItem.profile.country].filter(Boolean).join(", ")}
                                  </p>
                                </div>
                              )}
                              {dossierItem.verificationStatus && (
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    { label: "BVN/NIN", done: !!dossierItem.verificationStatus.bvnNinVerified },
                                    { label: "Document", done: dossierItem.verificationStatus.docSubmitted },
                                    { label: "Biometric", done: dossierItem.verificationStatus.biometricSubmitted },
                                    { label: "Verified", done: dossierItem.verificationStatus.status === "verified" },
                                  ].map(step => (
                                    <span
                                      key={step.label}
                                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${step.done ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400" : "bg-muted border-muted text-muted-foreground"}`}
                                    >
                                      {step.done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                      {step.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(dossierItem.profile.hasPassportPhoto || dossierItem.profile.hasSignature || dossierItem.profile.hasIdDocument || dossierItem.verificationStatus?.hasSelfie) ? (
                                <div className="pt-1 space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground">Identity Documents</p>
                                  <div className="flex flex-wrap gap-4">
                                    {dossierItem.profile.hasPassportPhoto && (
                                      <PersonDocumentPreview
                                        applicationId={applicationId}
                                        personId={person.id!}
                                        docType="passport_photo"
                                        label="Passport Photo"
                                      />
                                    )}
                                    {dossierItem.profile.hasSignature && (
                                      <PersonDocumentPreview
                                        applicationId={applicationId}
                                        personId={person.id!}
                                        docType="signature"
                                        label="Signature Specimen"
                                      />
                                    )}
                                    {dossierItem.verificationStatus?.hasSelfie && (
                                      <PersonDocumentPreview
                                        applicationId={applicationId}
                                        personId={person.id!}
                                        docType="selfie"
                                        label="Biometric Selfie"
                                        prefetchedUrl={dossierItem.verificationStatus.selfieIsExternal ? dossierItem.verificationStatus.selfieUrl : null}
                                      />
                                    )}
                                    {dossierItem.profile.hasIdDocument && (
                                      <PersonDocumentPreview
                                        applicationId={applicationId}
                                        personId={person.id!}
                                        docType="id_document"
                                        label="ID Document"
                                      />
                                    )}
                                  </div>
                                  {dossierItem.verificationStatus?.livenessScore != null && (
                                    <p className="text-xs text-muted-foreground">
                                      Liveness score: <span className="font-medium text-foreground">{dossierItem.verificationStatus.livenessScore}%</span>
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">No identity documents uploaded yet.</p>
                              )}
                            </>
                          ) : dossierItem.inviteUploadDocs ? (
                            <div className="space-y-2" data-testid={`invite-upload-docs-${person.id}`}>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <FileText className="h-3 w-3" />
                                <span>Documents uploaded via invite link</span>
                              </div>
                              <div className="flex flex-wrap gap-4">
                                {dossierItem.inviteUploadDocs.hasPassportPhoto && (
                                  <PersonDocumentPreview
                                    applicationId={applicationId}
                                    personId={person.id!}
                                    docType="passport_photo"
                                    label="Passport Photo"
                                  />
                                )}
                                {dossierItem.inviteUploadDocs.hasSignature && (
                                  <PersonDocumentPreview
                                    applicationId={applicationId}
                                    personId={person.id!}
                                    docType="signature"
                                    label="Signature Specimen"
                                  />
                                )}
                                {dossierItem.inviteUploadDocs.hasIdDocument && (
                                  <PersonDocumentPreview
                                    applicationId={applicationId}
                                    personId={person.id!}
                                    docType="id_document"
                                    label="ID Document"
                                  />
                                )}
                              </div>
                              {!dossierItem.inviteUploadDocs.hasSignature && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Signature specimen not yet provided
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic" data-testid={`text-not-verified-${person.id}`}>
                              Not yet verified — no data available.
                            </p>
                          )}
                        </div>
                      )}

                      {isExpanded && dossierItem && dossierItem.entityType === "corporate" && (
                        <div className="mt-3 pt-3 border-t space-y-2 text-xs" data-testid={`dossier-corporate-${person.id}`}>
                          {dossierItem.corporateBusinessType && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Badge variant="outline" className="text-xs capitalize">
                                {dossierItem.corporateBusinessType === "co" ? "Limited Company (RC)"
                                  : dossierItem.corporateBusinessType === "bn" ? "Business Name (BN)"
                                  : dossierItem.corporateBusinessType === "it" ? "Incorporated Trustee (IT)"
                                  : dossierItem.corporateBusinessType}
                              </Badge>
                            </div>
                          )}
                          {dossierItem.corporateInfo ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              {(dossierItem.corporateInfo.fullName || dossierItem.corporateInfo.companyName) && (
                                <div>
                                  <p className="text-muted-foreground">Registered Name</p>
                                  <p className="font-medium">{(dossierItem.corporateInfo.fullName || dossierItem.corporateInfo.companyName) as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.rcNumber && (
                                <div>
                                  <p className="text-muted-foreground">RC / BN Number</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.rcNumber as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.tinNumber && (
                                <div>
                                  <p className="text-muted-foreground">TIN</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.tinNumber as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.yearEstablished && (
                                <div>
                                  <p className="text-muted-foreground">Year Established</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.yearEstablished as number}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.industryCategory && (
                                <div>
                                  <p className="text-muted-foreground">Industry</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.industryCategory as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.amlScreeningStatus && (
                                <div>
                                  <p className="text-muted-foreground">AML Status</p>
                                  <p className={`font-medium capitalize ${(dossierItem.corporateInfo.amlScreeningStatus as string) === "clear" ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"}`}>
                                    {(dossierItem.corporateInfo.amlScreeningStatus as string).replace(/_/g, " ")}
                                  </p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.riskScore && (
                                <div>
                                  <p className="text-muted-foreground">Risk Score</p>
                                  <p className="font-medium capitalize">{dossierItem.corporateInfo.riskScore as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.registrationDate && (
                                <div>
                                  <p className="text-muted-foreground">Registration Date</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.registrationDate as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.companyStatus && (
                                <div>
                                  <p className="text-muted-foreground">Company Status</p>
                                  <p className="font-medium capitalize">{dossierItem.corporateInfo.companyStatus as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.companyType && (
                                <div>
                                  <p className="text-muted-foreground">Company Type</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.companyType as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.shareCapital && (
                                <div>
                                  <p className="text-muted-foreground">Share Capital</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.shareCapital as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.lastVerifiedAt && (
                                <div>
                                  <p className="text-muted-foreground">Last Verified</p>
                                  <p className="font-medium">{new Date(dossierItem.corporateInfo.lastVerifiedAt as string).toLocaleDateString()}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.firstVerifiedAt && (
                                <div>
                                  <p className="text-muted-foreground">First Verified</p>
                                  <p className="font-medium">{new Date(dossierItem.corporateInfo.firstVerifiedAt as string).toLocaleDateString()}</p>
                                </div>
                              )}
                              {(dossierItem.corporateInfo.headOfficeAddress || dossierItem.corporateInfo.address) && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground">Registered Address</p>
                                  <p className="font-medium">{(dossierItem.corporateInfo.headOfficeAddress || dossierItem.corporateInfo.address) as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.contactPersonName && (
                                <div>
                                  <p className="text-muted-foreground">Contact Person</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.contactPersonName as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.contactPersonRole && (
                                <div>
                                  <p className="text-muted-foreground">Role</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.contactPersonRole as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.contactPersonEmail && (
                                <div>
                                  <p className="text-muted-foreground">Contact Email</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.contactPersonEmail as string}</p>
                                </div>
                              )}
                              {dossierItem.corporateInfo.contactPersonPhone && (
                                <div>
                                  <p className="text-muted-foreground">Contact Phone</p>
                                  <p className="font-medium">{dossierItem.corporateInfo.contactPersonPhone as string}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-muted-foreground italic" data-testid={`text-not-verified-corporate-${person.id}`}>
                              Not yet verified — no data available.
                            </p>
                          )}
                          {dossierItem.corporateInfo?.directors && Array.isArray(dossierItem.corporateInfo.directors) && (dossierItem.corporateInfo.directors as {name: string; role?: string}[]).length > 0 && (
                            <div className="pt-2 space-y-1.5" data-testid={`directors-list-${person.id}`}>
                              <p className="text-xs font-medium text-muted-foreground">CAC Directors</p>
                              <div className="space-y-1">
                                {(dossierItem.corporateInfo.directors as {name: string; role?: string}[]).map((director, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/50">
                                    <span className="font-medium">{director.name}</span>
                                    {director.role && <span className="text-muted-foreground">{director.role}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isExpanded && person.entityType === "corporate" && person.id && (
                        <CorporateDocsPanel
                          applicationId={applicationId}
                          personId={person.id}
                          personIsVerifiedInitial={person.isVerified ?? false}
                          onVerified={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId] });
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">{getVerificationBadge(person)}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface DocumentDownloadResponse {
  id: number;
  filename: string;
  downloadUrl: string | null;
  docType: string;
  category: string;
  sha256Hash: string | null;
  storageConfigured: boolean;
}

function DocumentFileDetails({ 
  docFile, 
  checklistItemId 
}: { 
  docFile: DocumentFile; 
  checklistItemId: number;
}) {
  const { toast } = useToast();
  const [downloadData, setDownloadData] = useState<DocumentDownloadResponse | null>(null);
  
  const downloadMutation = useMutation({
    mutationFn: async (): Promise<DocumentDownloadResponse> => {
      const res = await apiRequest("GET", `/api/documents/${docFile.id}/download`);
      return res.json();
    },
    onSuccess: (data) => {
      setDownloadData(data);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        toast({
          title: "Document Verified",
          description: "File metadata verified. File storage pending configuration.",
        });
      }
    },
  });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">File Details</p>
      <div className="text-sm space-y-1">
        <p><span className="font-medium">Filename:</span> {docFile.filename}</p>
        <p><span className="font-medium">Type:</span> {docFile.docType}</p>
        <p><span className="font-medium">Category:</span> {docFile.category}</p>
        {docFile.sha256Hash && (
          <p className="text-xs text-muted-foreground break-all">
            <span className="font-medium">Verification Hash:</span> {docFile.sha256Hash}
          </p>
        )}
      </div>
      <div className="pt-2 space-y-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          data-testid={`btn-view-document-${checklistItemId}`}
        >
          {downloadMutation.isPending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              View Document
            </>
          )}
        </Button>
        {downloadMutation.isError && (
          <p className="text-xs text-destructive">
            Failed to access document. Please try again.
          </p>
        )}
        {downloadData && !downloadData.downloadUrl && (
          <p className="text-xs text-muted-foreground">
            Document record verified. File storage integration pending.
          </p>
        )}
      </div>
    </div>
  );
}

interface FieldVerificationFindings {
  taskStatus?: string;
  gpsCoordinates?: { latitude: number; longitude: number };
  buildingType?: string;
  buildingColor?: string;
  submissionDistanceInMeters?: number;
  agentPhotoUrl?: string;
  agentSignatureUrl?: string;
  summary?: string;
}

interface FieldVerificationJob {
  id: number;
  status: string;
  verdict: string | null;
  findingsJson: FieldVerificationFindings | null;
  youverifyReferenceId: string | null;
  submittedAt: string | null;
  completedAt: string | null;
}

function DocumentsTab({ 
  applicationId, 
  checklist,
  documents,
  operatingAddress,
  addressVerificationStatus,
}: { 
  applicationId: number;
  checklist: ApplicationChecklistItem[];
  documents: DocumentFile[];
  operatingAddress?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string; } | null;
  addressVerificationStatus?: string | null;
}) {
  const { toast } = useToast();
  const [selectedDoc, setSelectedDoc] = useState<ApplicationChecklistItem | null>(null);
  const [qualityStatus, setQualityStatus] = useState<string>("");
  const [qualityNotes, setQualityNotes] = useState("");
  const [kycDocsExpanded, setKycDocsExpanded] = useState(true);
  const [docRequestDialogOpen, setDocRequestDialogOpen] = useState(false);
  const [docRequestText, setDocRequestText] = useState("");
  const [docRequestReason, setDocRequestReason] = useState("");

  const { data: docRequests, isLoading: docRequestsLoading } = useQuery<LawyerDocumentRequest[]>({
    queryKey: ["/api/lawyer/applications", applicationId, "document-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/lawyer/applications/${applicationId}/document-requests`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: sharedDocs } = useQuery<DocumentFile[]>({
    queryKey: ["/api/lawyer/applications", applicationId, "shared-documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/lawyer/applications/${applicationId}/shared-documents`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);

  const handleSharedDocDownload = async (docId: number) => {
    setDownloadingDocId(docId);
    try {
      const res = await apiRequest("GET", `/api/documents/${docId}/download`);
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: "Download failed", description: "No download URL returned", variant: "destructive" });
      }
    } catch {
      toast({ title: "Download failed", description: "Could not retrieve the file", variant: "destructive" });
    } finally {
      setDownloadingDocId(null);
    }
  };

  const fulfillDocRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("PATCH", `/api/lawyer/document-requests/${requestId}/resolve`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to mark resolved");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lawyer/applications", applicationId, "document-requests"] });
      toast({ title: "Request marked as resolved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update request", description: error.message, variant: "destructive" });
    },
  });

  const createDocRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/lawyer/applications/${applicationId}/document-requests`, {
        documentsRequested: docRequestText.trim(),
        reason: docRequestReason.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to send request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lawyer/applications", applicationId, "document-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lawyer/applications", applicationId, "shared-documents"] });
      toast({ title: "Document request sent", description: "The founder has been notified by email." });
      setDocRequestDialogOpen(false);
      setDocRequestText("");
      setDocRequestReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send request", description: error.message, variant: "destructive" });
    },
  });

  // Fetch field verification findings (only if an address_proof doc might be reviewed)
  const { data: fieldVerificationJob } = useQuery<FieldVerificationJob>({
    queryKey: ["/api/lawyer/applications", applicationId, "field-verification"],
    enabled: !!addressVerificationStatus && addressVerificationStatus !== "none",
    retry: false,
  });

  // Fetch people dossier for identity documents section
  const { data: dossier } = useQuery<DossierItem[]>({
    queryKey: ["/api/lawyer/applications", applicationId, "people-dossier"],
    retry: false,
  });

  const individualDossierItems = (dossier || []).filter((d): d is DossierIndividual =>
    d.entityType === "individual" && (
      d.profile !== null && (d.profile.hasSignature || d.profile.hasPassportPhoto || d.profile.hasIdDocument)
      || d.verificationStatus?.hasSelfie === true
    )
  );

  const getDocumentFile = (checklistItem: ApplicationChecklistItem): DocumentFile | undefined => {
    return documents.find(doc => doc.docType === checklistItem.key);
  };

  const qualityMutation = useMutation({
    mutationFn: async ({ docId, status, notes }: { docId: number; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/lawyer/documents/${docId}/quality`, {
        qualityStatus: status,
        qualityNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Quality status updated" });
      setSelectedDoc(null);
      setQualityStatus("");
      setQualityNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update quality", description: error.message, variant: "destructive" });
    },
  });

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case "accepted": return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case "provided": return <Clock className="h-4 w-4 text-blue-600" />;
      case "rejected": return <ThumbsDown className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      {individualDossierItems.length > 0 && (
        <Card data-testid="card-kyc-documents">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Identity & KYC Documents
                </CardTitle>
                <CardDescription>
                  Verified identity documents for directors and shareholders
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setKycDocsExpanded(prev => !prev)}
                data-testid="btn-toggle-kyc-docs"
              >
                {kycDocsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {kycDocsExpanded && (
            <CardContent className="pt-0">
              <div className="divide-y">
                {individualDossierItems.map((item) => (
                  <div key={item.personId} className="py-3" data-testid={`kyc-docs-row-${item.personId}`}>
                    <p className="text-sm font-medium mb-3">
                      {item.profile?.fullName || item.inviteEmail || `Person #${item.personId}`}
                    </p>
                    <div className="flex flex-wrap gap-5">
                      {item.profile?.hasPassportPhoto && (
                        <PersonDocumentPreview
                          applicationId={applicationId}
                          personId={item.personId}
                          docType="passport_photo"
                          label="Passport Photo"
                        />
                      )}
                      {item.profile?.hasSignature && (
                        <PersonDocumentPreview
                          applicationId={applicationId}
                          personId={item.personId}
                          docType="signature"
                          label="Signature Specimen"
                        />
                      )}
                      {item.verificationStatus?.hasSelfie && (
                        <PersonDocumentPreview
                          applicationId={applicationId}
                          personId={item.personId}
                          docType="selfie"
                          label="Biometric Selfie"
                          prefetchedUrl={item.verificationStatus.selfieIsExternal ? item.verificationStatus.selfieUrl : null}
                        />
                      )}
                      {item.profile?.hasIdDocument && (
                        <PersonDocumentPreview
                          applicationId={applicationId}
                          personId={item.personId}
                          docType="id_document"
                          label="ID Document"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

    <Card>
      <CardHeader>
        <CardTitle className="text-base">Document Quality Review</CardTitle>
        <CardDescription>
          Review uploaded documents and mark quality status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {checklist.map((item) => {
            const isProvided = item.status === "provided" || item.status === "accepted";
            const sourceLabel =
              isProvided && item.source === "kyc_auto_resolved"
                ? "Auto-verified via KYC"
                : isProvided && item.source === "manual_upload"
                ? "Manually uploaded"
                : null;
            return (
            <div key={item.id} className="py-4 flex items-center justify-between gap-4" data-testid={`doc-row-${item.id}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  item.status === "accepted" ? "bg-green-100 dark:bg-green-900/30" :
                  item.status === "provided" ? "bg-blue-100 dark:bg-blue-900/30" :
                  item.status === "rejected" ? "bg-red-100 dark:bg-red-900/30" :
                  "bg-muted"
                }`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge status={item.status || "missing"} />
                    {item.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                    {sourceLabel && (
                      <span className="text-xs text-muted-foreground" data-testid={`source-label-lawyer-${item.id}`}>{sourceLabel}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {getStatusIcon(item.status)}
                
                {item.status === "provided" || item.status === "accepted" ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDoc(item);
                          setQualityStatus("");
                          setQualityNotes(item.reviewerNotes || "");
                        }}
                        data-testid={`btn-review-${item.id}`}
                      >
                        Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Review Document</DialogTitle>
                        <DialogDescription>
                          {item.label}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {sourceLabel && (
                          <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border" data-testid={`review-dialog-source-${item.id}`}>
                            {item.source === "kyc_auto_resolved" ? (
                              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm text-muted-foreground">{sourceLabel}</span>
                          </div>
                        )}
                        {item.key === "address_proof" && operatingAddress && (
                          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="review-dialog-operating-address">
                            <MapPin className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Declared Operating Address</p>
                              <p className="text-sm text-amber-700 dark:text-amber-300">
                                {[operatingAddress.line1, operatingAddress.line2, operatingAddress.city, operatingAddress.state, operatingAddress.postalCode].filter(Boolean).join(", ")}
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Verify the uploaded document matches this address.
                              </p>
                            </div>
                          </div>
                        )}
                        {item.key === "address_proof" && fieldVerificationJob && (
                          <div
                            className={`p-3 rounded-md border space-y-2 ${fieldVerificationJob.verdict === "verified" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : fieldVerificationJob.verdict === "not_verified" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-muted/40"}`}
                            data-testid="review-dialog-field-verification"
                          >
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              {fieldVerificationJob.verdict === "verified" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              {fieldVerificationJob.verdict === "not_verified" && <AlertCircle className="h-4 w-4 text-red-600" />}
                              {!fieldVerificationJob.verdict && <Clock className="h-4 w-4 text-muted-foreground" />}
                              Field Agent Verification
                              {fieldVerificationJob.verdict === "verified" && <span className="text-green-700 dark:text-green-400">— Confirmed</span>}
                              {fieldVerificationJob.verdict === "not_verified" && <span className="text-red-700 dark:text-red-400">— Not Confirmed</span>}
                              {!fieldVerificationJob.verdict && <span className="text-muted-foreground">— Pending</span>}
                            </p>
                            {fieldVerificationJob.findingsJson?.taskStatus && (
                              <p className="text-xs text-muted-foreground">Task status: {fieldVerificationJob.findingsJson.taskStatus}</p>
                            )}
                            {fieldVerificationJob.findingsJson?.buildingType && (
                              <p className="text-xs text-muted-foreground">Building: {fieldVerificationJob.findingsJson.buildingType}{fieldVerificationJob.findingsJson.buildingColor ? ` · ${fieldVerificationJob.findingsJson.buildingColor}` : ""}</p>
                            )}
                            {fieldVerificationJob.findingsJson?.submissionDistanceInMeters != null && (
                              <p className="text-xs text-muted-foreground">Agent distance: {fieldVerificationJob.findingsJson.submissionDistanceInMeters} m</p>
                            )}
                            {fieldVerificationJob.findingsJson?.gpsCoordinates && (
                              <a
                                href={`https://maps.google.com/?q=${fieldVerificationJob.findingsJson.gpsCoordinates.latitude},${fieldVerificationJob.findingsJson.gpsCoordinates.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary underline underline-offset-2 block"
                                data-testid="link-lawyer-gps"
                              >
                                View GPS location on map ↗
                              </a>
                            )}
                            {fieldVerificationJob.findingsJson?.agentPhotoUrl && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Agent photo</p>
                                <img
                                  src={fieldVerificationJob.findingsJson.agentPhotoUrl}
                                  alt="Agent photo"
                                  className="rounded max-h-40 object-cover border border-border"
                                  data-testid="img-lawyer-agent-photo"
                                />
                              </div>
                            )}
                            {fieldVerificationJob.findingsJson?.summary && (
                              <p className="text-xs italic text-muted-foreground">{fieldVerificationJob.findingsJson.summary}</p>
                            )}
                          </div>
                        )}
                        {(() => {
                          const docFile = getDocumentFile(item);
                          return (
                            <div className="p-3 rounded-md bg-muted/50 border space-y-3">
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Document Status</p>
                                <StatusBadge status={item.status || "missing"} />
                              </div>
                              {docFile ? (
                                <DocumentFileDetails 
                                  docFile={docFile} 
                                  checklistItemId={item.id!}
                                />
                              ) : (
                                <p className="text-sm text-muted-foreground">No file uploaded yet</p>
                              )}
                            </div>
                          );
                        })()}
                        <div className="space-y-2">
                          <Label>Quality Status</Label>
                          <Select value={qualityStatus} onValueChange={setQualityStatus}>
                            <SelectTrigger data-testid="select-quality">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass" data-testid="option-pass">
                                <span className="flex items-center gap-2">
                                  <ThumbsUp className="h-4 w-4 text-green-600" />
                                  Pass - Document acceptable
                                </span>
                              </SelectItem>
                              <SelectItem value="needs_attention" data-testid="option-needs-attention">
                                <span className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                  Needs Attention - Minor issues
                                </span>
                              </SelectItem>
                              <SelectItem value="rejected" data-testid="option-rejected">
                                <span className="flex items-center gap-2">
                                  <ThumbsDown className="h-4 w-4 text-red-600" />
                                  Rejected - Must re-upload
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes (optional)</Label>
                          <Textarea
                            placeholder="Add notes about document quality..."
                            value={qualityNotes}
                            onChange={(e) => setQualityNotes(e.target.value)}
                            data-testid="input-quality-notes"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => {
                            if (item.id && qualityStatus) {
                              qualityMutation.mutate({
                                docId: item.id,
                                status: qualityStatus,
                                notes: qualityNotes,
                              });
                            }
                          }}
                          disabled={!qualityStatus || qualityMutation.isPending}
                          data-testid="btn-save-quality"
                        >
                          {qualityMutation.isPending ? <LoadingSpinner size="sm" /> : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <span className="text-sm text-muted-foreground">Not uploaded</span>
                )}
              </div>
            </div>
          );
          })}
        </div>
      </CardContent>
    </Card>

      {/* Document Requests Section */}
      <Card data-testid="card-document-requests">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Document Requests
              {(docRequests?.length ?? 0) > 0 && (
                <Badge variant="secondary">{docRequests!.length}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setDocRequestDialogOpen(true)}
              data-testid="btn-request-documents"
            >
              <FilePlus2 className="h-4 w-4 mr-1.5" />
              Request Documents
            </Button>
          </div>
          <CardDescription>
            Formally request documents from the founder. They will be notified by email and can share documents from their vault.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {docRequestsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (docRequests?.length ?? 0) === 0 ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="doc-requests-empty">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No document requests yet</p>
            </div>
          ) : (
            <>
            <div className="divide-y">
              {docRequests!.map((req) => (
                <div key={req.id} className="py-3 first:pt-0 last:pb-0 space-y-1" data-testid={`doc-request-${req.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{req.documentsRequested}</p>
                    {req.status === "fulfilled" ? (
                      <Badge className="shrink-0 bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />Resolved
                      </Badge>
                    ) : req.status === "actioned" ? (
                      <Badge className="shrink-0 bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />Founder Responded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 gap-1 text-xs text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                        <Clock className="h-3 w-3" />Awaiting Response
                      </Badge>
                    )}
                  </div>
                  {req.reason && (
                    <p className="text-xs text-muted-foreground">Reason: {req.reason}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requested {req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    {req.fulfilledAt && ` · Resolved ${new Date(req.fulfilledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                  </p>
                  {req.status === "actioned" && (sharedDocs?.length ?? 0) > 0 && (
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      The founder has shared {sharedDocs!.length} document{sharedDocs!.length !== 1 ? "s" : ""} — see "Documents Shared by Founder" below.
                    </p>
                  )}
                  {(req.status === "actioned" || req.status === "open") && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={fulfillDocRequestMutation.isPending}
                        onClick={() => fulfillDocRequestMutation.mutate(req.id)}
                        data-testid={`btn-fulfill-request-${req.id}`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Mark Resolved
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Shared Documents Card — visible whenever the founder has shared at least one file */}
      {(sharedDocs?.length ?? 0) > 0 && (
        <Card data-testid="card-shared-documents">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Documents Shared by Founder
              <Badge variant="secondary">{sharedDocs!.length}</Badge>
            </CardTitle>
            <CardDescription>
              Files the founder has marked as shared with you. Click Download to open the file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sharedDocs!.map((f) => {
                const sizeKB = f.sizeBytes ? (f.sizeBytes / 1024) : null;
                const sizeLabel = sizeKB !== null
                  ? sizeKB >= 1024
                    ? `${(sizeKB / 1024).toFixed(1)} MB`
                    : `${Math.round(sizeKB)} KB`
                  : null;
                const sharedOn = f.createdAt
                  ? new Date(f.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : null;
                return (
                  <div key={f.id} className="flex items-start gap-2 py-2 px-3 rounded-md bg-muted/40" data-testid={`shared-doc-${f.id}`}>
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-shared-doc-filename-${f.id}`}>
                        {f.filename || f.docType}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {f.docType && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-shared-doc-type-${f.id}`}>
                            {f.docType.replace(/_/g, " ")}
                          </span>
                        )}
                        {sizeLabel && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-shared-doc-size-${f.id}`}>
                            {sizeLabel}
                          </span>
                        )}
                        {sharedOn && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-shared-doc-date-${f.id}`}>
                            Shared {sharedOn}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-7 text-xs gap-1"
                      disabled={downloadingDocId === f.id}
                      onClick={() => handleSharedDocDownload(f.id)}
                      data-testid={`btn-download-shared-doc-${f.id}`}
                    >
                      {downloadingDocId === f.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Download className="h-3 w-3" />}
                      Download
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Documents Dialog */}
      <Dialog open={docRequestDialogOpen} onOpenChange={setDocRequestDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-request-documents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-primary" />
              Request Documents from Founder
            </DialogTitle>
            <DialogDescription>
              Describe the documents you need. The founder will be notified by email and can share them from their Document Vault.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-request-text">Documents Needed <span className="text-destructive">*</span></Label>
              <Textarea
                id="doc-request-text"
                placeholder="e.g. Passport copy for all directors, utility bill dated within 3 months, signed board resolution..."
                value={docRequestText}
                onChange={(e) => setDocRequestText(e.target.value)}
                rows={4}
                data-testid="input-doc-request-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-request-reason">Reason (optional)</Label>
              <Textarea
                id="doc-request-reason"
                placeholder="e.g. CAC requires these for the application filing..."
                value={docRequestReason}
                onChange={(e) => setDocRequestReason(e.target.value)}
                rows={2}
                data-testid="input-doc-request-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDocRequestDialogOpen(false)}
              disabled={createDocRequestMutation.isPending}
              data-testid="btn-cancel-doc-request"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createDocRequestMutation.mutate()}
              disabled={!docRequestText.trim() || createDocRequestMutation.isPending}
              data-testid="btn-submit-doc-request"
            >
              {createDocRequestMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Sending…</>
              ) : (
                <><Send className="h-4 w-4 mr-1.5" />Send Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const clarificationFormSchema = insertClarificationRequestSchema
  .pick({ subject: true, message: true })
  .extend({
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(1, "Message is required"),
    useAiDraft: z.boolean().default(false),
    aiContext: z.string().optional(),
  });

type ClarificationFormValues = z.infer<typeof clarificationFormSchema>;

function ClarificationsTab({ 
  applicationId,
  clarifications,
}: { 
  applicationId: number;
  clarifications: ClarificationRequest[];
}) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const form = useForm<ClarificationFormValues>({
    resolver: zodResolver(clarificationFormSchema),
    defaultValues: {
      subject: "",
      message: "",
      useAiDraft: false,
      aiContext: "",
    },
  });

  const useAiDraft = form.watch("useAiDraft");
  const aiContext = form.watch("aiContext");

  const generateAiDraft = async () => {
    const context = form.getValues("aiContext");
    if (!context) return;
    
    setIsGeneratingAi(true);
    try {
      const response = await fetch(`/api/lawyer/applications/${applicationId}/clarifications/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ context }),
      });
      if (!response.ok) throw new Error("Failed to generate draft");
      const data = await response.json();
      form.setValue("subject", data.subject || "");
      form.setValue("message", data.message || "");
      toast({ title: "AI draft generated", description: "Review and edit as needed" });
    } catch {
      toast({ title: "Failed to generate draft", variant: "destructive" });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: ClarificationFormValues) => {
      return apiRequest("POST", `/api/lawyer/applications/${applicationId}/clarifications`, {
        subject: values.subject,
        message: values.message,
        useAiDraft: values.useAiDraft,
        aiContext: values.useAiDraft ? values.aiContext : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Clarification created" });
      setIsCreating(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create clarification", description: error.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (clarificationId: number) => {
      return apiRequest("POST", `/api/lawyer/clarifications/${clarificationId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Clarification sent to founder" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (clarificationId: number) => {
      return apiRequest("POST", `/api/lawyer/clarifications/${clarificationId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Clarification resolved" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to resolve", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: ClarificationFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold" data-testid="text-clarifications-title">Clarification Requests</h3>
          <p className="text-sm text-muted-foreground">Request additional information from the founder</p>
        </div>
        <Button onClick={() => setIsCreating(true)} data-testid="btn-new-clarification">
          <MessageSquare className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {isCreating && (
        <Card data-testid="card-create-clarification">
          <CardHeader>
            <CardTitle className="text-base">Create Clarification Request</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="useAiDraft"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-use-ai"
                        />
                      </FormControl>
                      <FormLabel className="flex items-center gap-2 cursor-pointer !mt-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Use AI to help draft this request
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {useAiDraft && (
                  <FormField
                    control={form.control}
                    name="aiContext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Describe what you need clarification on</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., The passport scan is blurry and I need a clearer copy..."
                            {...field}
                            data-testid="input-ai-context"
                          />
                        </FormControl>
                        <FormMessage />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateAiDraft}
                          disabled={!aiContext || isGeneratingAi}
                          data-testid="btn-generate-ai"
                        >
                          {isGeneratingAi ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Draft
                            </>
                          )}
                        </Button>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brief subject of your request"
                          {...field}
                          data-testid="input-subject"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed explanation of what information is needed..."
                          rows={4}
                          {...field}
                          data-testid="input-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="btn-create-clarification"
                  >
                    {createMutation.isPending ? <LoadingSpinner size="sm" /> : "Create Request"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsCreating(false);
                      form.reset();
                    }}
                    data-testid="btn-cancel-clarification"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {clarifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No clarification requests yet</p>
            </CardContent>
          </Card>
        ) : (
          clarifications.map((req) => (
            <Card key={req.id} data-testid={`clarification-${req.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{req.subject}</CardTitle>
                    <CardDescription>
                      Created {new Date(req.createdAt!).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <StatusBadge status={req.status || "draft"} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{req.message}</p>

                <div className="flex gap-2 mt-4">
                  {req.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => sendMutation.mutate(req.id)}
                      disabled={sendMutation.isPending}
                      data-testid={`btn-send-${req.id}`}
                    >
                      {sendMutation.isPending ? <LoadingSpinner size="sm" /> : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          Send to Founder
                        </>
                      )}
                    </Button>
                  )}
                  {req.status === "responded" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate(req.id)}
                      disabled={resolveMutation.isPending}
                      data-testid={`btn-resolve-${req.id}`}
                    >
                      {resolveMutation.isPending ? <LoadingSpinner size="sm" /> : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark Resolved
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

const STATUS_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  submitted:               [{ value: "under_review", label: "Under Review" }],
  under_review:            [{ value: "filed", label: "Filed with CAC" }],
  clarification_requested: [{ value: "under_review", label: "Under Review (resume)" }],
  filed:                   [{ value: "pending_originals", label: "Pending Originals" }],
  pending_originals:       [{ value: "courier_in_transit", label: "Courier In Transit" }],
  courier_in_transit:      [{ value: "completed", label: "Completed" }],
};

const STATUS_REQUIRES_RC = new Set(["filed", "completed"]);

function ExecutionTab({ 
  applicationId,
  declarations,
  application,
}: { 
  applicationId: number;
  declarations: ExecutionDeclaration[];
  application: CompanyApplication;
}) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [declarationType, setDeclarationType] = useState<string>("");
  const [nextStatus, setNextStatus] = useState<string>("");
  const [rcNumberInput, setRcNumberInput] = useState<string>(application.rcNumber || "");

  const createDeclaration = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/lawyer/applications/${applicationId}/execution-declaration`, {
        declarationType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString(), "execution-declarations"] });
      toast({ title: "Declaration signed successfully" });
      setIsDialogOpen(false);
      setDeclarationType("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to sign declaration", description: error.message, variant: "destructive" });
    },
  });

  const advanceStatus = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { status: nextStatus };
      if (rcNumberInput.trim()) body.rcNumber = rcNumberInput.trim();
      return apiRequest("POST", `/api/lawyer/applications/${applicationId}/status`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Application status updated" });
      setNextStatus("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const canSign = application.status === "under_review" || application.status === "submitted";
  const allowedNextStatuses = STATUS_TRANSITIONS[application.status || ""] || [];

  const declarationLabels: Record<string, string> = {
    document_verified: "I have verified all submitted documents are authentic and complete.",
    application_reviewed: "I have reviewed the application and confirm it meets all CAC requirements.",
    cac_filed: "I have filed this application with the Corporate Affairs Commission.",
    originals_received: "I have received the stamped original documents from CAC.",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Execution Declarations</h3>
          <p className="text-sm text-muted-foreground">Chain-of-custody tracking for document submissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canSign} data-testid="btn-sign-declaration">
              <Shield className="h-4 w-4 mr-2" />
              Sign Declaration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sign Execution Declaration</DialogTitle>
              <DialogDescription>
                This declaration confirms your role in preparing and submitting this application.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Declaration Type</Label>
                <Select value={declarationType} onValueChange={setDeclarationType}>
                  <SelectTrigger data-testid="select-declaration-type">
                    <SelectValue placeholder="Select declaration type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document_verified">Documents Verified</SelectItem>
                    <SelectItem value="application_reviewed">Application Reviewed</SelectItem>
                    <SelectItem value="cac_filed">Filed with CAC</SelectItem>
                    <SelectItem value="originals_received">Originals Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {declarationType && (
                <div className="space-y-2">
                  <Label>Declaration Statement</Label>
                  <div className="p-4 rounded-lg bg-muted text-sm leading-relaxed">
                    {declarationLabels[declarationType]}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">
                  By signing this declaration, you confirm that you have reviewed all documents and 
                  take responsibility for the accuracy of this submission.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createDeclaration.mutate()}
                disabled={!declarationType || createDeclaration.isPending}
                data-testid="btn-confirm-sign"
              >
                {createDeclaration.isPending ? <LoadingSpinner size="sm" /> : "Sign Declaration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!canSign && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm">
                Execution declarations can only be signed when the application is under review.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {declarations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No declarations signed yet</p>
            </CardContent>
          </Card>
        ) : (
          declarations.map((dec) => (
            <Card key={dec.id} data-testid={`declaration-${dec.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      {dec.submissionType === "digital" ? "Digital" : "Physical"} Submission Declaration
                    </CardTitle>
                    <CardDescription>
                      Signed on {new Date(dec.createdAt!).toLocaleDateString()} at {new Date(dec.createdAt!).toLocaleTimeString()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dec.submissionLocation && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Location</Label>
                      <p className="font-medium">{dec.submissionLocation}</p>
                    </div>
                  )}
                  {dec.notes && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Notes</Label>
                      <p className="text-sm mt-1 p-3 rounded-lg bg-muted">{dec.notes}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {dec.declarationAccepted && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        Declaration Accepted
                      </span>
                    )}
                    {dec.declarationTextVersion && (
                      <span>Version: {dec.declarationTextVersion}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {allowedNextStatuses.length > 0 && (
        <Card data-testid="card-advance-status">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ChevronRight className="h-5 w-5" />
              Advance Application Status
            </CardTitle>
            <CardDescription>
              Move this application to the next stage in the incorporation process.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {application.rcNumber && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <Hash className="h-4 w-4 text-primary shrink-0" />
                <span>RC Number on file: <span className="font-semibold">{application.rcNumber}</span></span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="select-next-status">Next Status</Label>
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger id="select-next-status" data-testid="select-next-status">
                  <SelectValue placeholder="Select next stage" />
                </SelectTrigger>
                <SelectContent>
                  {allowedNextStatuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {nextStatus && STATUS_REQUIRES_RC.has(nextStatus) && (
              <div className="space-y-2">
                <Label htmlFor="input-rc-number">
                  CAC RC Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="input-rc-number"
                  placeholder="e.g. RC1234567"
                  value={rcNumberInput}
                  onChange={(e) => setRcNumberInput(e.target.value)}
                  data-testid="input-rc-number"
                />
                <p className="text-xs text-muted-foreground">
                  Required when marking as filed or completed. This will be recorded on the application.
                </p>
              </div>
            )}

            <Button
              onClick={() => advanceStatus.mutate()}
              disabled={!nextStatus || advanceStatus.isPending || (STATUS_REQUIRES_RC.has(nextStatus) && !application.rcNumber && !rcNumberInput.trim())}
              data-testid="btn-advance-status"
            >
              {advanceStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              Confirm Status Change
            </Button>
          </CardContent>
        </Card>
      )}

      {allowedNextStatuses.length === 0 && application.status !== "draft" && (
        <Card className="border-muted" data-testid="card-status-terminal">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <span>
                {application.status === "completed"
                  ? "This application is complete. No further status changes are available."
                  : application.status === "rejected"
                  ? "This application has been rejected. No further status changes are available."
                  : "Status advancement is not available at the current stage."}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
