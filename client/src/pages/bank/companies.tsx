import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, LogOut, Loader2, ChevronRight, CalendarDays, UserCircle } from "lucide-react";
import { format } from "date-fns";

type BankSession = {
  email: string;
  bankPartnerId: number;
  bankName?: string;
};

type Company = {
  id: number;
  companyName: string;
  companyType?: string;
  rcNumber?: string;
  existingCompanyStatus?: string;
  dispatchedAt?: string;
};

function statusBadge(status?: string) {
  if (!status) return <Badge variant="secondary">—</Badge>;
  const map: Record<string, string> = {
    verified: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  const cls = map[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status.replace(/_/g, " ").toUpperCase()}</span>;
}

export default function BankCompaniesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: session, isLoading: sessionLoading } = useQuery<BankSession>({
    queryKey: ["/api/bank-portal/me"],
    retry: false,
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/bank-portal/companies", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const url = `/api/bank-portal/companies${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!session,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bank-portal/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/bank/login");
    },
    onError: () => {
      queryClient.clear();
      setLocation("/bank/login");
    },
  });

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    setLocation("/bank/login");
    return null;
  }

  const filtered = companies.filter(c =>
    !search || c.companyName?.toLowerCase().includes(search.toLowerCase()) || c.rcNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-none">Cellion One — Bank Portal</p>
              <p className="text-xs text-muted-foreground mt-0.5">{session.bankName || `Partner #${session.bankPartnerId}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{session.email}</span>
            <Button variant="ghost" size="sm" asChild data-testid="button-bank-account">
              <Link href="/bank/account">
                <UserCircle className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Account</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-bank-logout"
            >
              {logoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Company Dossiers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verified company profiles dispatched to {session.bankName || "your bank"}.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company name or RC number..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-company-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Dispatched from</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-36 text-sm"
              data-testid="input-date-from"
            />
            <label className="text-xs text-muted-foreground">to</label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-36 text-sm"
              data-testid="input-date-to"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="button-clear-date-filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Company list */}
        {companiesLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {search ? "No companies match your search." : "No companies have been dispatched to your bank yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(company => (
              <Link key={company.id} href={`/bank/companies/${company.id}`}>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  data-testid={`card-company-${company.id}`}
                >
                  <CardContent className="py-4 px-5 flex items-center justify-between">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{company.companyName || "—"}</span>
                        {statusBadge(company.existingCompanyStatus)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {company.companyType && <span>{company.companyType}</span>}
                        {company.rcNumber && <span>RC: {company.rcNumber}</span>}
                        {company.dispatchedAt && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Dispatched {format(new Date(company.dispatchedAt), "d MMM yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-4" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
