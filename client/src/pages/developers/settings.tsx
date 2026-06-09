import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DevLayout } from "./layout";
import { useDevAuth } from "@/hooks/use-dev-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function DeveloperSettings() {
  const { toast } = useToast();
  const { devOrg } = useDevAuth();
  const [form, setForm] = useState({ name: devOrg?.name ?? "", website: devOrg?.website ?? "", orgType: devOrg?.orgType ?? "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/developers/settings", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developers/me"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  return (
    <DevLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your developer organisation profile</p>
      </div>

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Organisation Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Organisation name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input placeholder="https://example.com" value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Organisation type</Label>
              <Input placeholder="e.g. Fintech, MFB" value={form.orgType}
                onChange={e => setForm(f => ({ ...f, orgType: e.target.value }))} />
            </div>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <LoadingSpinner size="sm" /> : "Save changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Account Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Email</span>
              <span className="text-sm text-muted-foreground">{devOrg?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tier</span>
              <Badge variant="outline" className="capitalize">{devOrg?.tier ?? "starter"}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Access mode</span>
              <Badge variant={devOrg?.sandboxOnly ? "secondary" : "default"}>
                {devOrg?.sandboxOnly ? "Sandbox only" : "Live access"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Approval status</span>
              <Badge variant={devOrg?.isApproved ? "default" : "secondary"}>
                {devOrg?.isApproved ? "Approved" : "Pending review"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {devOrg?.sandboxOnly && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
            <CardContent className="py-4">
              <p className="text-sm font-medium mb-1">Request live access</p>
              <p className="text-xs text-muted-foreground mb-3">
                Your account is in sandbox mode. To enable live API calls, contact us with your integration details.
              </p>
              <a href="mailto:service@cellionone.com?subject=Live%20API%20Access%20Request">
                <Button variant="outline" size="sm">Contact sales</Button>
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </DevLayout>
  );
}
