import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { PayoutLedger } from "@shared/schema";

interface PayoutData {
  payouts: PayoutLedger[];
  stats: {
    totalEarned: number;
    pending: number;
    sent: number;
  };
}

export default function LawyerPayouts() {
  const { data, isLoading } = useQuery<PayoutData>({
    queryKey: ["/api/lawyer/payouts"],
  });

  const formatAmount = (kobo: number) => {
    return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout 
      role="lawyer" 
      breadcrumbs={[{ label: "Dashboard", href: "/lawyer/dashboard" }, { label: "Payouts" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Payout Ledger</h1>
          <p className="text-muted-foreground">
            Track your earnings and payout history
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Earned
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatAmount(data?.stats?.totalEarned || 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatAmount(data?.stats?.pending || 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Paid Out
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatAmount(data?.stats?.sent || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payout History</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.payouts?.length ? (
                  <EmptyState
                    icon={Wallet}
                    title="No payouts yet"
                    description="Your earnings will appear here once you complete cases."
                    className="py-8"
                  />
                ) : (
                  <div className="divide-y">
                    {data.payouts.map((payout) => (
                      <div 
                        key={payout.id} 
                        className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                        data-testid={`payout-${payout.id}`}
                      >
                        <div>
                          <p className="font-medium">Payment #{payout.paymentId}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payout.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold">
                            {formatAmount(payout.amountKobo)}
                          </span>
                          <StatusBadge status={payout.status || "pending"} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
