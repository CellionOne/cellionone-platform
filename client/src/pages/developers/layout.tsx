import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LayoutDashboard, Key, BarChart3, BookOpen, Settings, LogOut, Code2, AlertTriangle } from "lucide-react";
import { useDevAuth } from "@/hooks/use-dev-auth";

const NAV = [
  { href: "/developers/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/developers/keys", label: "API Keys", icon: Key },
  { href: "/developers/usage", label: "Usage", icon: BarChart3 },
  { href: "/developers/docs", label: "Documentation", icon: BookOpen },
  { href: "/developers/settings", label: "Settings", icon: Settings },
];

export function DevLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { devOrg } = useDevAuth();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/developers/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/developers/login";
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/developers/dashboard">
            <div className="flex items-center gap-2 cursor-pointer">
              <Code2 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Cellion One Developers</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {devOrg && (
              <span className="text-xs text-muted-foreground hidden sm:block">{devOrg.name}</span>
            )}
            <button
              onClick={() => logoutMutation.mutate()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 py-6 gap-6">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-44 shrink-0 gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Sandbox banner */}
          {devOrg?.sandboxOnly && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Sandbox mode.</strong> Your account is in sandbox mode. Live keys are disabled.{" "}
                <a href="mailto:service@cellionone.com" className="underline">Contact us</a> to enable live access.
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
