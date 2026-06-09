import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Ban, Key, Search } from "lucide-react";

interface DevOrg {
  id: number; name: string; email: string; orgType: string | null;
  tier: string | null; isEmailVerified: boolean; isApproved: boolean;
  isSuspended: boolean; sandboxOnly: boolean; createdAt: string | null;
}

type FilterType = "all" | "pending" | "sandbox" | "approved" | "suspended";

export default function AdminDevelopers() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ orgs: DevOrg[] }>({
    queryKey: ["/api/admin/developers"],
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/developers/${id}/approve`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/developers"] }); toast({ title: "Developer approved for live access" }); },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/developers/${id}/suspend`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/developers"] }); toast({ title: "Developer suspended" }); },
  });

  const unsuspendMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/developers/${id}/unsuspend`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/developers"] }); toast({ title: "Developer unsuspended" }); },
  });

  const orgs = data?.orgs ?? [];

  const filtered = orgs.filter(o => {
    if (filter === "pending") return !o.isApproved && !o.isSuspended;
    if (filter === "sandbox") return o.sandboxOnly && !o.isSuspended;
    if (filter === "approved") return o.isApproved;
    if (filter === "suspended") return o.isSuspended;
    return true;
  }).filter(o =>
    !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.email.toLowerCase().includes(search.toLowerCase())
  );

  const FILTERS: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending approval" },
    { value: "sandbox", label: "Sandbox only" },
    { value: "approved", label: "Approved" },
    { value: "suspended", label: "Suspended" },
  ];

  return (
    <DashboardLayout role="admin" breadcrumbs={[{ label: "Developers" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Developer Organisations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage API developer accounts and live access approvals
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", count: orgs.length },
            { label: "Pending", count: orgs.filter(o => !o.isApproved && !o.isSuspended).length },
            { label: "Approved", count: orgs.filter(o => o.isApproved).length },
            { label: "Suspended", count: orgs.filter(o => o.isSuspended).length },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters + search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map(f => (
              <button key={f.value}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  filter === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search by name or email…" className="pl-8 h-8 text-sm w-64"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organisation</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(org => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{org.name}</p>
                            <p className="text-xs text-muted-foreground">{org.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{org.orgType ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{org.tier ?? "starter"}</Badge>
                        </TableCell>
                        <TableCell>
                          {org.isEmailVerified
                            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                            : <span className="text-xs text-muted-foreground">Pending</span>}
                        </TableCell>
                        <TableCell>
                          {org.isSuspended
                            ? <Badge variant="destructive" className="text-xs">Suspended</Badge>
                            : org.isApproved
                              ? <Badge className="text-xs bg-green-600">Approved</Badge>
                              : <Badge variant="secondary" className="text-xs">Pending review</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={org.sandboxOnly ? "secondary" : "default"} className="text-xs">
                            {org.sandboxOnly ? "Sandbox" : "Live"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {org.createdAt ? new Date(org.createdAt).toLocaleDateString("en-NG") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!org.isApproved && !org.isSuspended && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate(org.id)}>
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </Button>
                            )}
                            {!org.isSuspended ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1"
                                onClick={() => suspendMutation.mutate(org.id)}>
                                <Ban className="h-3 w-3" /> Suspend
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                                onClick={() => unsuspendMutation.mutate(org.id)}>
                                Unsuspend
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                          {search ? "No results match your search." : "No developer organisations yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
