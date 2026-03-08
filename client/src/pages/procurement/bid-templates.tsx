import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  BookTemplate,
  Plus,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import type { BidTemplate } from "@shared/schema";

export default function BidTemplatesPage() {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BidTemplate | null>(null);
  const [name, setName] = useState("");
  const [coverLetterTemplate, setCoverLetterTemplate] = useState("");
  const [termsTemplate, setTermsTemplate] = useState("");

  const { data: orgs } = useQuery<any[]>({
    queryKey: ["/api/kyc-service/organisations"],
  });

  const { data: templates, isLoading } = useQuery<BidTemplate[]>({
    queryKey: ["/api/procurement/bid-templates", `orgId=${selectedOrgId}`],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const res = await fetch(`/api/procurement/bid-templates?orgId=${selectedOrgId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/procurement/bid-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/bid-templates"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Template created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create template", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/procurement/bid-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/bid-templates"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Template updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update template", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/procurement/bid-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/bid-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete template", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setName("");
    setCoverLetterTemplate("");
    setTermsTemplate("");
    setEditingTemplate(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(template: BidTemplate) {
    setEditingTemplate(template);
    setName(template.name);
    setCoverLetterTemplate(template.coverLetterTemplate || "");
    setTermsTemplate(template.termsTemplate || "");
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: { name, coverLetterTemplate, termsTemplate },
      });
    } else {
      createMutation.mutate({
        orgId: parseInt(selectedOrgId),
        name,
        coverLetterTemplate,
        termsTemplate,
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout role="founder" breadcrumbs={[{ label: "Procurement" }, { label: "Bid Templates" }]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Bid Templates</h1>
            <p className="text-muted-foreground text-sm">Create reusable templates for faster bid submission</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-[200px]" data-testid="select-org">
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs?.map((org: any) => (
                  <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} disabled={!selectedOrgId} data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>

        {!selectedOrgId ? (
          <EmptyState
            icon={BookTemplate}
            title="Select an organisation"
            description="Choose an organisation to view and manage bid templates."
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : !templates || templates.length === 0 ? (
          <EmptyState
            icon={BookTemplate}
            title="No templates yet"
            description="Create your first bid template to speed up future bid submissions."
            action={
              <Button onClick={openCreate} data-testid="button-empty-create">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base" data-testid={`text-template-name-${template.id}`}>{template.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(template.createdAt!).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {template.coverLetterTemplate && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.coverLetterTemplate}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(template)} data-testid={`button-edit-${template.id}`}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(template.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${template.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
              <DialogDescription>
                {editingTemplate ? "Update your bid template details." : "Create a reusable bid template for faster submissions."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Standard IT Services Bid"
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Cover Letter Template</Label>
                <Textarea
                  value={coverLetterTemplate}
                  onChange={(e) => setCoverLetterTemplate(e.target.value)}
                  placeholder="Default cover letter text..."
                  className="min-h-[120px]"
                  data-testid="input-cover-letter-template"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Terms</Label>
                <Textarea
                  value={termsTemplate}
                  onChange={(e) => setTermsTemplate(e.target.value)}
                  placeholder="Default terms and conditions..."
                  className="min-h-[80px]"
                  data-testid="input-terms-template"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!name || isPending}
                data-testid="button-submit-template"
              >
                {isPending ? "Saving..." : editingTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
