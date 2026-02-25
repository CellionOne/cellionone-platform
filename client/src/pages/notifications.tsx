import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { Notification } from "@shared/schema";

function formatTimeAgo(dateStr: string | Date | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function typeBadgeVariant(type: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "success": return "default";
    case "warning": return "secondary";
    case "error": return "destructive";
    default: return "outline";
  }
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const role = user?.roles?.includes("admin") ? "admin" : user?.roles?.includes("lawyer") ? "lawyer" : "founder";

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <DashboardLayout role={role as any} breadcrumbs={[{ label: "Notifications" }]}>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-notifications-title">Notifications</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-notifications-summary">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read-page"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All as Read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 mt-1 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You'll see notifications here when there are updates about your applications, verifications, and account."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <Card
                key={notif.id}
                className={`p-4 ${!notif.isRead ? "border-l-2 border-l-primary" : ""}`}
                data-testid={`notification-card-${notif.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm ${!notif.isRead ? "font-semibold" : ""}`} data-testid={`text-notification-title-${notif.id}`}>
                        {notif.title}
                      </p>
                      <Badge variant={typeBadgeVariant(notif.type)} className="text-[10px]" data-testid={`badge-notification-type-${notif.id}`}>
                        {notif.type || "info"}
                      </Badge>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-notification-message-${notif.id}`}>
                      {notif.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2" data-testid={`text-notification-time-${notif.id}`}>
                      {formatTimeAgo(notif.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {notif.linkUrl && (
                      <Link href={notif.linkUrl}>
                        <Button size="icon" variant="ghost" data-testid={`link-notification-page-${notif.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {!notif.isRead && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => markReadMutation.mutate(notif.id)}
                        disabled={markReadMutation.isPending}
                        data-testid={`button-mark-read-page-${notif.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
