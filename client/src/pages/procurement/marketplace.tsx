import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  Search,
  ShoppingBag,
  Clock,
  Users,
  ArrowRight,
  Tag,
} from "lucide-react";
import type { Rfq, RfqCategory } from "@shared/schema";

interface MarketplaceRfq extends Rfq {
  categoryName?: string;
  bidCount?: number;
}

function formatKobo(amount: number | null | undefined): string {
  if (amount == null) return "N/A";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function getTimeRemaining(deadline: string | Date): string {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export default function MarketplacePage() {
  usePageMeta({
    title: "RFQ Marketplace | Cellion One",
    description: "Browse open Requests for Quotation and submit competitive bids for procurement opportunities.",
    canonicalPath: "/procurement/marketplace",
  });

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");

  const { data: categories = [] } = useQuery<RfqCategory[]>({
    queryKey: ["/api/procurement/categories"],
  });

  const marketplaceUrl = (() => {
    const params = new URLSearchParams();
    if (categoryId !== "all") params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/api/procurement/marketplace${qs ? `?${qs}` : ""}`;
  })();

  const { data: rfqs, isLoading } = useQuery<MarketplaceRfq[]>({
    queryKey: ["/api/procurement/marketplace", categoryId, search],
    queryFn: async () => {
      const res = await fetch(marketplaceUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load marketplace");
      return res.json();
    },
  });

  const filteredRfqs = rfqs?.filter((rfq) => {
    if (search && !rfq.title.toLowerCase().includes(search.toLowerCase()) && !rfq.description.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "Marketplace" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-marketplace-title">RFQ Marketplace</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse open requests for quotation and submit your bids</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search RFQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-rfqs"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[200px]" data-testid="select-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : !filteredRfqs || filteredRfqs.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No open RFQs found"
            description="There are no open requests for quotation matching your criteria. Check back later or adjust your filters."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRfqs.map((rfq) => (
              <Card key={rfq.id} className="hover-elevate" data-testid={`card-rfq-${rfq.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2" data-testid={`text-rfq-title-${rfq.id}`}>
                      {rfq.title}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0" data-testid={`badge-visibility-${rfq.id}`}>
                      {rfq.visibility}
                    </Badge>
                  </div>
                  {rfq.categoryName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span data-testid={`text-category-${rfq.id}`}>{rfq.categoryName}</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-description-${rfq.id}`}>
                    {rfq.description}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-medium" data-testid={`text-budget-${rfq.id}`}>
                        {rfq.budgetMin || rfq.budgetMax
                          ? `${formatKobo(rfq.budgetMin)} - ${formatKobo(rfq.budgetMax)}`
                          : "Not specified"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Deadline</span>
                      </div>
                      <span className="font-medium" data-testid={`text-deadline-${rfq.id}`}>
                        {getTimeRemaining(rfq.deadline)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>Bids</span>
                      </div>
                      <span className="font-medium" data-testid={`text-bid-count-${rfq.id}`}>
                        {rfq.bidCount ?? 0}
                      </span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="w-full" asChild data-testid={`button-view-rfq-${rfq.id}`}>
                    <Link href={`/procurement/rfqs/${rfq.id}`}>
                      View Details
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
