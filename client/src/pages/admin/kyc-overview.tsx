import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Eye,
  Ban,
  PlayCircle,
} from "lucide-react";

interface KycStats {
  totalOrgs: number;
  activeOrgs: number;
  totalRequests: number;
  verified: number;
  pending: number;
  rejected: number;
  paidVerifications: number;
}

interface KycOrgWithStats {
  id: number;
  name: string;
  slug: string;
  category: string;
  contactEmail: string;
  status: string;
  createdAt: string;
  totalRequests: number;
  verifiedRequests: number;
  pendingRequests: number;
  memberCount: number;
}

interface KycOrgDetail {
  id: number;
  name: string;
  slug: string;
  category: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  members: { id: number; role: string; inviteEmail: string; inviteStatus: string }[];
  stats: {
    total: number;
    pending: number;
    underReview: number;
    verified: number;
    rejected: number;
    expired: number;
  };
  recentRequests: {
    id: number;
    type: string;
    status: string;
    subjectName: string;
    subjectEmail: string;
    createdAt: string;
  }[];
}

export default function AdminKycOverview() {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ orgId: number; action: "active" | "suspended"; orgName: string } | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<KycStats>({
    queryKey: ["/api/admin/kyc/stats"],
  });

  const { data: orgs, isLoading: orgsLoading } = useQuery<KycOrgWithStats[]>({
    queryKey: ["/api/admin/kyc/organisations"],
  });

  const { data: orgDetail, isLoading: detailLoading } = useQuery<KycOrgDetail>({
    queryKey: ["/api/admin/kyc/organisations", selectedOrgId],
    enabled: !!selectedOrgId,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orgId, status }: { orgId: number; status: string }) => {
      await apiRequest("PATCH", `/api/admin/kyc/organisations/${orgId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/organisations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/stats"] });
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/organisations", selectedOrgId] });
      }
      toast({ title: "Status updated", description: "Organisation status has been updated." });
      setConfirmAction(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    },
  });

  const isLoading = statsLoading || orgsLoading;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "KYC Oversight" }]}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-kyc-oversight-title">KYC Oversight</h1>
          <p className="text-muted-foreground">Monitor KYC organisations, verification requests, and platform metrics</p>
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Organisations</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-orgs">{stats?.totalOrgs || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.activeOrgs || 0} active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Verification Requests</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-requests">{stats?.totalRequests || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.pending || 0} pending</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-verified-count">{stats?.verified || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.rejected || 0} rejected</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Paid Verifications</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-paid-verifications">{stats?.paidVerifications || 0}</div>
                </CardContent>
              </Card>
            </div>

            {!orgs || orgs.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No KYC Organisations"
                description="No organisations have been created yet."
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Organisations</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organisation</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Requests</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgs.map((org) => (
                        <TableRow key={org.id} data-testid={`row-kyc-org-${org.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-xs text-muted-foreground">{org.contactEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{org.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={org.status === "active" ? "default" : "destructive"} data-testid={`badge-status-${org.id}`}>
                              {org.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{org.memberCount}</TableCell>
                          <TableCell>{org.totalRequests}</TableCell>
                          <TableCell>{org.verifiedRequests}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(org.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setSelectedOrgId(org.id)}
                                data-testid={`button-view-org-${org.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {org.status === "active" ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setConfirmAction({ orgId: org.id, action: "suspended", orgName: org.name })}
                                  data-testid={`button-suspend-org-${org.id}`}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setConfirmAction({ orgId: org.id, action: "active", orgName: org.name })}
                                  data-testid={`button-reactivate-org-${org.id}`}
                                >
                                  <PlayCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedOrgId} onOpenChange={(open) => { if (!open) setSelectedOrgId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : orgDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {orgDetail.name}
                  <Badge variant={orgDetail.status === "active" ? "default" : "destructive"}>
                    {orgDetail.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{orgDetail.contactEmail} | {orgDetail.category}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-detail-total">{orgDetail.stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Requests</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-detail-verified">{orgDetail.stats.verified}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-detail-pending">{orgDetail.stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>

              {orgDetail.members.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Members ({orgDetail.members.length})</h4>
                  <div className="space-y-1">
                    {orgDetail.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{m.inviteEmail}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{m.role.replace("org_", "")}</Badge>
                          <Badge variant={m.inviteStatus === "accepted" ? "default" : "secondary"}>
                            {m.inviteStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orgDetail.recentRequests.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Recent Requests</h4>
                  <div className="space-y-2">
                    {orgDetail.recentRequests.slice(0, 10).map((req) => (
                      <div key={req.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{req.subjectName}</p>
                          <p className="text-xs text-muted-foreground">{req.type} | {formatDate(req.createdAt)}</p>
                        </div>
                        <Badge variant={
                          req.status === "verified" ? "default" :
                          req.status === "rejected" ? "destructive" : "secondary"
                        }>
                          {req.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "suspended" ? "Suspend Organisation" : "Reactivate Organisation"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "suspended"
                ? `Are you sure you want to suspend "${confirmAction?.orgName}"? This will prevent them from creating new verification requests.`
                : `Are you sure you want to reactivate "${confirmAction?.orgName}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === "suspended" ? "destructive" : "default"}
              onClick={() => {
                if (confirmAction) {
                  statusMutation.mutate({ orgId: confirmAction.orgId, status: confirmAction.action });
                }
              }}
              disabled={statusMutation.isPending}
              data-testid="button-confirm-action"
            >
              {statusMutation.isPending ? "Updating..." : confirmAction?.action === "suspended" ? "Suspend" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
