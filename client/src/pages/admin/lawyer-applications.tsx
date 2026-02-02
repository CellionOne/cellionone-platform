import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCheck, UserX, Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";

interface LawyerApplication {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  barId: string;
  scnNumber?: string;
  firmName?: string;
  firmAddress?: string;
  yearsOfExperience?: number;
  specializations?: string[];
  serviceRegions?: string[];
  statementOfInterest?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive"; icon: React.ReactNode }> = {
    pending: { variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" /> },
    approved: { variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    rejected: { variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" /> },
  };

  const config = variants[status] || variants.pending;

  return (
    <Badge variant={config.variant} className="capitalize">
      {config.icon}
      {status}
    </Badge>
  );
}

export default function AdminLawyerApplicationsPage() {
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<LawyerApplication | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: applications = [], isLoading } = useQuery<LawyerApplication[]>({
    queryKey: ["/api/admin/lawyer-applications"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, rejectionReason }: { id: number; action: "approve" | "reject"; rejectionReason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/lawyer-applications/${id}/review`, {
        action,
        rejectionReason,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.action === "approve" ? "Application approved" : "Application rejected",
        description: variables.action === "approve" 
          ? "The lawyer account has been created and a verification email was sent."
          : "The applicant will be notified of the decision.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lawyer-applications"] });
      setViewDialogOpen(false);
      setRejectDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Action failed",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const pendingApplications = applications.filter(app => app.status === "pending");
  const reviewedApplications = applications.filter(app => app.status !== "pending");

  const handleApprove = (app: LawyerApplication) => {
    reviewMutation.mutate({ id: app.id, action: "approve" });
  };

  const handleRejectClick = (app: LawyerApplication) => {
    setSelectedApplication(app);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedApplication) {
      reviewMutation.mutate({ 
        id: selectedApplication.id, 
        action: "reject",
        rejectionReason: rejectionReason || "Application did not meet requirements",
      });
    }
  };

  const handleView = (app: LawyerApplication) => {
    setSelectedApplication(app);
    setViewDialogOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Lawyer Applications</h1>
          <p className="text-muted-foreground">Review and approve new lawyer applications</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-count">{pendingApplications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-approved-count">
                {applications.filter(a => a.status === "approved").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-rejected-count">
                {applications.filter(a => a.status === "rejected").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {pendingApplications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Applications</CardTitle>
              <CardDescription>Applications awaiting your review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingApplications.map((app) => (
                  <div 
                    key={app.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`card-application-${app.id}`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{app.firstName} {app.lastName}</p>
                      <p className="text-sm text-muted-foreground">{app.email}</p>
                      <p className="text-sm text-muted-foreground">Bar ID: {app.barId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleView(app)}
                        data-testid={`button-view-${app.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleRejectClick(app)}
                        disabled={reviewMutation.isPending}
                        data-testid={`button-reject-${app.id}`}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleApprove(app)}
                        disabled={reviewMutation.isPending}
                        data-testid={`button-approve-${app.id}`}
                      >
                        {reviewMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <UserCheck className="h-4 w-4 mr-1" />
                        )}
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {pendingApplications.length === 0 && applications.length === 0 && (
          <EmptyState
            title="No applications yet"
            description="When lawyers apply to join the platform, their applications will appear here for review."
          />
        )}

        {reviewedApplications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reviewed Applications</CardTitle>
              <CardDescription>Previously processed applications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reviewedApplications.map((app) => (
                  <div 
                    key={app.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`card-reviewed-${app.id}`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{app.firstName} {app.lastName}</p>
                      <p className="text-sm text-muted-foreground">{app.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={app.status} />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleView(app)}
                        data-testid={`button-view-reviewed-${app.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Review the applicant's information
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p>{selectedApplication.firstName} {selectedApplication.lastName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p>{selectedApplication.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p>{selectedApplication.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bar ID</p>
                  <p>{selectedApplication.barId}</p>
                </div>
                {selectedApplication.scnNumber && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">SCN Number</p>
                    <p>{selectedApplication.scnNumber}</p>
                  </div>
                )}
                {selectedApplication.firmName && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Firm Name</p>
                    <p>{selectedApplication.firmName}</p>
                  </div>
                )}
                {selectedApplication.yearsOfExperience !== undefined && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Years of Experience</p>
                    <p>{selectedApplication.yearsOfExperience}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <StatusBadge status={selectedApplication.status} />
                </div>
              </div>
              {selectedApplication.firmAddress && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Office Address</p>
                  <p>{selectedApplication.firmAddress}</p>
                </div>
              )}
              {selectedApplication.statementOfInterest && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Statement of Interest</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-md">{selectedApplication.statementOfInterest}</p>
                </div>
              )}
              {selectedApplication.rejectionReason && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Rejection Reason</p>
                  <p className="text-sm text-destructive">{selectedApplication.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {selectedApplication?.status === "pending" && (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setViewDialogOpen(false);
                    handleRejectClick(selectedApplication);
                  }}
                >
                  Reject
                </Button>
                <Button onClick={() => handleApprove(selectedApplication)}>
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this application
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            data-testid="input-rejection-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm}
              disabled={reviewMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
