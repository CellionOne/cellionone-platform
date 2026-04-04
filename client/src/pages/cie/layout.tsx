import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Activity, BarChart3, Zap, Key, Star, Lock } from "lucide-react";

interface CieLayoutProps {
  children: ReactNode;
  tier: "free" | "subscriber" | "pro";
}

const NAV_ITEMS = [
  { href: "/cie", label: "Market Pulse", icon: Activity, minTier: "free" as const, exact: true },
  { href: "/cie/securities", label: "Securities", icon: BarChart3, minTier: "subscriber" as const },
  { href: "/cie/signals", label: "Signals", icon: Zap, minTier: "pro" as const },
  { href: "/cie/api-keys", label: "API Keys", icon: Key, minTier: "subscriber" as const },
  { href: "/cie/subscribe", label: "Subscription", icon: Star, minTier: "free" as const },
];

const TIER_ORDER = { free: 0, subscriber: 1, pro: 2 };

function tierBadge(tier: "free" | "subscriber" | "pro") {
  const map = {
    pro: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    subscriber: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    free: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[tier]}`}
      data-testid="badge-cie-tier"
    >
      {tier}
    </span>
  );
}

export function CieLayout({ children, tier }: CieLayoutProps) {
  const [location] = useLocation();

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "CIE Intelligence" }]}>
      <div className="flex h-full">
        {/* Left sidebar nav */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-border/60 py-6 px-3 gap-1">
          <div className="px-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">NGX Intelligence</span>
            </div>
            {tierBadge(tier)}
          </div>

          {NAV_ITEMS.map((item) => {
            const isLocked = TIER_ORDER[tier] < TIER_ORDER[item.minTier];
            const isActive = item.exact
              ? location === item.href
              : location.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link key={item.href} href={isLocked ? "/cie/subscribe" : item.href}>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  } ${isLocked ? "opacity-60" : ""}`}
                  data-testid={`nav-cie-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isLocked && <Lock className="h-3 w-3 shrink-0 opacity-70" />}
                </div>
              </Link>
            );
          })}
        </aside>

        {/* Mobile tab strip */}
        <div className="md:hidden flex overflow-x-auto border-b border-border/60 px-4 gap-1 sticky top-0 bg-background z-10">
          {NAV_ITEMS.map((item) => {
            const isLocked = TIER_ORDER[tier] < TIER_ORDER[item.minTier];
            const isActive = item.exact ? location === item.href : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={isLocked ? "/cie/subscribe" : item.href}>
                <div
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-cie-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {isLocked && <Lock className="h-3 w-3 opacity-60" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </DashboardLayout>
  );
}
