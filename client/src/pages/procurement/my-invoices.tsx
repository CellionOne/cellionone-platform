import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  FileText,
  Send,
  Inbox,
  Clock,
  CheckCircle,
  DollarSign,
  Eye,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import type { ProcurementInvoice } from "@shared/schema";

interface InvoiceWithRole extends ProcurementInvoice {
  userRole?: string;
}

function formatNGN(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}

function getStatusConfig(status: string) {
  switch (status) {
    case "draft":
      return { label: "Draft", icon: Clock, variant: "outline" as const };
    case "sent":
      return { label: "Sent", icon: Send, variant: "secondary" as const };
    case "viewed":
      return { label: "Viewed", icon: Eye, variant: "secondary" as const };
    case "paid":
      return { label: "Paid", icon: CheckCircle, variant: "default" as const };
    case "overdue":
      return { label: "Overdue", icon: Clock, variant: "destructive" as const };
    case "cancelled":
      return { label: "Cancelled", icon: Clock, variant: "outline" as const };
    default:
      return { label: status, icon: FileText, variant: "outline" as const };
  }
}

export default function MyInvoicesPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: invoices, isLoading } = useQuery<InvoiceWithRole[]>({
    queryKey: ["/api/procurement/invoices"],
  });

  const filtered = invoices?.filter(inv => {
    if (tab === "sent" && inv.userRole !== "supplier") return false;
    if (tab === "received" && inv.userRole !== "buyer") return false;
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    return true;
  }) || [];

  const totalInvoiced = invoices?.reduce((sum, i) => sum + (i.totalAmount || 0), 0) || 0;
  const totalPaid = invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.totalAmount || 0), 0) || 0;
  const totalOutstanding = invoices?.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft")
    .reduce((sum, i) => sum + (i.totalAmount || 0), 0) || 0;

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "Invoices" }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Invoices</h1>
            <p className="text-muted-foreground text-sm">Manage your procurement invoices</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card data-testid="card-stat-invoiced">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-invoiced">{formatNGN(totalInvoiced)}</p>
                  <p className="text-xs text-muted-foreground">Total Invoiced</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-paid">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-paid">{formatNGN(totalPaid)}</p>
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-outstanding">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-outstanding">{formatNGN(totalOutstanding)}</p>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={tab} onValueChange={setTab} className="flex-1">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="sent" data-testid="tab-sent">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Sent
              </TabsTrigger>
              <TabsTrigger value="received" data-testid="tab-received">
                <Inbox className="h-3 w-3 mr-1" />
                Received
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description={statusFilter !== "all" ? "Try changing your filters." : "Invoices from your contracts will appear here."}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(invoice => {
              const config = getStatusConfig(invoice.status);
              const StatusIcon = config.icon;
              return (
                <Card key={invoice.id} className="hover-elevate" data-testid={`card-invoice-${invoice.id}`}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold" data-testid={`text-invoice-number-${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </h3>
                        <Badge variant={config.variant} data-testid={`badge-status-${invoice.id}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-role-${invoice.id}`}>
                          {invoice.userRole === "supplier" ? "Sent" : "Received"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span data-testid={`text-invoice-amount-${invoice.id}`}>{formatNGN(invoice.totalAmount)}</span>
                        {invoice.paymentTerms && (
                          <>
                            <span>|</span>
                            <span>{invoice.paymentTerms}</span>
                          </>
                        )}
                        <span>|</span>
                        <span data-testid={`text-invoice-date-${invoice.id}`}>
                          {new Date(invoice.createdAt!).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <Link href={`/procurement/invoices/${invoice.id}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-${invoice.id}`}>
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>
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
