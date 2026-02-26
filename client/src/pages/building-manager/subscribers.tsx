import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  Users,
  Search,
  Building2,
  Calendar,
  User,
} from "lucide-react";

interface Subscriber {
  id: number;
  founderId: string;
  founderName: string;
  founderEmail: string;
  companyName: string | null;
  tier: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export default function BuildingManagerSubscribers() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: subscribers, isLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/building-manager/subscribers"],
  });

  if (isLoading) {
    return (
      <DashboardLayout
        role="building_manager"
        breadcrumbs={[
          { label: "Dashboard", href: "/building-manager/dashboard" },
          { label: "Subscribers" },
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case "office_only":
        return "Office Only";
      case "office_plus_mail":
        return "Office + Mail";
      default:
        return tier;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-primary">Active</Badge>;
      case "pending_payment":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filtered = (subscribers || []).filter((sub) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      sub.founderName?.toLowerCase().includes(q) ||
      sub.founderEmail?.toLowerCase().includes(q) ||
      sub.companyName?.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout
      role="building_manager"
      breadcrumbs={[
        { label: "Dashboard", href: "/building-manager/dashboard" },
        { label: "Subscribers" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Users className="h-6 w-6 text-primary" />
              Subscribers
            </h1>
            <p className="text-muted-foreground mt-1">
              Active subscribers at your location
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subscribers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-search-subscribers"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Subscribers Found"
            description={searchQuery ? "No subscribers match your search criteria." : "There are no active subscribers at this location yet."}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-4 p-4"
                    data-testid={`subscriber-row-${sub.id}`}
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="rounded-full bg-muted p-2 shrink-0">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium" data-testid={`text-founder-name-${sub.id}`}>
                            {sub.founderName}
                          </p>
                          {getStatusBadge(sub.status)}
                        </div>
                        {sub.companyName && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1" data-testid={`text-company-name-${sub.id}`}>
                            <Building2 className="h-3 w-3" />
                            {sub.companyName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground" data-testid={`text-subscriber-email-${sub.id}`}>
                          {sub.founderEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <Badge variant="secondary" data-testid={`badge-tier-${sub.id}`}>
                        {getTierLabel(sub.tier)}
                      </Badge>
                      {sub.startDate && (
                        <div className="text-xs text-muted-foreground text-right">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span data-testid={`text-start-date-${sub.id}`}>
                              {new Date(sub.startDate).toLocaleDateString()}
                            </span>
                          </div>
                          {sub.endDate && (
                            <span data-testid={`text-end-date-${sub.id}`}>
                              to {new Date(sub.endDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
