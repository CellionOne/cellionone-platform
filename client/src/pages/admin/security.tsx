import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LoadingSpinner } from "@/components/loading-spinner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, ChevronDown } from "lucide-react";

interface SecuritySummary {
  total24h: number;
  critical24h: number;
  lockedAccounts: number;
  uniqueFailedIps24h: number;
}

interface SecurityEvent {
  id: number;
  eventType: string;
  severity: string;
  ipAddress: string;
  details: Record<string, unknown>;
  createdAt: string;
}

interface LockedAccount {
  identifier: string;
  failedAttempts: number;
  lockedUntil: string;
}

interface NewIpLogin {
  userId: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  isNewIp: boolean;
}

const eventTypeOptions = [
  { value: "all", label: "All Types" },
  { value: "suspicious_request", label: "Suspicious Request" },
  { value: "account_locked", label: "Account Locked" },
  { value: "failed_login", label: "Failed Login" },
  { value: "failed_login_spike", label: "Failed Login Spike" },
  { value: "login_new_location", label: "Login New Location" },
  { value: "csp_violation", label: "CSP Violation" },
];

const severityOptions = [
  { value: "all", label: "All Severities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function severityBadgeVariant(severity: string) {
  switch (severity) {
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "";
  }
}

function formatDate(date: string | null) {
  if (!date) return "\u2014";
  return new Date(date).toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRemaining(lockedUntil: string) {
  const diff = new Date(lockedUntil).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.ceil(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

function formatEventType(type: string) {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function AdminSecurity() {
  const [eventType, setEventType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [offset, setOffset] = useState(0);
  const [allEvents, setAllEvents] = useState<SecurityEvent[]>([]);
  const { toast } = useToast();
  const limit = 50;

  const { data: summary, isLoading: summaryLoading } = useQuery<SecuritySummary>({
    queryKey: ["/api/admin/security-summary"],
  });

  const eventsQuery = useQuery<SecurityEvent[]>({
    queryKey: ["/api/admin/security-events", eventType, severity, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (eventType !== "all") params.set("eventType", eventType);
      if (severity !== "all") params.set("severity", severity);
      const res = await fetch(`/api/admin/security-events?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const currentEvents = offset === 0
    ? (eventsQuery.data || [])
    : [...allEvents, ...(eventsQuery.data || [])];

  const { data: lockedAccounts, isLoading: lockedLoading } = useQuery<LockedAccount[]>({
    queryKey: ["/api/admin/locked-accounts"],
  });

  const { data: anomalies, isLoading: anomaliesLoading } = useQuery<NewIpLogin[]>({
    queryKey: ["/api/admin/recent-new-ip-logins", "7"],
    queryFn: async () => {
      const res = await fetch("/api/admin/recent-new-ip-logins?days=7", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch anomalies");
      return res.json();
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (identifier: string) =>
      apiRequest("POST", "/api/admin/unlock-account", { identifier }),
    onSuccess: () => {
      toast({ title: "Account unlocked successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locked-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/security-summary"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to unlock account", description: error.message, variant: "destructive" });
    },
  });

  function handleFilterChange(type: string, value: string) {
    setAllEvents([]);
    setOffset(0);
    if (type === "eventType") setEventType(value);
    else setSeverity(value);
  }

  function handleLoadMore() {
    setAllEvents(currentEvents);
    setOffset((prev) => prev + limit);
  }

  return (
    <DashboardLayout
      role="admin"
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Security" }]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="heading-security">Security Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-total-events">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? <LoadingSpinner /> : (
                <div className="text-2xl font-bold">{summary?.total24h ?? 0}</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-critical-events">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Events (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? <LoadingSpinner /> : (
                <div className={`text-2xl font-bold ${(summary?.critical24h ?? 0) > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                  {summary?.critical24h ?? 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-locked-accounts">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Locked Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? <LoadingSpinner /> : (
                <div className={`text-2xl font-bold ${(summary?.lockedAccounts ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                  {summary?.lockedAccounts ?? 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-failed-ips">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Failed IPs (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? <LoadingSpinner /> : (
                <div className="text-2xl font-bold">{summary?.uniqueFailedIps24h ?? 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="events">
          <TabsList>
            <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
            <TabsTrigger value="locked" data-testid="tab-locked">Locked Accounts</TabsTrigger>
            <TabsTrigger value="anomalies" data-testid="tab-anomalies">Login Anomalies</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={eventType} onValueChange={(v) => handleFilterChange("eventType", v)}>
                <SelectTrigger className="w-[200px]" data-testid="select-event-type">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={severity} onValueChange={(v) => handleFilterChange("severity", v)}>
                <SelectTrigger className="w-[200px]" data-testid="select-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  {severityOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventsQuery.isLoading && offset === 0 ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <Card>
                <Table data-testid="table-events">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No security events found
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentEvents.map((evt) => (
                        <TableRow key={evt.id} data-testid={`row-event-${evt.id}`}>
                          <TableCell className="whitespace-nowrap">{formatDate(evt.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{formatEventType(evt.eventType)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`no-default-hover-elevate no-default-active-elevate ${severityBadgeVariant(evt.severity)}`}>
                              {evt.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{evt.ipAddress || "\u2014"}</TableCell>
                          <TableCell>
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <pre className="text-xs bg-muted p-2 rounded-md mt-1 max-w-md overflow-auto">
                                  {JSON.stringify(evt.details, null, 2)}
                                </pre>
                              </CollapsibleContent>
                            </Collapsible>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {(eventsQuery.data?.length ?? 0) >= limit && (
                  <div className="flex justify-center p-4">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={eventsQuery.isLoading}
                      data-testid="button-load-more"
                    >
                      {eventsQuery.isLoading ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="locked" className="space-y-4">
            {lockedLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <Card>
                <Table data-testid="table-locked">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Failed Attempts</TableHead>
                      <TableHead>Locked Until</TableHead>
                      <TableHead>Time Remaining</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!lockedAccounts?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No locked accounts
                        </TableCell>
                      </TableRow>
                    ) : (
                      lockedAccounts.map((acct) => (
                        <TableRow key={acct.identifier} data-testid={`row-locked-${acct.identifier}`}>
                          <TableCell className="font-mono text-sm">{acct.identifier}</TableCell>
                          <TableCell>{acct.failedAttempts}</TableCell>
                          <TableCell>{formatDate(acct.lockedUntil)}</TableCell>
                          <TableCell>{formatTimeRemaining(acct.lockedUntil)}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unlockMutation.mutate(acct.identifier)}
                              disabled={unlockMutation.isPending}
                              data-testid={`button-unlock-${acct.identifier}`}
                            >
                              Unlock
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-4">
            {anomaliesLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <Card>
                <Table data-testid="table-anomalies">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>User Agent</TableHead>
                      <TableHead>Login Time</TableHead>
                      <TableHead>Is New IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!anomalies?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No login anomalies found
                        </TableCell>
                      </TableRow>
                    ) : (
                      anomalies.map((login, idx) => (
                        <TableRow key={idx} data-testid={`row-anomaly-${idx}`}>
                          <TableCell className="font-mono text-sm">{login.userId}</TableCell>
                          <TableCell className="font-mono text-sm">{login.ipAddress}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{login.userAgent}</TableCell>
                          <TableCell>{formatDate(login.loginTime)}</TableCell>
                          <TableCell>
                            {login.isNewIp ? (
                              <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate">New</Badge>
                            ) : (
                              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">Known</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}