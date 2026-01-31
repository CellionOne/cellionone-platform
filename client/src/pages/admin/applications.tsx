import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  Search,
  Filter,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompanyApplication, LawyerProfile } from "@shared/schema";

interface ApplicationWithLawyer extends CompanyApplication {
  lawyerName?: string;
}

export default function AdminApplications() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithLawyer | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState<string>("");

  const { data: applications, isLoading } = useQuery<ApplicationWithLawyer[]>({
    queryKey: ["/api/admin/applications"],
  });

  const { data: lawyers } = useQuery<(LawyerProfile & { email: string; name: string })[]>({
    queryKey: ["/api/admin/lawyers"],
  });

  const assignMutation = useMutation({
    mutationFn: async ({ applicationId, lawyerId }: { applicationId: number; lawyerId: string }) => {
      return apiRequest("POST", `/api/admin/applications/${applicationId}/assign`, { lawyerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Lawyer assigned successfully" });
      setAssignDialogOpen(false);
      setSelectedApp(null);
      setSelectedLawyer("");
    },
    onError: () => {
      toast({ title: "Failed to assign lawyer", variant: "destructive" });
    },
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
      role="admin" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Applications" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">All Applications</h1>
          <p className="text-muted-foreground">
            View and manage all platform applications
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
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
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
            title="No applications found"
            description="Applications will appear here once users create them."
          />
        ) : (
          <div className="grid gap-4">
            {filteredApplications.map((app) => (
              <Card key={app.id} data-testid={`app-row-${app.id}`}>
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
                          <span>#{app.id}</span>
                          <span>&bull;</span>
                          <span>{app.companyType || "LLC"}</span>
                          {app.lawyerName && (
                            <>
                              <span>&bull;</span>
                              <span>Assigned: {app.lawyerName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0">
                      <StatusBadge status={app.status || "draft"} />
                      {!app.assignedLawyerUserId && app.status !== "draft" && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setAssignDialogOpen(true);
                          }}
                          data-testid={`button-assign-${app.id}`}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lawyer</DialogTitle>
            <DialogDescription>
              Select a lawyer to handle "{selectedApp?.companyName1 || 'this application'}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedLawyer} onValueChange={setSelectedLawyer}>
              <SelectTrigger data-testid="select-lawyer">
                <SelectValue placeholder="Select a lawyer" />
              </SelectTrigger>
              <SelectContent>
                {lawyers?.map((lawyer) => (
                  <SelectItem key={lawyer.userId} value={lawyer.userId}>
                    {lawyer.name || lawyer.email} - {lawyer.firmName || "Independent"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedApp && selectedLawyer) {
                  assignMutation.mutate({ 
                    applicationId: selectedApp.id, 
                    lawyerId: selectedLawyer 
                  });
                }
              }}
              disabled={!selectedLawyer || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? <LoadingSpinner size="sm" /> : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
