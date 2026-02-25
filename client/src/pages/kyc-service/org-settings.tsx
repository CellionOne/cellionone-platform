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
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  Settings,
  Plus,
  Trash2,
  UserPlus,
  Layers,
} from "lucide-react";
import type { KycOrganisation, KycOrgMember, KycDocumentRequirement, KycVerificationTemplate } from "@shared/schema";

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
          <TabsList data-testid="tabs-settings">
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
            <TabsTrigger value="requirements" data-testid="tab-requirements">Documents</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
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
