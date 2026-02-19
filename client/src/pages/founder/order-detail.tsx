import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { Link } from "wouter";

function formatNgn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge variant="default" data-testid="badge-status-paid"><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</Badge>;
    case "pending_payment":
      return <Badge variant="secondary" data-testid="badge-status-pending"><Clock className="h-3 w-3 mr-1" /> Pending Payment</Badge>;
    case "failed":
      return <Badge variant="destructive" data-testid="badge-status-failed"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status-other">{status}</Badge>;
  }
}

function getFulfilmentBadge(status: string | null) {
  switch (status) {
    case "completed":
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
    case "in_progress":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
    case "cancelled":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
  }
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const { data, isLoading, error } = useQuery<{
    order: {
      id: number;
      founderId: string;
      applicationId: number | null;
      status: string;
      currency: string;
      totalAmount: number;
      totalCellionCut: number | null;
      totalLawyerNet: number | null;
      fulfilmentStatus: string | null;
      assignedLawyerId: string | null;
      createdAt: string;
      updatedAt: string;
    };
    items: Array<{
      id: number;
      orderId: number;
      productId: number;
      sku: string;
      quantity: number;
      unitPrice: number;
      cellionCut: number | null;
      lawyerNet: number | null;
      metadata: Record<string, unknown> | null;
    }>;
  }>({
    queryKey: ["/api/founder/orders", orderId],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Order not found or you don't have access.</p>
            <Link href="/founder/checkout">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Checkout
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, items } = data;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/founder/checkout">
          <Button variant="ghost" size="sm" data-testid="button-back-checkout">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold" data-testid="text-order-title">Order #{order.id}</h1>
        {getStatusBadge(order.status)}
        {getFulfilmentBadge(order.fulfilmentStatus)}
      </div>

      <Card data-testid="card-order-receipt">
        <CardHeader>
          <CardTitle>Receipt</CardTitle>
          <CardDescription>
            Placed on {new Date(order.createdAt).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4" data-testid={`receipt-item-${item.sku}`}>
              <div className="min-w-0">
                <p className="font-medium">{item.sku}</p>
                <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
              </div>
              <span className="font-medium flex-shrink-0">{formatNgn(item.unitPrice)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-lg" data-testid="text-receipt-total">{formatNgn(order.totalAmount)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
