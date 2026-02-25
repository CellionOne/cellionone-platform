import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  Plus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { KycOrganisation } from "@shared/schema";

interface OrgWithRole extends KycOrganisation {
  memberRole?: string;
}

export default function KycOrgsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("corporate");
  const [contactEmail, setContactEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { data: orgs, isLoading } = useQuery<OrgWithRole[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/kyc-service/organisations", data);
      return res.json();
    },
    onSuccess: (org: KycOrganisation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations"] });
      setCreateDialogOpen(false);
      resetForm();
      navigate(`/kyc/org/${org.id}`);
      toast({ title: "Organisation created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create organisation", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setName("");
    setCategory("corporate");
    setContactEmail("");
    setTermsAccepted(false);
  }

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service" }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-kyc-service-title">KYC Service</h1>
            <p className="text-muted-foreground text-sm">Manage your KYC verification organisations</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-org">
                <Plus className="h-4 w-4 mr-2" />
                New Organisation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Organisation</DialogTitle>
                <DialogDescription>Set up a new organisation for KYC verification management.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Organisation Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" data-testid="input-create-name" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-create-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="ngo">NGO</SelectItem>
                      <SelectItem value="educational">Educational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="admin@company.com" data-testid="input-create-email" />
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    data-testid="checkbox-terms"
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed">
                    I accept the{" "}
                    <a href="/kyc/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      KYC Service Agreement
                    </a>{" "}
                    on behalf of this organisation.
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMutation.mutate({ name, category, contactEmail, termsAccepted })}
                  disabled={!name || !contactEmail || !termsAccepted || createMutation.isPending}
                  data-testid="button-submit-create-org"
                >
                  {createMutation.isPending ? "Creating..." : "Create Organisation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : !orgs || orgs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organisations yet"
            description="Create your first organisation to start managing KYC verifications."
            action={
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-empty-create-org">
                <Plus className="h-4 w-4 mr-2" />
                Create Organisation
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.map((org) => (
              <Card key={org.id} className="hover-elevate" data-testid={`card-org-${org.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base" data-testid={`text-org-name-${org.id}`}>{org.name}</CardTitle>
                        <CardDescription>{org.category}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="border-0">{org.memberRole?.replace("org_", "") || "member"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{org.status}</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild data-testid={`button-open-org-${org.id}`}>
                      <Link href={`/kyc/org/${org.id}`}>
                        Open
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
