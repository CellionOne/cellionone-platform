import { useQuery } from "@tanstack/react-query";
import { DevLayout } from "./layout";
import { useDevAuth } from "@/hooks/use-dev-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { BarChart3, Key, Activity, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface UsageData { byModule: { module: string; request_count: number; error_count: number }[]; total: number }
interface StatusData { data: { modules: Record<string, { status: string; endpoints: number }> } }
interface KeysData { keys: { id: number; name: string; keyPrefix: string; environment: string; lastUsedAt: string | null; totalCalls: number }[] }

function ModuleStatusBadge({ status }: { status: string }) {
  if (status === "operational") return <span className="text-xs font-medium text-green-600">● Operational</span>;
  if (status === "coming_soon") return <span className="text-xs text-muted-foreground">Coming soon</span>;
  return <span className="text-xs text-amber-600">● {status}</span>;
}

export default function DeveloperDashboard() {
  const { devOrg } = useDevAuth();
  const { data: usage, isLoading: usageLoading } = useQuery<UsageData>({ queryKey: ["/api/developers/usage"] });
  const { data: status } = useQuery<StatusData>({ queryKey: ["/api/v1/status"] });
  const { data: keysData } = useQuery<KeysData>({ queryKey: ["/api/developers/keys"] });

  const modules = status?.data?.modules ?? {};
  const keyCount = keysData?.keys?.length ?? 0;

  return (
    <DevLayout>
      <div>
        <h1 className="text-xl font-semibold mb-1">Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Welcome back, {devOrg?.name ?? "developer"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total calls</span>
            </div>
            {usageLoading ? <LoadingSpinner size="sm" /> : (
              <p className="text-2xl font-bold">{(usage?.total ?? 0).toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active keys</span>
            </div>
            <p className="text-2xl font-bold">{keyCount}</p>
          </CardContent>
        </Card>

        {(usage?.byModule ?? []).slice(0, 2).map(m => (
          <Card key={m.module}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground capitalize">{m.module}</span>
              </div>
              <p className="text-2xl font-bold">{Number(m.request_count).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Module status */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Module Status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(modules).map(([name, info]) => (
              <div key={name} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                <span className="text-sm capitalize font-medium">{name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{info.endpoints} endpoints</span>
                  <ModuleStatusBadge status={info.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Usage by module */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Usage by Module</CardTitle>
            <Link href="/developers/usage">
              <Button variant="ghost" size="sm" className="text-xs">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {usageLoading ? <LoadingSpinner /> : (
              <div className="space-y-3">
                {(usage?.byModule ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No API calls yet. Create a key to get started.</p>
                )}
                {(usage?.byModule ?? []).map(m => {
                  const total = usage?.total ?? 1;
                  const pct = Math.round((Number(m.request_count) / total) * 100);
                  return (
                    <div key={m.module}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="capitalize font-medium">{m.module}</span>
                        <span className="text-muted-foreground">{Number(m.request_count).toLocaleString()} calls</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full">
                        <div className="h-1.5 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      {keyCount === 0 && (
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Create your first API key</p>
              <p className="text-xs text-muted-foreground">Start making API calls in minutes</p>
            </div>
            <Link href="/developers/keys">
              <Button size="sm">Create key</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </DevLayout>
  );
}
