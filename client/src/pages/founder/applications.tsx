import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  Building2,
  Plus,
  ArrowRight,
  Calendar,
} from "lucide-react";
import type { CompanyApplication } from "@shared/schema";

export default function FounderApplications() {
  const { data: applications, isLoading } = useQuery<CompanyApplication[]>({
    queryKey: ["/api/founder/applications"],
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout 
      role="founder" 
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "My Applications" }]}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Applications</h1>
            <p className="text-muted-foreground">
              Manage your company registration applications
            </p>
          </div>
          <Button asChild data-testid="button-new-application">
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
        ) : !applications?.length ? (
          <EmptyState
            icon={Building2}
            title="No applications yet"
            description="Start your company registration journey by creating a new application."
            action={
              <Button asChild>
                <Link href="/applications/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Application
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {applications.map((app) => (
              <Card key={app.id} className="hover-elevate" data-testid={`application-card-${app.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-lg truncate">
                          {app.companyName1 || "Untitled Application"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                          <span>
                            {app.applicationType === "incorporation" ? "Company Incorporation" : "Post-Incorporation"}
                          </span>
                          <span>&bull;</span>
                          <span>{app.companyType || "LLC"}</span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(app.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0">
                      <StatusBadge status={app.status || "draft"} />
                      <Button variant="outline" size="sm" asChild data-testid={`button-view-${app.id}`}>
                        <Link href={`/applications/${app.id}`}>
                          View Details
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  
                  {app.businessDescription && (
                    <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
                      {app.businessDescription}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
