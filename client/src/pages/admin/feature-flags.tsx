import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Flag } from "lucide-react";
import type { FeatureFlag } from "@shared/schema";

const flagDescriptions: Record<string, string> = {
  enable_tin_registration: "Allow users to apply for Tax Identification Numbers",
  enable_bank_referrals: "Enable bank account opening referral service",
  enable_registered_address_service: "Offer virtual registered address service",
  enable_mail_forwarding: "Enable mail forwarding for virtual addresses",
  enable_compliance_reminders: "Send automated compliance deadline reminders",
};

export default function AdminFeatureFlags() {
  const { toast } = useToast();

  const { data: flags, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ["/api/admin/feature-flags"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, isEnabled }: { key: string; isEnabled: boolean }) => {
      return apiRequest("PATCH", `/api/admin/feature-flags/${key}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      toast({ title: "Feature flag updated" });
    },
    onError: () => {
      toast({ title: "Failed to update flag", variant: "destructive" });
    },
  });

  return (
    <DashboardLayout 
      role="admin" 
      breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Feature Flags" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="text-muted-foreground">
            Enable or disable platform features without code changes
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="grid gap-4">
            {flags?.map((flag) => (
              <Card key={flag.id} data-testid={`flag-${flag.key}`}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Flag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{flag.key}</h3>
                      <p className="text-sm text-muted-foreground">
                        {flag.description || flagDescriptions[flag.key] || "No description"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={flag.isEnabled || false}
                    onCheckedChange={(checked) => 
                      toggleMutation.mutate({ key: flag.key, isEnabled: checked })
                    }
                    disabled={toggleMutation.isPending}
                    data-testid={`toggle-${flag.key}`}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
