import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Building2, ShieldCheck, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

type Intent = "founder_new_co" | "founder_existing_co" | "kyc_service" | "procurement";

const INTENT_OPTIONS: { id: Intent; icon: React.ElementType; title: string; description: string }[] = [
  {
    id: "founder_new_co",
    icon: Building2,
    title: "Incorporate a New Company",
    description: "Register a new limited liability company (LTD, LLP, or other type) in Nigeria end-to-end through our digital wizard.",
  },
  {
    id: "founder_existing_co",
    icon: CheckCircle2,
    title: "Manage an Existing Company",
    description: "Already incorporated? Register your existing company to access compliance tools, legal assistance, and document management.",
  },
  {
    id: "kyc_service",
    icon: ShieldCheck,
    title: "KYC / Verification Service",
    description: "Run identity and document verification on your own customers, employees, or suppliers using our KYC-as-a-Service platform.",
  },
  {
    id: "procurement",
    icon: ShoppingCart,
    title: "Procurement & Sourcing",
    description: "Post RFQs, receive bids, award contracts, and manage invoices in our verified B2B marketplace for Nigerian businesses.",
  },
];

export default function WelcomePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Intent | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const intentMutation = useMutation({
    mutationFn: async (intent: Intent) => {
      await apiRequest("POST", "/api/me/intent", { intent });
    },
    onSuccess: (_, intent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      if (intent === "founder_new_co") {
        navigate("/founder/dashboard");
      } else if (intent === "founder_existing_co") {
        navigate("/founder/existing-company");
      } else if (intent === "kyc_service") {
        navigate("/kyc/orgs");
      } else if (intent === "procurement") {
        navigate("/kyc/orgs");
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
      setSubmitting(false);
    },
  });

  const handleContinue = () => {
    if (!selected) return;
    setSubmitting(true);
    intentMutation.mutate(selected);
  };

  const firstName = user?.firstName || "there";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Cellion One, {firstName}!</h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            Tell us how you'll be using the platform so we can tailor your experience. You can always access other modules later.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INTENT_OPTIONS.map(({ id, icon: Icon, title, description }) => (
            <Card
              key={id}
              className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                selected === id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40"
              }`}
              onClick={() => setSelected(id)}
              data-testid={`card-intent-${id}`}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2 shrink-0 ${selected === id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                </div>
                {selected === id && (
                  <div className="flex justify-end">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!selected || submitting}
            onClick={handleContinue}
            className="px-10"
            data-testid="button-continue-intent"
          >
            {submitting ? "Setting up your account…" : "Continue"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You can change your focus area anytime from your account settings.
        </p>
      </div>
    </div>
  );
}
