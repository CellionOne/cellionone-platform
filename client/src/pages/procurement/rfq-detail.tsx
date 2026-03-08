import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useRoute } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Clock,
  ArrowLeft,
  Send,
  XCircle,
  Award,
  Package,
  FileText,
  DollarSign,
  Calendar,
  Users,
  Shield,
  Eye,
} from "lucide-react";
import type { Rfq, RfqItem, Bid, KycOrganisation } from "@shared/schema";

interface RfqWithItems extends Rfq {
  items?: RfqItem[];
  categoryName?: string;
  bidCount?: number;
}

interface BidWithOrg extends Bid {
  orgName?: string;
}

function formatKobo(amount: number | null | undefined): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function getDeadlineInfo(deadline: string | Date): { text: string; urgent: boolean; expired: boolean } {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return { text: "Expired", urgent: true, expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return { text: `${days}d ${hours}h remaining`, urgent: days < 3, expired: false };
  if (hours > 0) return { text: `${hours}h ${minutes}m remaining`, urgent: true, expired: false };
  return { text: `${minutes}m remaining`, urgent: true, expired: false };
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    open: "bg-green-500/10 text-green-600 border-green-200",
    evaluation: "bg-amber-500/10 text-amber-600 border-amber-200",
    awarded: "bg-blue-500/10 text-blue-600 border-blue-200",
    closed: "bg-muted text-muted-foreground",
    cancelled: "bg-red-500/10 text-red-600 border-red-200",
  };
  return (
    <Badge className={styles[status] || ""} data-testid="badge-rfq-status">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function RfqDetailPage() {
  const [, params] = useRoute("/procurement/rfqs/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const rfqId = params?.id ? parseInt(params.id) : 0;

  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [bidSupplierOrgId, setBidSupplierOrgId] = useState("");
  const [bidCoverLetter, setBidCoverLetter] = useState("");
  const [bidDeliveryTimeline, setBidDeliveryTimeline] = useState("");
  const [bidItems, setBidItems] = useState<Array<{ rfqItemId: number; unitPrice: string; quantity: number }>>([]);

  const { data: rfq, isLoading } = useQuery<RfqWithItems>({
    queryKey: ["/api/procurement/rfqs", rfqId],
    enabled: rfqId > 0,
  });

  const { data: bids = [] } = useQuery<BidWithOrg[]>({
    queryKey: ["/api/procurement/rfqs", rfqId, "bids"],
    enabled: rfqId > 0 && !!rfq,
  });

  const { data: orgs = [] } = useQuery<KycOrganisation[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const isBuyer = orgs.some((o) => o.id === rfq?.buyerOrgId);
  const supplierOrgs = orgs.filter((o) => o.id !== rfq?.buyerOrgId);

  const publishMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/procurement/rfqs/${rfqId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/rfqs", rfqId] });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/marketplace"] });
      toast({ title: "RFQ published" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish", description: error.message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/procurement/rfqs/${rfqId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/rfqs", rfqId] });
      toast({ title: "RFQ closed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to close", description: error.message, variant: "destructive" });
    },
  });

  const submitBidMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        supplierOrgId: parseInt(bidSupplierOrgId),
        coverLetter: bidCoverLetter || undefined,
        deliveryTimeline: bidDeliveryTimeline || undefined,
        items: bidItems.filter(i => i.unitPrice).map(i => ({
          rfqItemId: i.rfqItemId,
          unitPrice: Math.round(parseFloat(i.unitPrice) * 100),
          quantity: i.quantity,
        })),
      };
      const totalAmount = payload.items.reduce((sum: number, i: any) => sum + (i.unitPrice * i.quantity), 0);
      payload.totalAmount = totalAmount;

      const res = await apiRequest("POST", `/api/procurement/rfqs/${rfqId}/bids`, payload);
      const bid = await res.json();
      await apiRequest("POST", `/api/procurement/bids/${bid.id}/submit`);
      return bid;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/rfqs", rfqId, "bids"] });
      setBidDialogOpen(false);
      toast({ title: "Bid submitted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit bid", description: error.message, variant: "destructive" });
    },
  });

  const awardMutation = useMutation({
    mutationFn: async (bidId: number) => {
      await apiRequest("POST", `/api/procurement/rfqs/${rfqId}/bids/${bidId}/award`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/rfqs", rfqId] });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/rfqs", rfqId, "bids"] });
      toast({ title: "Contract awarded" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to award", description: error.message, variant: "destructive" });
    },
  });

  function openBidDialog() {
    if (rfq?.items && rfq.items.length > 0) {
      setBidItems(rfq.items.map((item) => ({
        rfqItemId: item.id,
        unitPrice: "",
        quantity: item.quantity,
      })));
    }
    setBidDialogOpen(true);
  }

  if (isLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "RFQ Detail" }]}>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!rfq) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "RFQ Detail" }]}>
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold">RFQ not found</h2>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/procurement/marketplace")} data-testid="button-go-marketplace">
            Go to Marketplace
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const deadlineInfo = getDeadlineInfo(rfq.deadline);

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement", href: "/procurement/marketplace" }, { label: rfq.title }]}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1 as any)} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-rfq-title">{rfq.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {getStatusBadge(rfq.status)}
                {rfq.categoryName && (
                  <Badge variant="outline" data-testid="badge-category">{rfq.categoryName}</Badge>
                )}
                <Badge variant="outline" data-testid="badge-visibility">
                  <Eye className="h-3 w-3 mr-1" />
                  {rfq.visibility}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isBuyer && rfq.status === "draft" && (
              <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} data-testid="button-publish">
                <Send className="h-4 w-4 mr-1" />
                {publishMutation.isPending ? "Publishing..." : "Publish"}
              </Button>
            )}
            {isBuyer && (rfq.status === "open" || rfq.status === "evaluation") && (
              <Button variant="outline" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} data-testid="button-close">
                <XCircle className="h-4 w-4 mr-1" />
                {closeMutation.isPending ? "Closing..." : "Close RFQ"}
              </Button>
            )}
            {!isBuyer && rfq.status === "open" && supplierOrgs.length > 0 && (
              <Button onClick={openBidDialog} data-testid="button-submit-bid">
                <Send className="h-4 w-4 mr-1" />
                Submit Bid
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-md bg-muted p-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Budget Range</p>
                <p className="font-semibold" data-testid="text-budget-range">
                  {rfq.budgetMin || rfq.budgetMax
                    ? `${formatKobo(rfq.budgetMin)} - ${formatKobo(rfq.budgetMax)}`
                    : "Not specified"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className={`rounded-md p-2 ${deadlineInfo.urgent ? "bg-red-500/10" : "bg-muted"}`}>
                <Clock className={`h-5 w-5 ${deadlineInfo.urgent ? "text-red-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deadline</p>
                <p className={`font-semibold ${deadlineInfo.urgent ? "text-red-500" : ""}`} data-testid="text-deadline">
                  {deadlineInfo.text}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-md bg-muted p-2">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bids Received</p>
                <p className="font-semibold" data-testid="text-bid-count">{rfq.bidCount ?? bids.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm" data-testid="text-rfq-description">{rfq.description}</p>
          </CardContent>
        </Card>

        {rfq.items && rfq.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Line Items ({rfq.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rfq.items.map((item, index) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3" data-testid={`rfq-item-${item.id}`}>
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      {item.specifications && (
                        <p className="text-xs text-muted-foreground mt-1">{item.specifications}</p>
                      )}
                    </div>
                    <Badge variant="outline">{item.quantity} {item.unit}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(rfq.requirements || rfq.qualifications) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rfq.requirements && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Requirements</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-requirements">{rfq.requirements}</p>
                </div>
              )}
              {rfq.qualifications && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Supplier Qualifications</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-qualifications">{rfq.qualifications}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {rfq.deliveryDeadline && (
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Delivery Deadline</p>
                <p className="font-medium" data-testid="text-delivery-deadline">
                  {new Date(rfq.deliveryDeadline).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isBuyer && bids.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Incoming Bids ({bids.length})
              </CardTitle>
              <CardDescription>Review and compare bids from suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bids.map((bid) => (
                  <div
                    key={bid.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
                    data-testid={`bid-card-${bid.id}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-bid-org-${bid.id}`}>
                          {bid.orgName || `Org #${bid.supplierOrgId}`}
                        </span>
                        <Badge variant="outline" data-testid={`badge-bid-status-${bid.id}`}>{bid.status}</Badge>
                      </div>
                      <p className="text-sm font-semibold" data-testid={`text-bid-amount-${bid.id}`}>
                        {formatKobo(bid.totalAmount)}
                      </p>
                      {bid.deliveryTimeline && (
                        <p className="text-xs text-muted-foreground">Delivery: {bid.deliveryTimeline}</p>
                      )}
                      {bid.coverLetter && (
                        <p className="text-xs text-muted-foreground line-clamp-2 max-w-md">{bid.coverLetter}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(bid.status === "submitted" || bid.status === "shortlisted") && (rfq.status === "open" || rfq.status === "evaluation") && (
                        <Button
                          size="sm"
                          onClick={() => awardMutation.mutate(bid.id)}
                          disabled={awardMutation.isPending}
                          data-testid={`button-award-${bid.id}`}
                        >
                          <Award className="h-4 w-4 mr-1" />
                          Award
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Bid</DialogTitle>
              <DialogDescription>Submit your bid for "{rfq.title}"</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Submit as Organisation</Label>
                <Select value={bidSupplierOrgId} onValueChange={setBidSupplierOrgId}>
                  <SelectTrigger data-testid="select-bid-org">
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierOrgs.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {rfq.items && rfq.items.length > 0 && (
                <div className="space-y-3">
                  <Label>Item Pricing (NGN)</Label>
                  {rfq.items.map((item, idx) => (
                    <div key={item.id} className="rounded-md border p-3 space-y-2" data-testid={`bid-item-row-${item.id}`}>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} {item.unit}</p>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit Price (NGN)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={bidItems[idx]?.unitPrice || ""}
                          onChange={(e) => {
                            const updated = [...bidItems];
                            if (updated[idx]) updated[idx].unitPrice = e.target.value;
                            setBidItems(updated);
                          }}
                          data-testid={`input-bid-price-${item.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label>Cover Letter (optional)</Label>
                <Textarea
                  value={bidCoverLetter}
                  onChange={(e) => setBidCoverLetter(e.target.value)}
                  placeholder="Introduce your organisation and why you're the best fit..."
                  rows={3}
                  data-testid="input-bid-cover-letter"
                />
              </div>

              <div className="space-y-2">
                <Label>Delivery Timeline (optional)</Label>
                <Input
                  value={bidDeliveryTimeline}
                  onChange={(e) => setBidDeliveryTimeline(e.target.value)}
                  placeholder="e.g., 2 weeks after contract award"
                  data-testid="input-bid-delivery-timeline"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBidDialogOpen(false)} data-testid="button-cancel-bid">Cancel</Button>
              <Button
                onClick={() => submitBidMutation.mutate()}
                disabled={!bidSupplierOrgId || submitBidMutation.isPending}
                data-testid="button-confirm-submit-bid"
              >
                <Send className="h-4 w-4 mr-1" />
                {submitBidMutation.isPending ? "Submitting..." : "Submit Bid"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
