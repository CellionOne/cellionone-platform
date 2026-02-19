import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ShoppingCart, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Order {
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
}

interface ServiceRequest {
  id: number;
  founderId: string;
  orderId: number | null;
  serviceType: string;
  status: string;
  assignedLawyerId: string | null;
  companyProfileId: number | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

function formatNgn(kobo: number): string {
  return `\u20A6${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</Badge>;
    case "pending_payment":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case "failed":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
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

function getSrStatusBadge(status: string) {
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
  };
  return labels[serviceType] || serviceType;
}

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
  });

  const { data: allServiceRequests } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/admin/service-requests"],
  });

  const updateFulfilmentMutation = useMutation({
    mutationFn: async ({ orderId, fulfilmentStatus }: { orderId: number; fulfilmentStatus: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/orders/${orderId}/fulfilment`, { fulfilmentStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Order updated", description: "Fulfilment status has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const assignLawyerMutation = useMutation({
    mutationFn: async ({ srId, lawyerId }: { srId: number; lawyerId: string }) => {
      const res = await apiRequest("PUT", `/api/admin/service-requests/${srId}/assign`, { lawyerId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-requests"] });
      toast({ title: "Lawyer assigned", description: "Service request has been assigned." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="admin-orders-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paidOrders = orders?.filter(o => o.status === "paid") || [];
  const pendingOrders = orders?.filter(o => o.status === "pending_payment") || [];
  const failedOrders = orders?.filter(o => o.status === "failed") || [];

  const getServiceRequestsForOrder = (orderId: number) =>
    allServiceRequests?.filter(sr => sr.orderId === orderId) || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-orders-title">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage customer orders, fulfilment, and service requests.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-paid-count">{paidOrders.length}</p>
            <p className="text-sm text-muted-foreground">Paid Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingOrders.length}</p>
            <p className="text-sm text-muted-foreground">Pending Payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-failed-count">{failedOrders.length}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {(!orders || orders.length === 0) ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-orders">No orders found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const srList = getServiceRequestsForOrder(order.id);
            const isExpanded = expandedOrderId === order.id;

            return (
              <Card key={order.id} data-testid={`card-order-${order.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" data-testid={`text-order-id-${order.id}`}>Order #{order.id}</span>
                        {getStatusBadge(order.status)}
                        {getFulfilmentBadge(order.fulfilmentStatus)}
                        {srList.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" /> {srList.length} request{srList.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Founder: {order.founderId}
                        {order.applicationId && ` | App: #${order.applicationId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("en-NG")}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="font-bold text-lg" data-testid={`text-order-total-${order.id}`}>{formatNgn(order.totalAmount)}</p>
                      {order.totalCellionCut !== null && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>Platform: {formatNgn(order.totalCellionCut)}</p>
                          <p>Lawyer: {formatNgn(order.totalLawyerNet || 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {order.status === "paid" && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Fulfilment:</span>
                      <Select
                        value={order.fulfilmentStatus || "pending"}
                        onValueChange={(value) => updateFulfilmentMutation.mutate({ orderId: order.id, fulfilmentStatus: value })}
                      >
                        <SelectTrigger className="w-[160px]" data-testid={`trigger-fulfilment-${order.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {srList.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        data-testid={`button-toggle-sr-${order.id}`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                        {isExpanded ? "Hide" : "Show"} Service Requests ({srList.length})
                      </Button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {srList.map((sr) => (
                            <div
                              key={sr.id}
                              className="p-3 rounded-lg border border-border space-y-2"
                              data-testid={`admin-sr-${sr.id}`}
                            >
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{getServiceLabel(sr.serviceType)}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {sr.companyProfileId ? "Docs submitted" : "Awaiting docs"}
                                    {sr.assignedLawyerId && ` | Lawyer: ${sr.assignedLawyerId}`}
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {getSrStatusBadge(sr.status)}
                                </div>
                              </div>

                              {!sr.assignedLawyerId && sr.status === "queued" && (
                                <AssignLawyerInput
                                  srId={sr.id}
                                  onAssign={(lawyerId) => assignLawyerMutation.mutate({ srId: sr.id, lawyerId })}
                                  isPending={assignLawyerMutation.isPending}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignLawyerInput({
  srId,
  onAssign,
  isPending,
}: {
  srId: number;
  onAssign: (lawyerId: string) => void;
  isPending: boolean;
}) {
  const [lawyerId, setLawyerId] = useState("");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        placeholder="Lawyer user ID"
        value={lawyerId}
        onChange={(e) => setLawyerId(e.target.value)}
        className="w-[200px]"
        data-testid={`input-assign-lawyer-${srId}`}
      />
      <Button
        size="sm"
        onClick={() => { if (lawyerId.trim()) onAssign(lawyerId.trim()); }}
        disabled={isPending || !lawyerId.trim()}
        data-testid={`button-assign-lawyer-${srId}`}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
        Assign
      </Button>
    </div>
  );
}
