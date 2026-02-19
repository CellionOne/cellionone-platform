import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Clock, XCircle, ArrowRight, ShoppingCart } from "lucide-react";

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
      return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Fulfilled</Badge>;
    case "in_progress":
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
    case "cancelled":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
    default:
      return null;
  }
}

interface Order {
  id: number;
  status: string;
  currency: string;
  totalAmount: number;
  fulfilmentStatus: string | null;
  createdAt: string;
}

export default function FounderOrdersPage() {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/founder/orders"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-orders-title">My Orders</h1>
        <p className="text-muted-foreground mt-1">View and track all your orders and service requests</p>
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <div>
              <h3 className="font-medium">No orders yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your orders will appear here after you purchase services.
              </p>
            </div>
            <Link href="/founder/checkout">
              <Button data-testid="button-go-checkout">Browse Services</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((order) => (
            <Link key={order.id} href={`/founder/orders/${order.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`card-order-${order.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div>
                        <p className="font-medium" data-testid={`text-order-id-${order.id}`}>
                          Order #{order.id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("en-NG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(order.status)}
                      {getFulfilmentBadge(order.fulfilmentStatus)}
                      <span className="font-semibold" data-testid={`text-order-total-${order.id}`}>
                        {formatNgn(order.totalAmount)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
