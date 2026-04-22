import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MacroSummary {
  available: boolean;
  contextDate?: string | null;
  asiClose?: number | null;
  asiChangePct?: number | null;
  brentUsd?: number | null;
  ngnPerUsd?: number | null;
  cbnMpr?: number | null;
}

function Ticker({
  label,
  value,
  sub,
  positive,
  delay,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  positive?: boolean | null;
  delay: number;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background/60 border border-border/50 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both", animationDuration: "400ms" }}
      data-testid={`macro-ticker-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
    >
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className="text-sm font-bold tabular-nums leading-none">{value}</span>
      {sub}
      {positive != null && (
        positive
          ? <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
          : <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
      )}
      {positive == null && sub == null && <Minus className="h-3 w-3 text-muted-foreground shrink-0" />}
    </div>
  );
}

function ChangePill({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const pos = pct >= 0;
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums ${
        pos
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      }`}
    >
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

export function MacroBar() {
  const { data, isLoading } = useQuery<MacroSummary>({
    queryKey: ["/api/cie-portal/market-summary"],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-9 px-1">
        {[80, 100, 90, 80].map((w, i) => (
          <div
            key={i}
            className="h-8 rounded-md bg-muted animate-pulse"
            style={{ width: w }}
          />
        ))}
      </div>
    );
  }

  if (!data?.available) return null;

  const items: Array<{
    label: string;
    value: string;
    sub?: ReactNode;
    positive?: boolean | null;
    delay: number;
  }> = [
    {
      label: "NGX ASI",
      value: data.asiClose != null ? data.asiClose.toLocaleString("en-NG", { maximumFractionDigits: 2 }) : "—",
      sub: <ChangePill pct={data.asiChangePct} />,
      positive: data.asiChangePct != null ? data.asiChangePct >= 0 : null,
      delay: 0,
    },
    {
      label: "Brent Crude",
      value: data.brentUsd != null ? `$${data.brentUsd.toFixed(2)}` : "—",
      positive: null,
      delay: 80,
    },
    {
      label: "NGN / USD",
      value: data.ngnPerUsd != null ? `₦${data.ngnPerUsd.toFixed(2)}` : "—",
      positive: null,
      delay: 160,
    },
    {
      label: "CBN MPR",
      value: data.cbnMpr != null ? `${data.cbnMpr.toFixed(2)}%` : "—",
      positive: null,
      delay: 240,
    },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="region"
      aria-label="Market macro indicators"
      data-testid="macro-bar"
    >
      {items.map(item => (
        <Ticker key={item.label} {...item} />
      ))}
      {data.contextDate && (
        <span
          className="text-[10px] text-muted-foreground ml-1 self-center"
          data-testid="macro-bar-date"
        >
          as of {new Date(data.contextDate).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
        </span>
      )}
    </div>
  );
}
