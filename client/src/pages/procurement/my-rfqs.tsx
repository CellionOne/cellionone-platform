import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  Plus,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle,
  Send,
  XCircle,
  BarChart3,
} from "lucide-react";
import type { Rfq } from "@shared/schema";

interface RfqWithMeta extends Rfq {
  bidCount?: number;
  categoryName?: string;
}

function formatKobo(amount: number | null | undefined): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function getStatusBadge(status: string) {
  const config: Record<string, { className: string; icon: typeof Clock }> = {
    draft: { className: "bg-muted text-muted-foreground", icon: FileText },
    open: { className: "bg-green-500/10 text-green-600 border-green-200", icon: Send },
    evaluation: { className: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Clock },
    awarded: { className: "bg-blue-500/10 text-blue-600 border-blue-200", icon: CheckCircle },
    closed: { className: "bg-muted text-muted-foreground", icon: XCircle },
    cancelled: { className: "bg-red-500/10 text-red-600 border-red-200", icon: XCircle },
  };
  const c = config[status] || config.draft;
  const Icon = c.icon;
  return (
    <Badge className={c.className}>
      <Icon className="h-3 w-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function MyRfqsPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: rfqs, isLoading } = useQuery<RfqWithMeta[]>({
    queryKey: ["/api/procurement/rfqs"],
  });

  const filteredRfqs = rfqs?.filter((rfq) => {
    if (statusFilter !== "all" && rfq.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: rfqs?.length ?? 0,
    draft: rfqs?.filter(r => r.status === "draft").length ?? 0,
    open: rfqs?.filter(r => r.status === "open").length ?? 0,
    awarded: rfqs?.filter(r => r.status === "awarded").length ?? 0,
  };

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "My RFQs" }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-my-rfqs-title">My RFQs</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your requests for quotation</p>
          </div>
          <Button asChild data-testid="button-create-rfq">
            <Link href="/procurement/rfqs/new">
              <Plus className="h-4 w-4 mr-2" />
              Create RFQ
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="stat-total">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-md bg-muted p-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total RFQs</p>
                <p className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-draft">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-md bg-muted p-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold" data-testid="text-stat-draft">{stats.draft}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-open">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-md bg-green-500/10 p-2">
                <Send className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold" data-testid="text-stat-open">{stats.open}</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-awarded">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-md bg-blue-500/10 p-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Awarded</p>
                <p className="text-2xl font-bold" data-testid="text-stat-awarded">{stats.awarded}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="evaluation">Evaluation</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : !filteredRfqs || filteredRfqs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No RFQs found"
            description={statusFilter !== "all" ? "No RFQs match the selected filter." : "Create your first Request for Quotation to get started."}
            action={
              statusFilter === "all" ? (
                <Button asChild data-testid="button-empty-create-rfq">
                  <Link href="/procurement/rfqs/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create RFQ
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredRfqs.map((rfq) => (
              <Card key={rfq.id} className="hover-elevate" data-testid={`card-rfq-${rfq.id}`}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold truncate" data-testid={`text-rfq-title-${rfq.id}`}>{rfq.title}</h3>
                      {getStatusBadge(rfq.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {rfq.categoryName && <span data-testid={`text-rfq-category-${rfq.id}`}>{rfq.categoryName}</span>}
                      <span data-testid={`text-rfq-budget-${rfq.id}`}>
                        {rfq.budgetMin || rfq.budgetMax
                          ? `${formatKobo(rfq.budgetMin)} - ${formatKobo(rfq.budgetMax)}`
                          : "No budget set"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span data-testid={`text-rfq-deadline-${rfq.id}`}>
                          {new Date(rfq.deadline).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {rfq.bidCount !== undefined && (
                        <span data-testid={`text-rfq-bids-${rfq.id}`}>{rfq.bidCount} bids</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild data-testid={`button-view-rfq-${rfq.id}`}>
                    <Link href={`/procurement/rfqs/${rfq.id}`}>
                      View
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
