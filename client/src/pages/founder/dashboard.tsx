import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Shield,
  ArrowRight,
  Building2,
} from "lucide-react";
import type { CompanyApplication, IdentityVerification } from "@shared/schema";

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

export default function FounderDashboard() {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/founder/dashboard"],
  });

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

            {data?.identity?.status !== "verified" && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Complete Your Identity Verification</CardTitle>
                    <CardDescription>
                      You need to verify your identity before submitting applications
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
