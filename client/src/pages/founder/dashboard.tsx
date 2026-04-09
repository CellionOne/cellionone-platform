import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Shield,
  ArrowRight,
  Building2,
  ShieldCheck,
  CalendarClock,
  ListChecks,
  Calendar,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import type { CompanyApplication, IdentityVerification, CompanyProfile, PostIncorporationTask, ComplianceDeadline } from "@shared/schema";
import { InvitationBanner } from "@/components/invitation-banner";
import { ClipboardCheck, ExternalLink } from "lucide-react";

interface DashboardData {
  applications: CompanyApplication[];
  identity: IdentityVerification | null;
  stats: {
    total: number;
    draft: number;
    inProgress: number;
    completed: number;
  };
}

interface VerificationStatus {
  isVerified: boolean;
  status: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  requiresVerification: boolean;
  verificationId: number | null;
}

export default function FounderDashboard() {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/founder/dashboard"],
  });

  const { data: verificationStatus } = useQuery<VerificationStatus>({
    queryKey: ["/api/founder/verification-status"],
  });

  const { data: profiles } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/founder/company-profiles"],
  });

  const firstProfileId = profiles?.[0]?.id;
  const existingCompanyPendingReview =
    profiles?.some((p) => p.isExistingCompany && ["pending_review", "documents_under_review"].includes(p.existingCompanyStatus || "")) ?? false;
  const existingCompanyRejected =
    profiles?.find((p) => p.isExistingCompany && p.existingCompanyStatus === "rejected") ?? null;

  const { data: tasks } = useQuery<PostIncorporationTask[]>({
    queryKey: ["/api/founder/company-profiles", firstProfileId, "checklist"],
    enabled: !!firstProfileId,
  });

  const { data: deadlines } = useQuery<ComplianceDeadline[]>({
    queryKey: ["/api/founder/company-profiles", firstProfileId, "compliance"],
    enabled: !!firstProfileId,
  });

  const { data: kycOrgs } = useQuery<any[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const { data: myVerifications } = useQuery<any[]>({
    queryKey: ["/api/kyc-service/my-verifications"],
  });

  const kycOrgCount = kycOrgs?.length || 0;
  const pendingVerifications = myVerifications?.filter((v: any) => !["verified", "rejected", "expired"].includes(v.status))?.length || 0;
  const completedVerifications = myVerifications?.filter((v: any) => v.status === "verified")?.length || 0;
  const hasKycContext = kycOrgCount > 0 || (myVerifications && myVerifications.length > 0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}, {user?.firstName || "Founder"}
            </h1>
            <p className="text-muted-foreground">
              Here's an overview of your company registrations
            </p>
          </div>
          <Button asChild data-testid="button-new-application-header">
            <Link href="/applications/new">
              <Plus className="h-4 w-4 mr-2" />
              New Application
            </Link>
          </Button>
        </div>

        <InvitationBanner />

        {existingCompanyPendingReview && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Your existing company is under review
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                Our team is verifying your company details. You'll receive an email once the review is complete and your account is fully activated.
              </p>
            </div>
          </div>
        )}

        {existingCompanyRejected && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Company verification was not successful
              </p>
              {(existingCompanyRejected as any).rejectionReason && (
                <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
                  Reason: {(existingCompanyRejected as any).rejectionReason}
                </p>
              )}
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                Please re-submit your company with the required corrections.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0 border-red-300 text-red-700 hover:bg-red-50" data-testid="button-resubmit-company">
              <Link href="/founder/existing-company">Re-submit</Link>
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="stat-total">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Applications
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.total || 0}</div>
                </CardContent>
              </Card>

              <Card data-testid="stat-draft">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Draft
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.draft || 0}</div>
                </CardContent>
              </Card>

              <Card data-testid="stat-in-progress">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    In Progress
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.inProgress || 0}</div>
                </CardContent>
              </Card>

              <Card data-testid="stat-completed">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.completed || 0}</div>
                </CardContent>
              </Card>
            </div>

            {verificationStatus?.isVerified ? (
              <Card className="border-green-500/30 bg-green-500/5" data-testid="verification-status-verified">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Identity Verified</CardTitle>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Active
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {verificationStatus.daysUntilExpiry && verificationStatus.daysUntilExpiry <= 30 ? (
                        <span className="text-orange-600 dark:text-orange-400">
                          Expires in {verificationStatus.daysUntilExpiry} days - renew soon
                        </span>
                      ) : (
                        <span>
                          Valid until {verificationStatus.expiresAt 
                            ? new Date(verificationStatus.expiresAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })
                            : "N/A"
                          }
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ) : verificationStatus?.status === "in_progress" ? (
              <Card className="border-blue-500/30 bg-blue-500/5" data-testid="verification-status-pending">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Verification In Progress</CardTitle>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Processing
                      </Badge>
                    </div>
                    <CardDescription>
                      Your identity verification is being processed. This usually takes a few minutes.
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ) : verificationStatus?.status === "expired" ? (
              <Card className="border-orange-500/50 bg-orange-500/5" data-testid="verification-status-expired">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Verification Expired</CardTitle>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        Renewal Required
                      </Badge>
                    </div>
                    <CardDescription>
                      Your identity verification has expired. Please verify again to continue registering companies.
                    </CardDescription>
                  </div>
                  <Button asChild data-testid="button-renew-verification">
                    <Link href="/founder/identity">
                      Verify Again
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardHeader>
              </Card>
            ) : (
              <Card className="border-primary/50 bg-primary/5" data-testid="verification-status-required">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Complete Your Identity Verification</CardTitle>
                    <CardDescription>
                      You need to verify your identity before submitting applications. Verification is valid for one year.
                    </CardDescription>
                  </div>
                  <Button asChild data-testid="button-verify-identity">
                    <Link href="/founder/identity">
                      Verify Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardHeader>
              </Card>
            )}

            {profiles && profiles.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="hover-elevate" data-testid="widget-checklist">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Post-Inc. Checklist
                    </CardTitle>
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {tasks && tasks.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">
                            {tasks.filter(t => t.status === "completed").length}/{tasks.length}
                          </span>
                          <span className="text-sm text-muted-foreground">completed</span>
                        </div>
                        <Progress 
                          value={(tasks.filter(t => t.status === "completed").length / tasks.length) * 100} 
                          className="h-2"
                        />
                        <Button variant="ghost" size="sm" asChild className="w-full" data-testid="link-checklist">
                          <Link href="/founder/post-inc-checklist">
                            View Checklist
                            <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" asChild className="w-full" data-testid="link-checklist-start">
                        <Link href="/founder/post-inc-checklist">
                          Get Started
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="hover-elevate" data-testid="widget-compliance">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Compliance
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {deadlines && deadlines.length > 0 ? (
                      <>
                        {deadlines.filter(d => d.status === "overdue").length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {deadlines.filter(d => d.status === "overdue").length} overdue
                            </span>
                          </div>
                        )}
                        {deadlines.filter(d => d.status === "due_soon").length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-amber-600 dark:text-amber-400">
                              {deadlines.filter(d => d.status === "due_soon").length} due soon
                            </span>
                          </div>
                        )}
                        {deadlines.filter(d => d.status === "upcoming").length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                            <span>{deadlines.filter(d => d.status === "upcoming").length} upcoming</span>
                          </div>
                        )}
                        <Button variant="ghost" size="sm" asChild className="w-full" data-testid="link-compliance">
                          <Link href="/founder/compliance">
                            View Calendar
                            <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" asChild className="w-full" data-testid="link-compliance-start">
                        <Link href="/founder/compliance">
                          Set Up Deadlines
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="hover-elevate" data-testid="widget-ai">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Legal AI Assistant
                    </CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Get instant answers about Nigerian company law, CAC processes, and compliance.
                    </p>
                    <Button variant="ghost" size="sm" asChild className="w-full" data-testid="link-ai-assistant">
                      <Link href="/founder/legal-assistant">
                        Ask a Question
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {hasKycContext && (
              <div data-testid="section-kyc-context">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">KYC Service</h2>
                  <div className="flex gap-2">
                    {kycOrgCount > 0 && (
                      <Button variant="ghost" size="sm" asChild data-testid="link-kyc-orgs">
                        <Link href="/kyc/orgs">My Organisations</Link>
                      </Button>
                    )}
                    {myVerifications && myVerifications.length > 0 && (
                      <Button variant="ghost" size="sm" asChild data-testid="link-my-verifications">
                        <Link href="/kyc/my-verifications">My Verifications</Link>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card data-testid="stat-kyc-orgs">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">KYC Organisations</CardTitle>
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kycOrgCount}</div>
                      <p className="text-xs text-muted-foreground mt-1">Organisations you manage</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="stat-kyc-pending">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{pendingVerifications}</div>
                      <p className="text-xs text-muted-foreground mt-1">Verifications awaiting action</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="stat-kyc-completed">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{completedVerifications}</div>
                      <p className="text-xs text-muted-foreground mt-1">Completed verifications</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Recent Applications</h2>
                <Button variant="ghost" size="sm" asChild data-testid="link-view-all">
                  <Link href="/founder/applications">View All</Link>
                </Button>
              </div>

              {!data?.applications?.length ? (
                <EmptyState
                  icon={Building2}
                  title="No applications yet"
                  description="Start your company registration journey by creating a new application."
                  action={
                    <Button asChild data-testid="button-create-first">
                      <Link href="/applications/new">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Application
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4">
                  {data.applications.slice(0, 5).map((app) => (
                    <Card key={app.id} className="hover-elevate" data-testid={`application-card-${app.id}`}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium">
                              {app.companyName1 || "Untitled Application"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {app.applicationType === "incorporation" ? "Company Incorporation" : "Post-Incorporation"} 
                              {" "}&bull;{" "}
                              {app.companyType || "LTD"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={app.status || "draft"} />
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/applications/${app.id}`}>
                              View
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
