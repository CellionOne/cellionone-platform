import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  FileText,
  Send,
  Save,
  BookTemplate,
  ArrowLeft,
  Calculator,
} from "lucide-react";
import type { RfqItem, BidTemplate } from "@shared/schema";

interface RfqWithItems {
  id: number;
  title: string;
  description: string;
  buyerOrgId: number;
  currency: string;
  deadline: string;
  status: string;
  items?: RfqItem[];
}

interface BidItemInput {
  rfqItemId: number;
  unitPrice: number;
  quantity: number;
  notes: string;
}

function formatNGN(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}

export default function SubmitBidPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [supplierOrgId, setSupplierOrgId] = useState<string>("");
  const [coverLetter, setCoverLetter] = useState("");
  const [terms, setTerms] = useState("");
  const [deliveryTimeline, setDeliveryTimeline] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [bidItems, setBidItems] = useState<BidItemInput[]>([]);

  const { data: rfq, isLoading: rfqLoading } = useQuery<RfqWithItems>({
    queryKey: ["/api/procurement/rfqs", rfqId],
    enabled: !!rfqId,
  });

  const { data: orgs } = useQuery<any[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const { data: templates } = useQuery<BidTemplate[]>({
    queryKey: ["/api/procurement/bid-templates", `orgId=${supplierOrgId}`],
    enabled: !!supplierOrgId,
    queryFn: async () => {
      const res = await fetch(`/api/procurement/bid-templates?orgId=${supplierOrgId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (rfq?.items && rfq.items.length > 0 && bidItems.length === 0) {
      setBidItems(rfq.items.map(item => ({
        rfqItemId: item.id,
        unitPrice: 0,
        quantity: item.quantity,
        notes: "",
      })));
    }
  }, [rfq]);

  const totalAmount = bidItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const createBidMutation = useMutation({
    mutationFn: async (submitAfter: boolean) => {
      const res = await apiRequest("POST", `/api/procurement/rfqs/${rfqId}/bids`, {
        supplierOrgId: parseInt(supplierOrgId),
        coverLetter,
        terms,
        deliveryTimeline,
        validUntil: validUntil || undefined,
        totalAmount,
        items: bidItems.map(item => ({
          rfqItemId: item.rfqItemId,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
      });
      const bid = await res.json();
      if (submitAfter) {
        await apiRequest("POST", `/api/procurement/bids/${bid.id}/submit`);
      }
      return bid;
    },
    onSuccess: (_, submitAfter) => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/my-bids"] });
      toast({
        title: submitAfter ? "Bid submitted" : "Bid saved as draft",
        description: submitAfter ? "Your bid has been submitted successfully." : "Your bid has been saved. You can submit it later.",
      });
      navigate("/procurement/my-bids");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create bid", description: error.message, variant: "destructive" });
    },
  });

  function loadTemplate(templateId: string) {
    const template = templates?.find(t => t.id === parseInt(templateId));
    if (template) {
      if (template.coverLetterTemplate) setCoverLetter(template.coverLetterTemplate);
      if (template.termsTemplate) setTerms(template.termsTemplate);
      toast({ title: "Template loaded", description: `Loaded "${template.name}"` });
    }
  }

  function updateBidItem(index: number, field: keyof BidItemInput, value: any) {
    setBidItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  if (rfqLoading) {
    return (
      <DashboardLayout role="founder">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!rfq) {
    return (
      <DashboardLayout role="founder">
        <div className="text-center py-20">
          <p className="text-muted-foreground">RFQ not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/procurement/marketplace")} data-testid="button-back-marketplace">
            Back to Marketplace
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const supplierOrgs = orgs?.filter(o => o.id !== rfq.buyerOrgId) || [];

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement", href: "/procurement/marketplace" }, { label: "Submit Bid" }]}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1 as any)} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Submit Bid</h1>
              <p className="text-muted-foreground text-sm">For: {rfq.title}</p>
            </div>
          </div>
          <Badge variant="outline" data-testid="badge-rfq-status">{rfq.status}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bid Details
            </CardTitle>
            <CardDescription>Fill in your bid details for this RFQ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Supplier Organisation</Label>
                <Select value={supplierOrgId} onValueChange={setSupplierOrgId}>
                  <SelectTrigger data-testid="select-supplier-org">
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierOrgs.map((org: any) => (
                      <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delivery Timeline</Label>
                <Input
                  value={deliveryTimeline}
                  onChange={(e) => setDeliveryTimeline(e.target.value)}
                  placeholder="e.g., 2 weeks, 30 days"
                  data-testid="input-delivery-timeline"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valid Until (optional)</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  data-testid="input-valid-until"
                />
              </div>
              {templates && templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Load from Template</Label>
                  <Select onValueChange={loadTemplate}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          <div className="flex items-center gap-2">
                            <BookTemplate className="h-3 w-3" />
                            {t.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Cover Letter</Label>
              <Textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Introduce your company and explain why you're the best fit..."
                className="min-h-[120px]"
                data-testid="input-cover-letter"
              />
            </div>

            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Specify payment terms, warranties, etc."
                className="min-h-[80px]"
                data-testid="input-terms"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Line Items Pricing
            </CardTitle>
            <CardDescription>Enter your unit price for each item</CardDescription>
          </CardHeader>
          <CardContent>
            {(!rfq.items || rfq.items.length === 0) ? (
              <p className="text-muted-foreground text-sm">No line items defined for this RFQ.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-4">Item</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-3">Unit Price (kobo)</div>
                  <div className="col-span-3 text-right">Subtotal</div>
                </div>
                <Separator />
                {rfq.items.map((rfqItem, index) => {
                  const bidItem = bidItems[index];
                  const subtotal = bidItem ? bidItem.unitPrice * bidItem.quantity : 0;
                  return (
                    <div key={rfqItem.id} className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <p className="text-sm font-medium" data-testid={`text-item-desc-${rfqItem.id}`}>{rfqItem.description}</p>
                          {rfqItem.specifications && (
                            <p className="text-xs text-muted-foreground">{rfqItem.specifications}</p>
                          )}
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min={1}
                            value={bidItem?.quantity || rfqItem.quantity}
                            onChange={(e) => updateBidItem(index, "quantity", parseInt(e.target.value) || 1)}
                            data-testid={`input-qty-${rfqItem.id}`}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            min={0}
                            value={bidItem?.unitPrice || ""}
                            onChange={(e) => updateBidItem(index, "unitPrice", parseInt(e.target.value) || 0)}
                            placeholder="0"
                            data-testid={`input-unit-price-${rfqItem.id}`}
                          />
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-sm font-medium" data-testid={`text-subtotal-${rfqItem.id}`}>
                            {formatNGN(subtotal)}
                          </span>
                        </div>
                      </div>
                      <Input
                        placeholder="Notes for this item (optional)"
                        value={bidItem?.notes || ""}
                        onChange={(e) => updateBidItem(index, "notes", e.target.value)}
                        className="text-sm"
                        data-testid={`input-notes-${rfqItem.id}`}
                      />
                      {index < rfq.items!.length - 1 && <Separator />}
                    </div>
                  );
                })}
                <Separator />
                <div className="flex items-center justify-end gap-4 pt-2">
                  <span className="text-sm font-medium text-muted-foreground">Total:</span>
                  <span className="text-lg font-bold" data-testid="text-total-amount">{formatNGN(totalAmount)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => createBidMutation.mutate(false)}
            disabled={!supplierOrgId || createBidMutation.isPending}
            data-testid="button-save-draft"
          >
            <Save className="h-4 w-4 mr-2" />
            {createBidMutation.isPending ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            onClick={() => createBidMutation.mutate(true)}
            disabled={!supplierOrgId || createBidMutation.isPending}
            data-testid="button-submit-bid"
          >
            <Send className="h-4 w-4 mr-2" />
            {createBidMutation.isPending ? "Submitting..." : "Submit Bid"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
