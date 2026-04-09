import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Building2, ShieldCheck, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Intent = "founder_new_co" | "founder_existing_co" | "kyc_service" | "procurement";

export const INTENT_OPTIONS: {
  id: Intent;
  icon: React.ElementType;
  title: string;
  description: string;
}[] = [
  {
    id: "founder_new_co",
    icon: Building2,
    title: "Incorporate a New Company",
    description: "Register a new LTD, LLP, or other company type in Nigeria end-to-end.",
  },
  {
    id: "founder_existing_co",
    icon: CheckCircle2,
    title: "Manage an Existing Company",
    description: "Access compliance tools, legal assistance, and document management.",
  },
  {
    id: "kyc_service",
    icon: ShieldCheck,
    title: "KYC / Verification Service",
    description: "Verify your customers, employees, or suppliers via our KYC-as-a-Service platform.",
  },
  {
    id: "procurement",
    icon: ShoppingCart,
    title: "Procurement & Sourcing",
    description: "Post RFQs, receive bids, award contracts, and manage invoices.",
  },
];

function intentToRoute(intent: Intent): string {
  if (intent === "founder_new_co") return "/founder/dashboard";
  if (intent === "founder_existing_co") return "/founder/existing-company";
  if (intent === "kyc_service") return "/kyc/orgs";
  return "/procurement/marketplace";
}

interface ModuleSwitcherProps {
  compact?: boolean;
  onSwitch?: () => void;
}

export function ModuleSwitcher({ compact = false, onSwitch }: ModuleSwitcherProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [switching, setSwitching] = useState<Intent | null>(null);

  const intentMutation = useMutation({
    mutationFn: async (intent: Intent) => {
      await apiRequest("POST", "/api/me/intent", { intent });
      return intent;
    },
    onSuccess: (intent) => {
      queryClient.setQueryData(["/api/auth/user"], (prev: any) =>
        prev ? { ...prev, primaryIntent: intent } : prev
      );
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSwitching(null);
      onSwitch?.();
      navigate(intentToRoute(intent));
    },
    onError: () => {
      setSwitching(null);
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    },
  });

  const currentIntent = user?.primaryIntent as Intent | undefined;

  const handleSelect = (intent: Intent) => {
    if (intent === currentIntent || switching) return;
    setSwitching(intent);
    intentMutation.mutate(intent);
  };

  return (
    <div className={cn("space-y-2", compact ? "space-y-1.5" : "space-y-2")}>
      {INTENT_OPTIONS.map(({ id, icon: Icon, title, description }) => {
        const isActive = id === currentIntent;
        const isLoading = switching === id;

        return (
          <button
            key={id}
            onClick={() => handleSelect(id)}
            disabled={!!switching}
            data-testid={`module-option-${id}`}
            className={cn(
              "w-full text-left rounded-lg border-2 transition-all",
              compact ? "p-3" : "p-4",
              isActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/50",
              switching && !isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "rounded-md shrink-0 flex items-center justify-center",
                  compact ? "p-1.5" : "p-2",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {isLoading ? (
                  <Loader2 className={cn("animate-spin", compact ? "h-4 w-4" : "h-5 w-5")} />
                ) : (
                  <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={cn("font-medium leading-tight", compact ? "text-xs" : "text-sm")}>
                    {title}
                  </p>
                  {isActive && (
                    <Badge variant="default" className="text-[10px] h-4 px-1.5 py-0" data-testid={`badge-active-${id}`}>
                      Active
                    </Badge>
                  )}
                </div>
                {!compact && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
