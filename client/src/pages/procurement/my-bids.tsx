import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Award,
  Eye,
  Ban,
  Gavel,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import type { Bid } from "@shared/schema";

function formatNGN(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}

function getStatusConfig(status: string) {
  switch (status) {
    case "draft":
      return { label: "Draft", icon: Clock, variant: "outline" as const };
    case "submitted":
      return { label: "Submitted", icon: Send, variant: "secondary" as const };
    case "shortlisted":
      return { label: "Shortlisted", icon: Star, variant: "default" as const };
    case "awarded":
      return { label: "Awarded", icon: Award, variant: "default" as const };
    case "rejected":
      return { label: "Rejected", icon: XCircle, variant: "destructive" as const };
    case "withdrawn":
      return { label: "Withdrawn", icon: Ban, variant: "outline" as const };
    default:
      return { label: status, icon: FileText, variant: "outline" as const };
  }
}

export default function MyBidsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: bids, isLoading } = useQuery<Bid[]>({
    queryKey: ["/api/procurement/my-bids"],
  });

  const { data: orgs } = useQuery<any[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const primaryOrg = orgs?.[0];
  const orgStatus = primaryOrg?.status;
  const orgBlocked = orgStatus === "pending_review" || orgStatus === "suspended";

  const withdrawMutation = useMutation({
    mutationFn: async (bidId: number) => {
      await apiRequest("POST", `/api/procurement/bids/${bidId}/withdraw`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/my-bids"] });
      toast({ title: "Bid withdrawn" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to withdraw bid", description: error.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (bidId: number) => {
      await apiRequest("POST", `/api/procurement/bids/${bidId}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/my-bids"] });
      toast({ title: "Bid submitted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit bid", description: error.message, variant: "destructive" });
    },
  });

  const draftCount = bids?.filter(b => b.status === "draft").length || 0;
  const submittedCount = bids?.filter(b => b.status === "submitted").length || 0;
  const awardedCount = bids?.filter(b => b.status === "awarded").length || 0;
  const totalValue = bids?.reduce((sum, b) => sum + (b.totalAmount || 0), 0) || 0;

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "My Bids" }]}>
      <div className="space-y-6">
        {orgStatus === "pending_review" && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20" data-testid="alert-org-pending">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Your organisation is pending admin review. Submitting bids is disabled until your account is approved.
            </AlertDescription>
          </Alert>
        )}
        {orgStatus === "suspended" && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20" data-testid="alert-org-suspended">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              Your organisation has been suspended. Please contact <a href="mailto:service@cellionone.com" className="underline">service@cellionone.com</a> to resolve this.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">My Bids</h1>
            <p className="text-muted-foreground text-sm">Track all your submitted bids</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/procurement/marketplace")} data-testid="button-browse-rfqs">
            <Gavel className="h-4 w-4 mr-2" />
            Browse RFQs
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-drafts">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-draft-count">{draftCount}</p>
                  <p className="text-xs text-muted-foreground">Drafts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-submitted">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Send className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-submitted-count">{submittedCount}</p>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-awarded">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Award className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-awarded-count">{awardedCount}</p>
                  <p className="text-xs text-muted-foreground">Awarded</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-value">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-value">{formatNGN(totalValue)}</p>
                  <p className="text-xs text-muted-foreground">Total Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : !bids || bids.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No bids yet"
            description="Browse open RFQs in the marketplace to submit your first bid."
            action={
              <Button onClick={() => navigate("/procurement/marketplace")} data-testid="button-empty-browse">
                Browse Marketplace
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {bids.map(bid => {
              const config = getStatusConfig(bid.status);
              const StatusIcon = config.icon;
              return (
                <Card key={bid.id} className="hover-elevate" data-testid={`card-bid-${bid.id}`}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold" data-testid={`text-bid-rfq-${bid.id}`}>
                          RFQ #{bid.rfqId}
                        </h3>
                        <Badge variant={config.variant} data-testid={`badge-status-${bid.id}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span data-testid={`text-bid-amount-${bid.id}`}>{formatNGN(bid.totalAmount)}</span>
                        {bid.deliveryTimeline && (
                          <>
                            <span>|</span>
                            <span>{bid.deliveryTimeline}</span>
                          </>
                        )}
                        <span>|</span>
                        <span data-testid={`text-bid-date-${bid.id}`}>
                          {new Date(bid.createdAt!).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {bid.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => submitMutation.mutate(bid.id)}
                          disabled={submitMutation.isPending || orgBlocked}
                          data-testid={`button-submit-${bid.id}`}
                          title={orgBlocked ? "Organisation approval required before submitting bids" : undefined}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Submit
                        </Button>
                      )}
                      {(bid.status === "draft" || bid.status === "submitted") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => withdrawMutation.mutate(bid.id)}
                          disabled={withdrawMutation.isPending}
                          data-testid={`button-withdraw-${bid.id}`}
                        >
                          <Ban className="h-3 w-3 mr-1" />
                          Withdraw
                        </Button>
                      )}
                      <Link href={`/procurement/rfqs/${bid.rfqId}`}>
                        <Button variant="ghost" size="sm" data-testid={`button-view-rfq-${bid.id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          View RFQ
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
