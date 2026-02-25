import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Notification } from "@shared/schema";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function NotificationBell() {
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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

  const recentNotifications = notifications.slice(0, 8);

  function formatTime(dateStr: string | Date | null) {
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] px-1 no-default-hover-elevate no-default-active-elevate"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="popover-notifications">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-no-notifications">
              No notifications yet
            </div>
          ) : (
            recentNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-3 border-b last:border-b-0 ${
                  !notif.isRead ? "bg-muted/50" : ""
                }`}
                data-testid={`notification-item-${notif.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.isRead ? "font-medium" : "text-muted-foreground"}`}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatTime(notif.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {notif.linkUrl && (
                    <Link href={notif.linkUrl}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`link-notification-${notif.id}`}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                  {!notif.isRead && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => markReadMutation.mutate(notif.id)}
                      disabled={markReadMutation.isPending}
                      data-testid={`button-mark-read-${notif.id}`}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Link href="/notifications">
              <Button variant="ghost" className="w-full" size="sm" data-testid="link-view-all-notifications">
                View All Notifications
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "founder" | "lawyer" | "admin";
  breadcrumbs?: { label: string; href?: string }[];
}

export function DashboardLayout({ children, role, breadcrumbs = [] }: DashboardLayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar role={role} />
        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" data-testid="button-sidebar-toggle" />
              <Separator orientation="vertical" className="h-4" />
              {breadcrumbs.length > 0 && (
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, index) => (
                      <BreadcrumbItem key={index}>
                        {index > 0 && <BreadcrumbSeparator />}
                        {crumb.href ? (
                          <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              )}
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
