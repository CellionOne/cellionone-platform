import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useState } from "react";
import {
  Building2,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";
import type { CompanyApplication } from "@shared/schema";

export default function LawyerApplications() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: applications, isLoading } = useQuery<CompanyApplication[]>({
    queryKey: ["/api/lawyer/applications"],
  });

  const filteredApplications = applications?.filter((app) => {
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesSearch = !searchQuery || 
      app.companyName1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout 
      role="lawyer" 
      breadcrumbs={[{ label: "Dashboard", href: "/lawyer/dashboard" }, { label: "Assigned Cases" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Assigned Cases</h1>
          <p className="text-muted-foreground">
            Review and process your assigned applications
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="names_submitted">Name Check Required</SelectItem>
              <SelectItem value="names_reviewed">Names Reviewed</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="clarification_requested">Clarification Requested</SelectItem>
              <SelectItem value="filed">Filed</SelectItem>
              <SelectItem value="pending_originals">Pending Originals</SelectItem>
              <SelectItem value="courier_in_transit">Courier In Transit</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !filteredApplications?.length ? (
          <EmptyState
            icon={Building2}
            title="No cases found"
            description={searchQuery || statusFilter !== "all" 
              ? "Try adjusting your search or filter."
              : "You don't have any cases assigned yet."
            }
          />
        ) : (
          <div className="grid gap-4">
            {filteredApplications.map((app) => (
              <Card key={app.id} className="hover-elevate" data-testid={`case-card-${app.id}`}>
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
                          <span>Application #{app.id}</span>
                          <span>&bull;</span>
                          <span>{app.companyType || "LTD"}</span>
                          <span>&bull;</span>
                          <span>{app.applicationType === "incorporation" ? "Incorporation" : "Post-Inc"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0">
                      <StatusBadge status={app.status || "draft"} />
                      <Button variant="outline" size="sm" asChild data-testid={`button-review-${app.id}`}>
                        <Link href={`/lawyer/applications/${app.id}`}>
                          Review
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
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
