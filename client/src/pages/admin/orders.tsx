import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShoppingCart, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
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

function formatNgn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
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

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-orders-title">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage customer orders and fulfilment with split payment breakdown.</p>
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
          {orders.map((order) => (
            <Card key={order.id} data-testid={`card-order-${order.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" data-testid={`text-order-id-${order.id}`}>Order #{order.id}</span>
                      {getStatusBadge(order.status)}
                      {getFulfilmentBadge(order.fulfilmentStatus)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Founder: {order.founderId}
                      {order.applicationId && ` | Application: #${order.applicationId}`}
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
                      data-testid={`select-fulfilment-${order.id}`}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
