import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  Plus,
  Trash2,
  UserPlus,
  Layers,
  Key,
  Webhook,
  CreditCard,
  Copy,
  Eye,
  EyeOff,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Settings2,
  Camera,
  ScanFace,
  Zap,
  CheckCircle2,
  Timer,
} from "lucide-react";
import type {
  KycOrganisation, KycOrgMember, KycDocumentRequirement, KycVerificationTemplate,
  KycApiKey, KycWebhookConfig, KycWebhookDeliveryLog, KycBillingAccount, KycCreditTransaction, KycInvoice, KycBillingRequest,
} from "@shared/schema";

interface OrgDetail extends KycOrganisation {
  members: KycOrgMember[];
  stats: any;
}

export default function OrgSettingsPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id;
  const { toast } = useToast();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("org_reviewer");

  const [addReqDialogOpen, setAddReqDialogOpen] = useState(false);
  const [newReqName, setNewReqName] = useState("");
  const [newReqDesc, setNewReqDesc] = useState("");
  const [newReqType, setNewReqType] = useState("individual");
  const [newReqCategory, setNewReqCategory] = useState("identity");
  const [newReqMandatory, setNewReqMandatory] = useState(true);
  const [newReqExpiry, setNewReqExpiry] = useState(false);

  const [addTemplateDialogOpen, setAddTemplateDialogOpen] = useState(false);
  const [newTmplName, setNewTmplName] = useState("");
  const [newTmplType, setNewTmplType] = useState("individual");
  const [newTmplDesc, setNewTmplDesc] = useState("");
  const [newTmplDirectorVerification, setNewTmplDirectorVerification] = useState(false);
  const [newTmplDefault, setNewTmplDefault] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [orgEmployeePortal, setOrgEmployeePortal] = useState(true);
  const [orgSupplierPortal, setOrgSupplierPortal] = useState(true);
  const [orgInitialized, setOrgInitialized] = useState(false);
  const [integrationProfileMode, setIntegrationProfileMode] = useState<"full_hosted" | "prefill_selfie" | "selfie_only" | null>(null);

  const { data: org, isLoading } = useQuery<OrgDetail>({
    queryKey: ["/api/kyc-service/organisations", orgId],
  });

  if (org && !orgInitialized) {
    setOrgName(org.name);
    setOrgEmail(org.contactEmail);
    setOrgPhone(org.contactPhone || "");
    setOrgAddress(org.address || "");
    setOrgEmployeePortal(org.employeePortalEnabled ?? true);
    setOrgSupplierPortal(org.supplierPortalEnabled ?? true);
    if (org.integrationProfile?.mode) {
      setIntegrationProfileMode(org.integrationProfile.mode);
    }
    setOrgInitialized(true);
  }

  const { data: requirements } = useQuery<KycDocumentRequirement[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"],
  });

  const { data: templates } = useQuery<KycVerificationTemplate[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "templates"],
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      toast({ title: "Organisation updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/members`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("org_reviewer");
      toast({ title: "Invitation sent" });
    },
    onError: (error: Error) => {
      toast({ title: "Invite failed", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/members/${memberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId] });
      toast({ title: "Member removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    },
  });

  const addRequirementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/document-requirements`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"] });
      setAddReqDialogOpen(false);
      resetReqForm();
      toast({ title: "Requirement added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add requirement", description: error.message, variant: "destructive" });
    },
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: async (reqId: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/document-requirements/${reqId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"] });
      toast({ title: "Requirement deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleRequirementMutation = useMutation({
    mutationFn: async ({ reqId, data }: { reqId: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}/document-requirements/${reqId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "document-requirements"] });
    },
  });

  const addTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/templates`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "templates"] });
      setAddTemplateDialogOpen(false);
      resetTemplateForm();
      toast({ title: "Template created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create template", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (tid: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/templates/${tid}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  function resetReqForm() {
    setNewReqName("");
    setNewReqDesc("");
    setNewReqType("individual");
    setNewReqCategory("identity");
    setNewReqMandatory(true);
    setNewReqExpiry(false);
  }

  function resetTemplateForm() {
    setNewTmplName("");
    setNewTmplType("individual");
    setNewTmplDesc("");
    setNewTmplDirectorVerification(false);
    setNewTmplDefault(false);
  }

  function handleSaveOrg() {
    updateOrgMutation.mutate({
      name: orgName,
      contactEmail: orgEmail,
      contactPhone: orgPhone || undefined,
      address: orgAddress || undefined,
      employeePortalEnabled: orgEmployeePortal,
      supplierPortalEnabled: orgSupplierPortal,
    });
  }

  if (isLoading) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Settings" }]}>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!org) {
    return (
      <DashboardLayout role="founder" breadcrumbs={[{ label: "KYC Service", href: "/kyc/orgs" }, { label: "Not Found" }]}>
        <EmptyState title="Organisation not found" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[
        { label: "KYC Service", href: "/kyc/orgs" },
        { label: org.name, href: `/kyc/org/${orgId}` },
        { label: "Settings" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" asChild data-testid="button-back-to-org">
            <Link href={`/kyc/org/${orgId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Organisation Settings</h1>
            <p className="text-sm text-muted-foreground">{org.name}</p>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList data-testid="tabs-settings" className="flex-wrap">
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
            <TabsTrigger value="requirements" data-testid="tab-requirements">Documents</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            <TabsTrigger value="integration" data-testid="tab-integration">Integration</TabsTrigger>
            <TabsTrigger value="api-keys" data-testid="tab-api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="webhooks" data-testid="tab-webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Organisation Profile
                </CardTitle>
                <CardDescription>Update your organisation details and portal settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Organisation Name</Label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} data-testid="input-org-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} data-testid="input-org-email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} data-testid="input-org-phone" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Address</Label>
                    <Textarea value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} data-testid="input-org-address" />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Portal Settings</h3>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Employee Portal</p>
                      <p className="text-xs text-muted-foreground">Allow employees to self-register for verification</p>
                    </div>
                    <Switch checked={orgEmployeePortal} onCheckedChange={setOrgEmployeePortal} data-testid="switch-employee-portal" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Supplier Portal</p>
                      <p className="text-xs text-muted-foreground">Allow suppliers to self-register for verification</p>
                    </div>
                    <Switch checked={orgSupplierPortal} onCheckedChange={setOrgSupplierPortal} data-testid="switch-supplier-portal" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveOrg} disabled={updateOrgMutation.isPending} data-testid="button-save-org">
                    {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Team Members
                  </CardTitle>
                  <CardDescription>Manage who has access to this organisation.</CardDescription>
                </div>
                <Button onClick={() => setInviteDialogOpen(true)} data-testid="button-invite-member">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(org.members || []).map((member) => (
                        <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                          <TableCell className="text-sm">{member.inviteEmail}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="border-0">{member.role.replace("org_", "")}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`border-0 ${member.inviteStatus === "accepted" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}
                            >
                              {member.inviteStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {member.userId !== org.createdByUserId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeMemberMutation.mutate(member.id)}
                                disabled={removeMemberMutation.isPending}
                                data-testid={`button-remove-member-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requirements" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document Requirements
                  </CardTitle>
                  <CardDescription>Manage standard and custom document requirements.</CardDescription>
                </div>
                <Button onClick={() => setAddReqDialogOpen(true)} data-testid="button-add-requirement">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Mandatory</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(requirements || []).map((req) => (
                        <TableRow key={req.id} data-testid={`row-req-${req.id}`}>
                          <TableCell className="text-sm font-medium">{req.documentName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="border-0">{req.type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{req.documentCategory}</TableCell>
                          <TableCell>
                            <Switch
                              checked={req.isMandatory}
                              onCheckedChange={(checked) => toggleRequirementMutation.mutate({ reqId: req.id, data: { isMandatory: checked } })}
                              disabled={req.isStandard && !req.orgId}
                              data-testid={`switch-mandatory-${req.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={req.hasExpiry}
                              onCheckedChange={(checked) => toggleRequirementMutation.mutate({ reqId: req.id, data: { hasExpiry: checked } })}
                              disabled={req.isStandard && !req.orgId}
                              data-testid={`switch-expiry-${req.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="border-0">
                              {req.isStandard ? "Standard" : "Custom"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!req.isStandard && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRequirementMutation.mutate(req.id)}
                                disabled={deleteRequirementMutation.isPending}
                                data-testid={`button-delete-req-${req.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Verification Templates
                  </CardTitle>
                  <CardDescription>Create templates to quickly set up verification requests.</CardDescription>
                </div>
                <Button onClick={() => setAddTemplateDialogOpen(true)} data-testid="button-add-template">
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </CardHeader>
              <CardContent>
                {(!templates || templates.length === 0) ? (
                  <EmptyState
                    icon={Layers}
                    title="No templates"
                    description="Create verification templates to streamline request creation."
                  />
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Director Verification</TableHead>
                          <TableHead>Default</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.map((tmpl) => (
                          <TableRow key={tmpl.id} data-testid={`row-template-${tmpl.id}`}>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{tmpl.name}</p>
                                {tmpl.description && <p className="text-xs text-muted-foreground">{tmpl.description}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="border-0">{tmpl.type}</Badge>
                            </TableCell>
                            <TableCell>{tmpl.requireDirectorVerification ? "Yes" : "No"}</TableCell>
                            <TableCell>
                              {tmpl.isDefault && <Badge variant="secondary" className="border-0">Default</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTemplateMutation.mutate(tmpl.id)}
                                disabled={deleteTemplateMutation.isPending}
                                data-testid={`button-delete-template-${tmpl.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integration" className="space-y-4 mt-4">
            <IntegrationProfileTab
              orgId={orgId!}
              currentMode={integrationProfileMode}
              onModeChange={setIntegrationProfileMode}
              updateMutation={updateOrgMutation}
            />
          </TabsContent>

          <ApiKeysTab orgId={orgId!} />
          <WebhooksTab orgId={orgId!} />
          <BillingTab orgId={orgId!} />
        </Tabs>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation to join this organisation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org_admin">Admin</SelectItem>
                  <SelectItem value="org_reviewer">Reviewer</SelectItem>
                  <SelectItem value="org_viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole })}
              disabled={!inviteEmail || inviteMemberMutation.isPending}
              data-testid="button-send-invite"
            >
              {inviteMemberMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addReqDialogOpen} onOpenChange={setAddReqDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Requirement</DialogTitle>
            <DialogDescription>Create a custom document requirement for your organisation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input value={newReqName} onChange={(e) => setNewReqName(e.target.value)} placeholder="e.g. Professional Certificate" data-testid="input-req-name" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={newReqDesc} onChange={(e) => setNewReqDesc(e.target.value)} placeholder="Additional details..." data-testid="input-req-desc" />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newReqType} onValueChange={setNewReqType}>
                  <SelectTrigger data-testid="select-req-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newReqCategory} onValueChange={setNewReqCategory}>
                  <SelectTrigger data-testid="select-req-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="tax">Tax</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="identity">Identity</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>Mandatory</Label>
              <Switch checked={newReqMandatory} onCheckedChange={setNewReqMandatory} data-testid="switch-req-mandatory" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label>Has Expiry</Label>
              <Switch checked={newReqExpiry} onCheckedChange={setNewReqExpiry} data-testid="switch-req-expiry" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReqDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addRequirementMutation.mutate({
                type: newReqType,
                documentName: newReqName,
                documentDescription: newReqDesc || undefined,
                documentCategory: newReqCategory,
                isMandatory: newReqMandatory,
                hasExpiry: newReqExpiry,
              })}
              disabled={!newReqName || addRequirementMutation.isPending}
              data-testid="button-submit-requirement"
            >
              {addRequirementMutation.isPending ? "Adding..." : "Add Requirement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addTemplateDialogOpen} onOpenChange={setAddTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>Create a verification template for quick request setup.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={newTmplName} onChange={(e) => setNewTmplName(e.target.value)} placeholder="e.g. IT Vendor" data-testid="input-template-name" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newTmplType} onValueChange={setNewTmplType}>
                <SelectTrigger data-testid="select-template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={newTmplDesc} onChange={(e) => setNewTmplDesc(e.target.value)} placeholder="Template description..." data-testid="input-template-desc" />
            </div>
            {newTmplType === "supplier" && (
              <div className="flex items-center justify-between gap-4">
                <Label>Require Director Verification</Label>
                <Switch checked={newTmplDirectorVerification} onCheckedChange={setNewTmplDirectorVerification} data-testid="switch-director-verification" />
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <Label>Set as Default</Label>
              <Switch checked={newTmplDefault} onCheckedChange={setNewTmplDefault} data-testid="switch-template-default" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addTemplateMutation.mutate({
                name: newTmplName,
                type: newTmplType,
                description: newTmplDesc || undefined,
                requireDirectorVerification: newTmplDirectorVerification,
                isDefault: newTmplDefault,
              })}
              disabled={!newTmplName || addTemplateMutation.isPending}
              data-testid="button-submit-template"
            >
              {addTemplateMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(kobo: number): string {
  return `\u20A6${(kobo / 100).toLocaleString("en-NG")}`;
}

function ApiKeysTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["verify:individual", "verify:supplier"]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<number | null>(null);

  const { data: apiKeys, isLoading } = useQuery<KycApiKey[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "api-keys"],
  });

  const { data: usageStats } = useQuery<{ totalRequests: number; last24h: number; last7d: number; last30d: number }>({
    queryKey: ["/api/kyc-service/organisations", orgId, "api-usage"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { name: string; permissions: string[] }) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/api-keys`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setGeneratedKey(data.key);
      setShowKey(true);
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "api-keys"] });
      toast({ title: "API key generated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate key", description: error.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/api-keys/${keyId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "api-keys"] });
      setRevokeDialogOpen(false);
      setRevokeKeyId(null);
      toast({ title: "API key revoked" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to revoke key", description: error.message, variant: "destructive" });
    },
  });

  const availablePermissions = [
    { value: "verify:individual", label: "Individual Verification" },
    { value: "verify:supplier", label: "Supplier Verification" },
  ];

  function handleTogglePermission(perm: string) {
    setNewKeyPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  }

  function handleCopyKey() {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      toast({ title: "API key copied to clipboard" });
    }
  }

  function handleCloseGenerateDialog() {
    setGenerateDialogOpen(false);
    setNewKeyName("");
    setNewKeyPermissions(["verify:individual", "verify:supplier"]);
    setGeneratedKey(null);
    setShowKey(false);
  }

  return (
    <TabsContent value="api-keys" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys for programmatic access to KYC verification.</CardDescription>
          </div>
          <Button onClick={() => setGenerateDialogOpen(true)} data-testid="button-generate-api-key">
            <Plus className="h-4 w-4 mr-2" />
            Generate Key
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {usageStats && (
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-lg font-semibold" data-testid="text-usage-total">{usageStats.totalRequests}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Last 24h</p>
                <p className="text-lg font-semibold" data-testid="text-usage-24h">{usageStats.last24h}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Last 7 Days</p>
                <p className="text-lg font-semibold" data-testid="text-usage-7d">{usageStats.last7d}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Last 30 Days</p>
                <p className="text-lg font-semibold" data-testid="text-usage-30d">{usageStats.last30d}</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : !apiKeys?.length ? (
            <EmptyState icon={Key} title="No API keys" description="Generate an API key to start using the KYC verification API." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id} data-testid={`row-api-key-${key.id}`}>
                      <TableCell className="text-sm font-medium">{key.name}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">{key.keyPrefix}...</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(key.createdAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`border-0 ${key.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {key.isActive ? "Active" : "Revoked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {key.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setRevokeKeyId(key.id); setRevokeDialogOpen(true); }}
                            data-testid={`button-revoke-key-${key.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={generateDialogOpen} onOpenChange={(open) => { if (!open) handleCloseGenerateDialog(); else setGenerateDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{generatedKey ? "API Key Generated" : "Generate New API Key"}</DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "Copy your API key now. It will not be shown again."
                : "Create a new API key for programmatic access."}
            </DialogDescription>
          </DialogHeader>
          {generatedKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                <code className="flex-1 text-sm break-all" data-testid="text-generated-key">
                  {showKey ? generatedKey : generatedKey.slice(0, 12) + "•".repeat(20)}
                </code>
                <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)} data-testid="button-toggle-key-visibility">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCopyKey} data-testid="button-copy-key">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900/20">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  This key will only be displayed once. Store it securely.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production API" data-testid="input-api-key-name" />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="space-y-2">
                  {availablePermissions.map((perm) => (
                    <div key={perm.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={newKeyPermissions.includes(perm.value)}
                        onCheckedChange={() => handleTogglePermission(perm.value)}
                        data-testid={`checkbox-perm-${perm.value}`}
                      />
                      <Label className="text-sm font-normal">{perm.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {generatedKey ? (
              <Button onClick={handleCloseGenerateDialog} data-testid="button-close-key-dialog">Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseGenerateDialog}>Cancel</Button>
                <Button
                  onClick={() => generateMutation.mutate({ name: newKeyName, permissions: newKeyPermissions })}
                  disabled={!newKeyName || newKeyPermissions.length === 0 || generateMutation.isPending}
                  data-testid="button-confirm-generate-key"
                >
                  {generateMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>Are you sure you want to revoke this API key? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => revokeKeyId && revokeMutation.mutate(revokeKeyId)}
              disabled={revokeMutation.isPending}
              data-testid="button-confirm-revoke-key"
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

const WEBHOOK_EVENTS = [
  { value: "verification.completed", label: "Verification Completed" },
  { value: "verification.failed", label: "Verification Failed" },
  { value: "document.expiring", label: "Document Expiring (30 days)" },
  { value: "document.expired", label: "Document Expired" },
  { value: "verification.risk_updated", label: "Risk Score Updated" },
];

function WebhooksTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<any>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteWebhookId, setDeleteWebhookId] = useState<number | null>(null);
  const [viewLogsId, setViewLogsId] = useState<number | null>(null);

  const { data: webhooks, isLoading } = useQuery<Array<Omit<KycWebhookConfig, "secret"> & { secret?: string }>>({
    queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"],
  });

  const { data: deliveryLogs } = useQuery<KycWebhookDeliveryLog[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "webhooks", String(viewLogsId), "deliveries"],
    enabled: !!viewLogsId,
  });

  const addMutation = useMutation({
    mutationFn: async (data: { url: string; events: string[] }) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/webhooks`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"] });
      setAddDialogOpen(false);
      setNewWebhookUrl("");
      setNewWebhookEvents([]);
      toast({ title: "Webhook registered" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to register webhook", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/kyc-service/organisations/${orgId}/webhooks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"] });
      setEditDialogOpen(false);
      setEditWebhook(null);
      toast({ title: "Webhook updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update webhook", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/kyc-service/organisations/${orgId}/webhooks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "webhooks"] });
      setDeleteDialogOpen(false);
      setDeleteWebhookId(null);
      toast({ title: "Webhook deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete webhook", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (whId: number) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/webhooks/${whId}/test`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (viewLogsId) {
        queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "webhooks", String(viewLogsId), "deliveries"] });
      }
      toast({
        title: data.deliveredAt ? "Test event delivered" : "Test event failed to deliver",
        variant: data.deliveredAt ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send test", description: error.message, variant: "destructive" });
    },
  });

  function handleToggleEvent(event: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(event) ? list.filter(e => e !== event) : [...list, event]);
  }

  function openEditDialog(wh: any) {
    setEditWebhook({ ...wh });
    setEditDialogOpen(true);
  }

  return (
    <TabsContent value="webhooks" className="space-y-4 mt-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </CardTitle>
            <CardDescription>Receive real-time notifications when verification events occur.</CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-webhook">
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : !webhooks?.length ? (
            <EmptyState icon={Webhook} title="No webhooks" description="Register a webhook URL to receive verification event notifications." />
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="rounded-md border p-4 space-y-2" data-testid={`card-webhook-${wh.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-webhook-url-${wh.id}`}>{wh.url}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {(wh.events as string[] || []).map((ev) => (
                          <Badge key={ev} variant="secondary" className="border-0 text-xs">{ev}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className={`border-0 ${wh.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {wh.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => testMutation.mutate(wh.id)} disabled={testMutation.isPending} data-testid={`button-test-webhook-${wh.id}`}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(wh)} data-testid={`button-edit-webhook-${wh.id}`}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setViewLogsId(viewLogsId === wh.id ? null : wh.id)} data-testid={`button-logs-webhook-${wh.id}`}>
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleteWebhookId(wh.id); setDeleteDialogOpen(true); }} data-testid={`button-delete-webhook-${wh.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {viewLogsId === wh.id && (
                    <div className="mt-3 rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Attempts</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {!deliveryLogs?.length ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">No delivery logs</TableCell>
                            </TableRow>
                          ) : deliveryLogs.map((log) => (
                            <TableRow key={log.id} data-testid={`row-delivery-${log.id}`}>
                              <TableCell className="text-sm">{log.event}</TableCell>
                              <TableCell>
                                {log.deliveredAt ? (
                                  <Badge variant="secondary" className="border-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    {log.responseStatus}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="border-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                    {log.responseStatus || "Failed"}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{log.attempts}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>Register a URL to receive event notifications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Callback URL</Label>
              <Input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://your-app.com/webhooks/kyc" data-testid="input-webhook-url" />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((ev) => (
                  <div key={ev.value} className="flex items-center gap-2">
                    <Checkbox
                      checked={newWebhookEvents.includes(ev.value)}
                      onCheckedChange={() => handleToggleEvent(ev.value, newWebhookEvents, setNewWebhookEvents)}
                      data-testid={`checkbox-event-${ev.value}`}
                    />
                    <Label className="text-sm font-normal">{ev.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate({ url: newWebhookUrl, events: newWebhookEvents })}
              disabled={!newWebhookUrl || newWebhookEvents.length === 0 || addMutation.isPending}
              data-testid="button-confirm-add-webhook"
            >
              {addMutation.isPending ? "Adding..." : "Add Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update the webhook URL and event subscriptions.</DialogDescription>
          </DialogHeader>
          {editWebhook && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <Input value={editWebhook.url} onChange={(e) => setEditWebhook({ ...editWebhook, url: e.target.value })} data-testid="input-edit-webhook-url" />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="space-y-2">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <div key={ev.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={(editWebhook.events || []).includes(ev.value)}
                        onCheckedChange={() => setEditWebhook({ ...editWebhook, events: (editWebhook.events || []).includes(ev.value) ? editWebhook.events.filter((e: string) => e !== ev.value) : [...(editWebhook.events || []), ev.value] })}
                        data-testid={`checkbox-edit-event-${ev.value}`}
                      />
                      <Label className="text-sm font-normal">{ev.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label>Active</Label>
                <Switch checked={editWebhook.isActive} onCheckedChange={(checked) => setEditWebhook({ ...editWebhook, isActive: checked })} data-testid="switch-edit-webhook-active" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editWebhook && updateMutation.mutate({ id: editWebhook.id, data: { url: editWebhook.url, events: editWebhook.events, isActive: editWebhook.isActive } })}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit-webhook"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>Are you sure you want to delete this webhook? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteWebhookId && deleteMutation.mutate(deleteWebhookId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-webhook"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

function BillingTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseType, setPurchaseType] = useState("individual");
  const [purchaseQuantity, setPurchaseQuantity] = useState(10);
  const [requestInvoicedOpen, setRequestInvoicedOpen] = useState(false);
  const [reqCompanyName, setReqCompanyName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqVolume, setReqVolume] = useState("");
  const [reqMessage, setReqMessage] = useState("");

  const { data: billing, isLoading } = useQuery<KycBillingAccount>({
    queryKey: ["/api/kyc-service/organisations", orgId, "billing"],
  });

  const { data: transactions } = useQuery<KycCreditTransaction[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "billing", "transactions"],
  });

  const { data: invoices } = useQuery<KycInvoice[]>({
    queryKey: ["/api/kyc-service/organisations", orgId, "billing", "invoices"],
    enabled: billing?.billingMode === "invoiced",
  });

  const purchaseMutation = useMutation({
    mutationFn: async (data: { quantity: number; verificationType: string }) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/billing/purchase-credits`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      setPurchaseDialogOpen(false);
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        toast({ title: "Payment initiated" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Purchase failed", description: error.message, variant: "destructive" });
    },
  });

  const requestInvoicedMutation = useMutation({
    mutationFn: async (data: { companyName: string; email: string; estimatedMonthlyVolume: string; message: string }) => {
      const res = await apiRequest("POST", `/api/kyc-service/organisations/${orgId}/billing/request-invoiced`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc-service/organisations", orgId, "billing"] });
      setRequestInvoicedOpen(false);
      setReqCompanyName("");
      setReqEmail("");
      setReqVolume("");
      setReqMessage("");
      toast({ title: "Request submitted", description: "We'll review your request and get back to you." });
    },
    onError: (error: Error) => {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    },
  });

  const individualPrice = 1000000;
  const supplierPrice = 10000000;

  function getPurchaseTotal(): number {
    const unitPrice = purchaseType === "supplier" ? supplierPrice : individualPrice;
    return unitPrice * purchaseQuantity;
  }

  if (isLoading) {
    return (
      <TabsContent value="billing" className="space-y-4 mt-4">
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="billing" className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing Overview
          </CardTitle>
          <CardDescription>Manage your billing account and purchase verification credits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Billing Mode</p>
              <p className="text-lg font-semibold capitalize" data-testid="text-billing-mode">{billing?.billingMode || "prepaid"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Credit Balance</p>
              <p className="text-lg font-semibold" data-testid="text-credit-balance">{billing?.creditBalance ?? 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="secondary" className={`border-0 mt-1 ${billing?.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`} data-testid="text-billing-status">
                {billing?.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {billing?.billingMode === "invoiced" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Credit Limit</p>
                <p className="text-lg font-semibold" data-testid="text-credit-limit">{billing.creditLimit ?? "Unlimited"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Payment Terms</p>
                <p className="text-lg font-semibold">{billing.paymentTermsDays ?? 30} days</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {billing?.billingMode === "prepaid" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0">
            <div>
              <CardTitle className="text-base">Purchase Credits</CardTitle>
              <CardDescription>Buy verification credits to use with the API. Minimum 10 credits per purchase.</CardDescription>
            </div>
            <Button onClick={() => setPurchaseDialogOpen(true)} data-testid="button-buy-credits">
              <CreditCard className="h-4 w-4 mr-2" />
              Buy Credits
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-sm font-medium">Individual Verification</p>
                <p className="text-lg font-semibold">{formatCurrency(individualPrice)}</p>
                <p className="text-xs text-muted-foreground">per credit</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-sm font-medium">Supplier Verification</p>
                <p className="text-lg font-semibold">{formatCurrency(supplierPrice)}</p>
                <p className="text-xs text-muted-foreground">per credit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {billing?.billingMode !== "invoiced" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoiced Billing</CardTitle>
            <CardDescription>For established organisations with high-volume verification needs.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Invoiced billing allows you to verify at scale and pay monthly based on usage. Contact us to apply.
            </p>
            <Button variant="outline" onClick={() => setRequestInvoicedOpen(true)} data-testid="button-request-invoiced">
              Contact Us for Invoiced Billing
            </Button>
          </CardContent>
        </Card>
      )}

      {billing?.billingMode === "invoiced" && invoices && invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
            <CardDescription>Your billing invoices and payment status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                      <TableCell className="text-sm font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.periodStart)} - {formatDate(inv.periodEnd)}</TableCell>
                      <TableCell className="text-sm">{formatCurrency(inv.total)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`border-0 ${
                          inv.status === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          inv.status === "overdue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
          <CardDescription>Recent credit transactions for your billing account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!transactions?.length ? (
            <EmptyState icon={CreditCard} title="No transactions" description="Credit transactions will appear here once you start using the API." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                      <TableCell>
                        <Badge variant="secondary" className={`border-0 ${
                          tx.type === "purchase" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          tx.type === "usage" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          tx.type === "refund" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          ""
                        }`}>
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-sm font-medium ${tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </TableCell>
                      <TableCell className="text-sm">{tx.balance}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{tx.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(tx.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Credits</DialogTitle>
            <DialogDescription>Buy verification credits. Minimum 10 credits per purchase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Type</Label>
              <Select value={purchaseType} onValueChange={setPurchaseType}>
                <SelectTrigger data-testid="select-purchase-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual ({formatCurrency(individualPrice)}/credit)</SelectItem>
                  <SelectItem value="supplier">Supplier ({formatCurrency(supplierPrice)}/credit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity (min. 10)</Label>
              <Input
                type="number"
                min={10}
                value={purchaseQuantity}
                onChange={(e) => setPurchaseQuantity(Math.max(10, parseInt(e.target.value) || 10))}
                data-testid="input-purchase-quantity"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-bold" data-testid="text-purchase-total">{formatCurrency(getPurchaseTotal())}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {purchaseQuantity} {purchaseType} verification credit{purchaseQuantity !== 1 ? "s" : ""} = {formatCurrency(getPurchaseTotal())}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => purchaseMutation.mutate({ quantity: purchaseQuantity, verificationType: purchaseType })}
              disabled={purchaseQuantity < 10 || purchaseMutation.isPending}
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending ? "Processing..." : "Proceed to Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestInvoicedOpen} onOpenChange={setRequestInvoicedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Invoiced Billing</DialogTitle>
            <DialogDescription>Tell us about your organisation and verification needs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={reqCompanyName} onChange={(e) => setReqCompanyName(e.target.value)} placeholder="Your company name" data-testid="input-req-company-name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} placeholder="billing@company.com" data-testid="input-req-email" />
            </div>
            <div className="space-y-2">
              <Label>Estimated Monthly Volume</Label>
              <Input value={reqVolume} onChange={(e) => setReqVolume(e.target.value)} placeholder="e.g. 500 verifications/month" data-testid="input-req-volume" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} placeholder="Tell us about your verification needs..." data-testid="input-req-message" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestInvoicedOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requestInvoicedMutation.mutate({
                companyName: reqCompanyName,
                email: reqEmail,
                estimatedMonthlyVolume: reqVolume,
                message: reqMessage,
              })}
              disabled={!reqCompanyName || !reqEmail || !reqVolume || requestInvoicedMutation.isPending}
              data-testid="button-confirm-request-invoiced"
            >
              {requestInvoicedMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

function IntegrationProfileTab({
  orgId,
  currentMode,
  onModeChange,
  updateMutation,
}: {
  orgId: string;
  currentMode: "full_hosted" | "prefill_selfie" | "selfie_only" | null;
  onModeChange: (mode: "full_hosted" | "prefill_selfie" | "selfie_only") => void;
  updateMutation: any;
}) {
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState<"full_hosted" | "prefill_selfie" | "selfie_only" | null>(currentMode);

  const profiles: {
    mode: "full_hosted" | "prefill_selfie" | "selfie_only";
    label: string;
    description: string;
    steps: string[];
    timing: string;
    icon: any;
    timingColor: string;
  }[] = [
    {
      mode: "full_hosted",
      label: "Full Hosted",
      description: "Your customer provides everything: name, date of birth, ID document photo, and a liveness selfie. Best for onboarding flows where you have no prior data.",
      steps: ["Identity details", "ID document upload", "Liveness selfie"],
      timing: "~2–5 minutes",
      timingColor: "text-amber-600 dark:text-amber-400",
      icon: Layers,
    },
    {
      mode: "prefill_selfie",
      label: "Prefill + Selfie",
      description: "Your system prefills the subject's name and date of birth. The subject only needs to upload their ID document and take a liveness selfie.",
      steps: ["ID document upload", "Liveness selfie"],
      timing: "~1–2 minutes",
      timingColor: "text-blue-600 dark:text-blue-400",
      icon: ScanFace,
    },
    {
      mode: "selfie_only",
      label: "Selfie Only",
      description: "Your system has all the subject's document data. The subject only takes a liveness selfie for biometric matching. Fastest experience.",
      steps: ["Liveness selfie only"],
      timing: "~30 seconds",
      timingColor: "text-green-600 dark:text-green-400",
      icon: Camera,
    },
  ];

  function handleSave() {
    if (!selectedMode) return;
    updateMutation.mutate(
      {
        integrationProfile: {
          mode: selectedMode,
          configuredAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          onModeChange(selectedMode);
          toast({ title: "Integration profile saved", description: "Your hosted session wizard will now adapt to this profile." });
        },
        onError: (error: Error) => {
          toast({ title: "Save failed", description: error.message, variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Integration Profile
          </CardTitle>
          <CardDescription>
            Choose how much data your system provides when creating a hosted verification session.
            This controls which steps the subject sees in the verification wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentMode && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm text-primary font-medium">
                Current profile: <span className="capitalize">{profiles.find(p => p.mode === currentMode)?.label ?? currentMode.replace(/_/g, " ")}</span>
              </p>
            </div>
          )}

          <div className="grid gap-3">
            {profiles.map((profile) => {
              const Icon = profile.icon;
              const isSelected = selectedMode === profile.mode;
              return (
                <div
                  key={profile.mode}
                  onClick={() => setSelectedMode(profile.mode)}
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}
                  data-testid={`card-profile-${profile.mode}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{profile.label}</p>
                        {isSelected && (
                          <Badge variant="default" className="text-xs" data-testid={`badge-profile-selected-${profile.mode}`}>Selected</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{profile.description}</p>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Timer className={`h-3 w-3 ${profile.timingColor}`} />
                          <span className={`text-xs font-medium ${profile.timingColor}`}>{profile.timing}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {profile.steps.map((step) => (
                            <span key={step} className="text-xs bg-muted px-2 py-0.5 rounded-full">{step}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 mb-4">
              <Zap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How it works with the API</p>
                <p>When you create a session via the API, you can pass a <code className="bg-muted px-1 py-0.5 rounded text-xs">prefill</code> object and this profile determines which wizard steps the subject sees. You can also override <code className="bg-muted px-1 py-0.5 rounded text-xs">requiredSteps</code> on a per-session basis.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!selectedMode || selectedMode === currentMode || updateMutation.isPending}
                data-testid="button-save-integration-profile"
              >
                {updateMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
