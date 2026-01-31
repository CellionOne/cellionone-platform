import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";
import {
  Scale,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Building2,
} from "lucide-react";
import type { CompanyApplication } from "@shared/schema";

interface LawyerDashboardData {
  applications: CompanyApplication[];
  stats: {
    assigned: number;
    underReview: number;
    clarificationPending: number;
    completed: number;
  };
}

export default function LawyerDashboard() {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery<LawyerDashboardData>({
    queryKey: ["/api/lawyer/dashboard"],
  });

  return (
    <DashboardLayout role="lawyer" breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {user?.firstName || "Counsel"}
          </h1>
          <p className="text-muted-foreground">
            Manage your assigned applications and cases
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Assigned Cases
                  </CardTitle>
                  <Scale className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.assigned || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Under Review
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.underReview || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Awaiting Clarification
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data?.stats?.clarificationPending || 0}</div>
                </CardContent>
              </Card>

              <Card>
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

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Active Cases</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/lawyer/applications">View All</Link>
                </Button>
              </div>

              {!data?.applications?.length ? (
                <EmptyState
                  icon={FileText}
                  title="No assigned cases"
                  description="You don't have any cases assigned yet. Check back later."
                />
              ) : (
                <div className="grid gap-4">
                  {data.applications.slice(0, 5).map((app) => (
                    <Card key={app.id} className="hover-elevate" data-testid={`case-card-${app.id}`}>
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
                              {app.companyType || "LLC"} &bull; Application #{app.id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={app.status || "draft"} />
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/lawyer/applications/${app.id}`}>
                              Review
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
