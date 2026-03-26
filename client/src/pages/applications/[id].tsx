import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner, LoadingPage } from "@/components/loading-spinner";
import { ReadinessPanel } from "@/components/readiness-panel";
import { OfflineSyncStatus } from "@/components/offline-sync-status";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { useCheckout } from "@/hooks/use-checkout";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  const applicationId = params?.id;

  const { data, isLoading } = useQuery<ApplicationDetails>({
    queryKey: ["/api/applications", applicationId],
    enabled: !!applicationId,
  });

  const { data: teamReadiness } = useQuery<ReadinessSummary>({
    queryKey: ["/api/company-people/readiness"],
  });
  const teamPeople = teamReadiness?.people ?? [];

  const { uploadFile, isUploading: isFileUploading } = useUpload({
    applicationId: parseInt(applicationId || "0", 10),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ checklistId, file }: { checklistId: number; file: File }) => {
      const uploadResult = await uploadFile(file);
      if (!uploadResult) {
        throw new Error("Failed to upload file to storage");
      }
      
      const response = await apiRequest("POST", `/api/applications/${applicationId}/documents`, {
        checklistItemId: checklistId.toString(),
        storagePath: uploadResult.objectPath,
        filename: file.name,
        docType: "uploaded_document",
      });
      
      if (!response.ok) throw new Error("Failed to save document record");
      return response.json();
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

  const { checkoutIncorporation } = useCheckout();

  const handlePayment = () => {
    if (applicationId) {
      checkoutIncorporation(parseInt(applicationId, 10));
    }
  };

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
  
  const completedItems = checklist.filter(item => item.status === "provided" || item.status === "accepted").length;
  const requiredItems = checklist.filter(item => item.required).length;
  const progress = requiredItems > 0 ? (completedItems / requiredItems) * 100 : 0;

  const currentStatusIndex = statusTimeline.findIndex(s => s.status === application.status);

  const canSubmit = application.status === "draft" && 
    progress === 100 && 
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
                  {checklist.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between" data-testid={`checklist-${item.key}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
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
                          {item.required && <span className="text-xs text-muted-foreground">Required</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status || "missing"} />
                        {(item.status === "missing" || item.status === "rejected") && (
                          <div className="relative">
                            <Input
                              type="file"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadMutation.mutate({ checklistId: item.id, file });
                                }
                              }}
                              data-testid={`upload-${item.key}`}
                            />
                            <Button variant="outline" size="sm" className="pointer-events-none">
                              <Upload className="h-4 w-4 mr-1" />
                              Upload
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment
                </CardTitle>
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
                    {payment.status !== "success" && (
                      <Button 
                        className="w-full" 
                        onClick={handlePayment}
                        data-testid="button-pay"
                      >
                        Pay Now
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Ready to pay for your incorporation
                    </p>
                    <Button 
                      className="w-full" 
                      onClick={handlePayment}
                      data-testid="button-initiate-payment"
                    >
                      Pay Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
                        <Badge
                          variant={isVerified ? "default" : "secondary"}
                          className={`text-xs shrink-0 ${isVerified ? "bg-green-600 hover:bg-green-600" : ""}`}
                        >
                          {isVerified ? "Verified" : isPending ? "Invited" : hasProfile ? "Profile Ready" : "Profile Incomplete"}
                        </Badge>
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
