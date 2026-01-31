import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useState } from "react";
import {
  ClipboardList,
  Search,
  User,
  FileText,
  Shield,
  Download,
  Eye,
  Settings,
} from "lucide-react";
import type { AuditLog } from "@shared/schema";

const actionIcons: Record<string, React.ElementType> = {
  login: User,
  logout: User,
  view_application: Eye,
  upload_document: FileText,
  download_document: Download,
  change_status: Settings,
  request_clarification: ClipboardList,
  admin_override: Shield,
};

export default function AdminAuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action?.toLowerCase().includes(query) ||
      log.entityType?.toLowerCase().includes(query) ||
      log.actorUserId?.toLowerCase().includes(query)
    );
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionLabel = (action: string) => {
    return action
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <DashboardLayout 
      role="admin" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Audit Logs" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all platform activity and changes
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by action, entity, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-w-md"
            data-testid="input-search"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !filteredLogs?.length ? (
          <EmptyState
            icon={ClipboardList}
            title="No audit logs found"
            description="Activity logs will appear here as users interact with the platform."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredLogs.map((log) => {
                  const Icon = actionIcons[log.action] || ClipboardList;
                  
                  return (
                    <div 
                      key={log.id} 
                      className="flex items-start gap-4 p-4"
                      data-testid={`log-${log.id}`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{getActionLabel(log.action)}</p>
                          {log.entityType && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {log.entityType}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {log.actorUserId && <span>User: {log.actorUserId.slice(0, 8)}...</span>}
                          {log.entityId && <span> &bull; ID: {log.entityId}</span>}
                        </div>
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground mt-1">
                            IP: {log.ipAddress}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground shrink-0">
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
