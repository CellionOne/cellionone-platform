import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Printer,
  Send,
  CheckCircle,
  Clock,
  FileText,
  Building2,
  CreditCard,
  Eye,
} from "lucide-react";
import type { ProcurementInvoice, ProcurementInvoiceItem } from "@shared/schema";

interface InvoiceDetail extends ProcurementInvoice {
  items?: ProcurementInvoiceItem[];
  userRole?: string;
}

function formatNGN(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}

function getStatusConfig(status: string) {
  switch (status) {
    case "draft":
      return { label: "Draft", icon: Clock, variant: "outline" as const, color: "text-muted-foreground" };
    case "sent":
      return { label: "Sent", icon: Send, variant: "secondary" as const, color: "text-blue-600" };
    case "viewed":
      return { label: "Viewed", icon: Eye, variant: "secondary" as const, color: "text-amber-600" };
    case "paid":
      return { label: "Paid", icon: CheckCircle, variant: "default" as const, color: "text-green-600" };
    default:
      return { label: status, icon: FileText, variant: "outline" as const, color: "text-muted-foreground" };
  }
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ["/api/procurement/invoices", id],
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/procurement/invoices/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/invoices"] });
      toast({ title: "Invoice sent", description: "The buyer has been notified." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invoice", description: error.message, variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/procurement/invoices/${id}/mark-paid`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/invoices"] });
      toast({ title: "Invoice marked as paid" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to mark as paid", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout role="founder">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout role="founder">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Invoice not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/procurement/invoices")} data-testid="button-back-invoices">
            Back to Invoices
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const config = getStatusConfig(invoice.status);
  const StatusIcon = config.icon;

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "Invoices", href: "/procurement/invoices" }, { label: invoice.invoiceNumber }]}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/procurement/invoices")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-invoice-number">{invoice.invoiceNumber}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant={config.variant} data-testid="badge-status">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "draft" && (
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                data-testid="button-send"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendMutation.isPending ? "Sending..." : "Send Invoice"}
              </Button>
            )}
            {(invoice.status === "sent" || invoice.status === "viewed") && (
              <Button
                onClick={() => markPaidMutation.mutate()}
                disabled={markPaidMutation.isPending}
                data-testid="button-mark-paid"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {markPaidMutation.isPending ? "Processing..." : "Mark as Paid"}
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()} data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8">
            <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-primary" data-testid="text-invoice-heading">INVOICE</h2>
                <p className="text-muted-foreground mt-1" data-testid="text-invoice-num-display">{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Date: </span>
                  <span className="font-medium" data-testid="text-invoice-date">
                    {new Date(invoice.createdAt!).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </p>
                {invoice.dueDate && (
                  <p>
                    <span className="text-muted-foreground">Due: </span>
                    <span className="font-medium" data-testid="text-due-date">
                      {new Date(invoice.dueDate).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </p>
                )}
                {invoice.paymentTerms && (
                  <p>
                    <span className="text-muted-foreground">Terms: </span>
                    <span className="font-medium" data-testid="text-payment-terms">{invoice.paymentTerms}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 mb-8">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">From (Supplier)</h3>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-supplier-org">Org #{invoice.supplierOrgId}</span>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">To (Buyer)</h3>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-buyer-org">Org #{invoice.buyerOrgId}</span>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase py-3">Description</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase py-3">Qty</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase py-3">Unit Price</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase py-3">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => (
                    <tr key={item.id || index} className="border-b" data-testid={`row-item-${index}`}>
                      <td className="py-3 text-sm">
                        <span data-testid={`text-item-desc-${index}`}>{item.description}</span>
                        {item.unit && <span className="text-muted-foreground ml-1">({item.unit})</span>}
                      </td>
                      <td className="py-3 text-sm text-right" data-testid={`text-item-qty-${index}`}>{item.quantity}</td>
                      <td className="py-3 text-sm text-right" data-testid={`text-item-price-${index}`}>{formatNGN(item.unitPrice)}</td>
                      <td className="py-3 text-sm text-right font-medium" data-testid={`text-item-subtotal-${index}`}>{formatNGN(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-8">
              <div className="w-64 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span data-testid="text-subtotal">{formatNGN(invoice.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{invoice.taxLabel || "VAT"}</span>
                  <span data-testid="text-tax">{formatNGN(invoice.taxAmount)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold text-lg">
                  <span>Total</span>
                  <span data-testid="text-total">{formatNGN(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>

            {invoice.bankDetails && (
              <div className="bg-muted rounded-md p-4 mb-6">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Details
                </h3>
                <p className="text-sm whitespace-pre-line" data-testid="text-bank-details">{invoice.bankDetails}</p>
              </div>
            )}

            {invoice.notes && (
              <div className="text-sm">
                <span className="font-medium">Notes: </span>
                <span className="text-muted-foreground" data-testid="text-notes">{invoice.notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-0 { border: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
