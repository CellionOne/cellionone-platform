import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CheckCircle2, Clock, AlertCircle, XCircle, ClipboardList, ArrowRight, FileText } from "lucide-react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";

function formatNgn(kobo: number): string {
  return `\u20A6${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
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

function getServiceRequestStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
    case "in_progress":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
    case "assigned":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Assigned</Badge>;
    case "cancelled":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
    case "queued":
    default:
      return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Queued</Badge>;
  }
}

function getServiceLabel(serviceType: string): string {
  const labels: Record<string, string> = {
    SCUML: "SCUML Registration",
    TM: "Trademark Registration",
    TIN: "TIN Registration",
    ADD_DIR: "Add Director (CAC Filing)",
  };
  return labels[serviceType] || serviceType;
}

interface ServiceRequest {
  id: number;
  serviceType: string;
  status: string;
  companyProfileId: number | null;
  assignedLawyerId: string | null;
  createdAt: string;
  completedAt: string | null;
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
      adminFeeAmount: number | null;
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

  const { data: serviceRequests } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/founder/orders", orderId, "service-requests"],
    enabled: !!data && data.order.status === "paid",
  });

  const breadcrumbs = [
    { label: "My Orders", href: "/founder/orders" },
    { label: data ? `Order #${data.order.id}` : "Order Detail" },
  ];

  if (isLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout role="founder" breadcrumbs={breadcrumbs}>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Order not found or you don&apos;t have access.</p>
            <Link href="/founder/orders">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Orders
              </Button>
            </Link>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const { order, items } = data;

  const pendingServiceRequests = serviceRequests?.filter(sr =>
    ["queued", "assigned"].includes(sr.status) && !sr.companyProfileId
  ) || [];

  const pendingAddDirector = pendingServiceRequests.filter(sr => sr.serviceType === "ADD_DIR");
  const pendingStandardRequests = pendingServiceRequests.filter(sr => sr.serviceType !== "ADD_DIR");

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "My Orders", href: "/founder/orders" },
        { label: `Order #${order.id}` },
      ]}
    >
      <div className="max-w-3xl space-y-6" data-testid="order-detail-page">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/founder/orders">
            <Button variant="ghost" size="sm" data-testid="button-back-orders">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold" data-testid="text-order-title">Order #{order.id}</h1>
          {getStatusBadge(order.status)}
        </div>

        {pendingStandardRequests.length > 0 && (
          <Card className="border-primary/30" data-testid="card-service-request-cta">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="font-medium">Action Required: Complete Your Service Request</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Provide your company details and upload supporting documents so a lawyer can process your request.
              </p>
              <Link href={`/founder/service-request?orderId=${order.id}`}>
                <Button size="sm" data-testid="button-complete-service-request">
                  Fill Service Request Form <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {pendingAddDirector.map((sr) => (
          <Card key={sr.id} className="border-primary/30" data-testid={`card-add-director-cta-${sr.id}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="font-medium">Action Required: Add Director Details</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Provide company information and the new director&apos;s personal details so our lawyers can file with the CAC.
              </p>
              <Link href={`/founder/add-director?srId=${sr.id}&orderId=${order.id}`}>
                <Button size="sm" data-testid={`button-add-director-form-${sr.id}`}>
                  Fill Add Director Form <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

        {serviceRequests && serviceRequests.length > 0 && (
          <Card data-testid="card-service-requests">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Service Requests
              </CardTitle>
              <CardDescription>Track the progress of your service requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {serviceRequests.map((sr) => (
                <div
                  key={sr.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border"
                  data-testid={`service-request-${sr.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{getServiceLabel(sr.serviceType)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sr.companyProfileId ? "Company details submitted" : "Awaiting company details"}
                      {sr.completedAt && ` · Completed ${new Date(sr.completedAt).toLocaleDateString("en-NG")}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {getServiceRequestStatusBadge(sr.status)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-order-receipt">
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
            <CardDescription>
              Placed on {new Date(order.createdAt).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => {
              const qty = item.quantity || 1;
              const lineTotal = item.unitPrice * qty;
              const isIncorp = item.sku.startsWith("CAC_") || item.sku === "NGO";
              return (
                <div key={item.id} className="flex items-center justify-between gap-4" data-testid={`receipt-item-${item.sku}`}>
                  <div className="min-w-0">
                    <p className="font-medium">{item.sku}</p>
                    {qty > 1 && isIncorp ? (
                      <p className="text-sm text-muted-foreground">{formatNgn(item.unitPrice)} × {qty} names</p>
                    ) : qty > 1 ? (
                      <p className="text-sm text-muted-foreground">Qty: {qty}</p>
                    ) : null}
                  </div>
                  <span className="font-medium flex-shrink-0" data-testid={`receipt-line-total-${item.sku}`}>{formatNgn(lineTotal)}</span>
                </div>
              );
            })}
            <Separator />
            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span data-testid="text-receipt-subtotal">{formatNgn(order.totalAmount)}</span>
            </div>
            {(order.adminFeeAmount ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>Administration Fee (10%)</span>
                <span data-testid="text-receipt-admin-fee">{formatNgn(order.adminFeeAmount!)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg" data-testid="text-receipt-total">{formatNgn(order.totalAmount + (order.adminFeeAmount ?? 0))}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
