import { useQuery } from "@tanstack/react-query";
import { DevLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { BarChart3 } from "lucide-react";

interface MonthlyRow { periodYear: number; periodMonth: number; module: string; request_count: number; error_count: number }
interface UsageData { byModule: { module: string; request_count: number; error_count: number }[]; total: number }
interface MonthlyData { months: MonthlyRow[] }

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function groupByMonth(rows: MonthlyRow[]) {
  const map: Record<string, { label: string; total: number; byModule: Record<string, number> }> = {};
  for (const r of rows) {
    const key = `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}`;
    if (!map[key]) map[key] = { label: `${MONTH_NAMES[r.periodMonth]} ${r.periodYear}`, total: 0, byModule: {} };
    map[key].total += Number(r.request_count);
    map[key].byModule[r.module] = (map[key].byModule[r.module] ?? 0) + Number(r.request_count);
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v);
}

export default function DeveloperUsage() {
  const { data: usage, isLoading: uLoading } = useQuery<UsageData>({ queryKey: ["/api/developers/usage"] });
  const { data: monthly, isLoading: mLoading } = useQuery<MonthlyData>({ queryKey: ["/api/developers/usage/monthly"] });

  const monthGroups = groupByMonth(monthly?.months ?? []);

  return (
    <DevLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground">API call breakdown by module and month</p>
      </div>

      {/* By module */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">All-time by Module</CardTitle></CardHeader>
        <CardContent>
          {uLoading ? <LoadingSpinner /> : (
            <div className="space-y-4">
              {(usage?.byModule ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No API calls recorded yet.</p>
              )}
              {(usage?.byModule ?? []).map(m => {
                const total = usage?.total ?? 1;
                const pct = Math.round((Number(m.request_count) / total) * 100);
                const errPct = Number(m.request_count) > 0
                  ? Math.round((Number(m.error_count) / Number(m.request_count)) * 100) : 0;
                return (
                  <div key={m.module}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="capitalize font-medium">{m.module}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{Number(m.request_count).toLocaleString()} calls</span>
                        {errPct > 0 && <span className="text-destructive text-xs">{errPct}% errors</span>}
                        <span className="text-muted-foreground text-xs">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full">
                      <div className="h-2 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {(usage?.total ?? 0) > 0 && (
                <div className="pt-2 border-t border-border/50 flex justify-between text-sm">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold">{(usage?.total ?? 0).toLocaleString()} calls</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {mLoading ? <LoadingSpinner /> : (
            <div className="space-y-6">
              {monthGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">No monthly data available yet.</p>
              )}
              {monthGroups.map((month, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">{month.label}</h3>
                    <span className="text-sm text-muted-foreground">{month.total.toLocaleString()} calls</span>
                  </div>
                  <div className="space-y-1.5 pl-2">
                    {Object.entries(month.byModule).map(([mod, count]) => (
                      <div key={mod} className="flex justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{mod}</span>
                        <span>{Number(count).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {i < monthGroups.length - 1 && <hr className="mt-4 border-border/40" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DevLayout>
  );
}
