import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner, LoadingPage } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
  Shield,
  FileCheck,
  Send,
  Sparkles,
  ArrowLeft,
  Eye,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from "lucide-react";
import type { 
  CompanyApplication, 
  ApplicationChecklistItem, 
  Payment, 
  ClarificationRequest,
  ExecutionDeclaration,
  DocumentFile,
} from "@shared/schema";
import { insertClarificationRequestSchema } from "@shared/schema";

interface ApplicationDetailData {
  application: CompanyApplication;
  checklist: ApplicationChecklistItem[];
  payment: Payment | null;
  clarifications: ClarificationRequest[];
  documents: DocumentFile[];
}

export default function LawyerApplicationDetail() {
  const [, params] = useRoute("/lawyer/applications/:id");
  const { toast } = useToast();
  const applicationId = params?.id;
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, error } = useQuery<ApplicationDetailData>({
    queryKey: ["/api/applications", applicationId],
    enabled: !!applicationId,
  });

  const { data: declarations } = useQuery<ExecutionDeclaration[]>({
    queryKey: ["/api/applications", applicationId, "execution-declarations"],
    enabled: !!applicationId,
  });

  if (isLoading) return <LoadingPage />;

  if (error) {
    return (
      <DashboardLayout role="lawyer" breadcrumbs={[{ label: "Error" }]}>
        <div className="text-center py-12" data-testid="error-state">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Failed to load application</h2>
          <p className="text-muted-foreground mt-2">Please try again later</p>
          <Button variant="ghost" asChild className="mt-4" data-testid="btn-back-error">
            <Link href="/lawyer/applications">Back to Cases</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.application) {
    return (
      <DashboardLayout role="lawyer" breadcrumbs={[{ label: "Application Not Found" }]}>
        <div className="text-center py-12" data-testid="not-found-state">
          <h2 className="text-xl font-semibold">Application not found</h2>
          <Button variant="ghost" asChild className="mt-4" data-testid="btn-back-notfound">
            <Link href="/lawyer/applications">Back to Cases</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { application, checklist, payment, clarifications, documents } = data;

  return (
    <DashboardLayout 
      role="lawyer" 
      breadcrumbs={[
        { label: "Dashboard", href: "/lawyer/dashboard" },
        { label: "Assigned Cases", href: "/lawyer/applications" },
        { label: application.companyName1 || "Application" }
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="btn-back">
            <Link href="/lawyer/applications">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex flex-1 flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{application.companyName1 || "Untitled Application"}</h1>
                <p className="text-muted-foreground">
                  {application.applicationType === "incorporation" ? "Company Incorporation" : "Post-Incorporation"} 
                  {" "}&bull;{" "}
                  Application #{application.id}
                </p>
              </div>
            </div>
            <StatusBadge status={application.status || "draft"} className="text-sm" />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-container">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Eye className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="clarifications" data-testid="tab-clarifications">
              <MessageSquare className="h-4 w-4 mr-2" />
              Clarifications
              {clarifications.filter(c => c.status === "pending").length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {clarifications.filter(c => c.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="execution" data-testid="tab-execution">
              <Shield className="h-4 w-4 mr-2" />
              Execution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <OverviewTab 
              application={application} 
              checklist={checklist} 
              payment={payment} 
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-6">
            <DocumentsTab 
              applicationId={parseInt(applicationId!)} 
              checklist={checklist}
              documents={documents || []}
            />
          </TabsContent>

          <TabsContent value="clarifications" className="space-y-6 mt-6">
            <ClarificationsTab 
              applicationId={parseInt(applicationId!)}
              clarifications={clarifications}
            />
          </TabsContent>

          <TabsContent value="execution" className="space-y-6 mt-6">
            <ExecutionTab 
              applicationId={parseInt(applicationId!)}
              declarations={declarations || []}
              application={application}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function OverviewTab({ 
  application, 
  checklist, 
  payment 
}: { 
  application: CompanyApplication; 
  checklist: ApplicationChecklistItem[];
  payment: Payment | null;
}) {
  const completedDocs = checklist.filter(item => item.status === "provided" || item.status === "accepted").length;
  const totalDocs = checklist.length;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label className="text-muted-foreground text-sm">Company Name</Label>
              <p className="font-medium">{application.companyName1 || "—"}</p>
            </div>
            {application.companyName2 && (
              <div>
                <Label className="text-muted-foreground text-sm">Alternative Name</Label>
                <p className="font-medium">{application.companyName2}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground text-sm">Company Type</Label>
              <p className="font-medium">{application.companyType || "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Business Description</Label>
              <p className="font-medium">{application.businessDescription || "—"}</p>
            </div>
            {application.selectedActivities && application.selectedActivities.length > 0 && (
              <div>
                <Label className="text-muted-foreground text-sm">CAC Activities</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {application.selectedActivities.map((activity: string, i: number) => (
                    <Badge key={i} variant="secondary">{activity}</Badge>
                  ))}
                </div>
              </div>
            )}
            {application.registeredAddress && (
              <div>
                <Label className="text-muted-foreground text-sm">Registered Address</Label>
                <p className="font-medium">
                  {[
                    application.registeredAddress.line1,
                    application.registeredAddress.line2,
                    application.registeredAddress.city,
                    application.registeredAddress.state,
                    application.registeredAddress.postalCode
                  ].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Document Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground">{completedDocs} of {totalDocs} uploaded</span>
              <Badge variant={completedDocs === totalDocs ? "default" : "secondary"}>
                {completedDocs === totalDocs ? "Complete" : "In Progress"}
              </Badge>
            </div>
            <div className="space-y-2">
              {checklist.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{item.label}</span>
                  <StatusBadge status={item.status || "missing"} />
                </div>
              ))}
              {checklist.length > 5 && (
                <p className="text-sm text-muted-foreground">
                  +{checklist.length - 5} more documents
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {payment ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={payment.status || "initialized"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">
                    ₦{((payment.amountTotalKobo || 0) / 100).toLocaleString()}
                  </span>
                </div>
                {payment.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Paid On</span>
                    <span>{new Date(payment.paidAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No payment recorded yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DocumentDownloadResponse {
  id: number;
  filename: string;
  downloadUrl: string | null;
  docType: string;
  category: string;
  sha256Hash: string | null;
  storageConfigured: boolean;
}

function DocumentFileDetails({ 
  docFile, 
  checklistItemId 
}: { 
  docFile: DocumentFile; 
  checklistItemId: number;
}) {
  const { toast } = useToast();
  const [downloadData, setDownloadData] = useState<DocumentDownloadResponse | null>(null);
  
  const downloadMutation = useMutation({
    mutationFn: async (): Promise<DocumentDownloadResponse> => {
      return apiRequest("GET", `/api/documents/${docFile.id}/download`);
    },
    onSuccess: (data) => {
      setDownloadData(data);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        toast({
          title: "Document Verified",
          description: "File metadata verified. File storage pending configuration.",
        });
      }
    },
  });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">File Details</p>
      <div className="text-sm space-y-1">
        <p><span className="font-medium">Filename:</span> {docFile.filename}</p>
        <p><span className="font-medium">Type:</span> {docFile.docType}</p>
        <p><span className="font-medium">Category:</span> {docFile.category}</p>
        {docFile.sha256Hash && (
          <p className="text-xs text-muted-foreground break-all">
            <span className="font-medium">Verification Hash:</span> {docFile.sha256Hash}
          </p>
        )}
      </div>
      <div className="pt-2 space-y-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          data-testid={`btn-view-document-${checklistItemId}`}
        >
          {downloadMutation.isPending ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              View Document
            </>
          )}
        </Button>
        {downloadMutation.isError && (
          <p className="text-xs text-destructive">
            Failed to access document. Please try again.
          </p>
        )}
        {downloadData && !downloadData.downloadUrl && (
          <p className="text-xs text-muted-foreground">
            Document record verified. File storage integration pending.
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentsTab({ 
  applicationId, 
  checklist,
  documents 
}: { 
  applicationId: number;
  checklist: ApplicationChecklistItem[];
  documents: DocumentFile[];
}) {
  const { toast } = useToast();
  const [selectedDoc, setSelectedDoc] = useState<ApplicationChecklistItem | null>(null);
  const [qualityStatus, setQualityStatus] = useState<string>("");
  const [qualityNotes, setQualityNotes] = useState("");

  const getDocumentFile = (checklistItem: ApplicationChecklistItem): DocumentFile | undefined => {
    return documents.find(doc => doc.docType === checklistItem.key);
  };

  const qualityMutation = useMutation({
    mutationFn: async ({ docId, status, notes }: { docId: number; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/lawyer/documents/${docId}/quality`, {
        qualityStatus: status,
        qualityNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Quality status updated" });
      setSelectedDoc(null);
      setQualityStatus("");
      setQualityNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to update quality", description: error.message, variant: "destructive" });
    },
  });

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case "accepted": return <ThumbsUp className="h-4 w-4 text-green-600" />;
      case "provided": return <Clock className="h-4 w-4 text-blue-600" />;
      case "rejected": return <ThumbsDown className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Document Quality Review</CardTitle>
        <CardDescription>
          Review uploaded documents and mark quality status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {checklist.map((item) => (
            <div key={item.id} className="py-4 flex items-center justify-between gap-4" data-testid={`doc-row-${item.id}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  item.status === "accepted" ? "bg-green-100 dark:bg-green-900/30" :
                  item.status === "provided" ? "bg-blue-100 dark:bg-blue-900/30" :
                  item.status === "rejected" ? "bg-red-100 dark:bg-red-900/30" :
                  "bg-muted"
                }`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={item.status || "missing"} />
                    {item.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {getStatusIcon(item.status)}
                
                {item.status === "provided" || item.status === "accepted" ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDoc(item);
                          setQualityStatus("");
                          setQualityNotes(item.reviewerNotes || "");
                        }}
                        data-testid={`btn-review-${item.id}`}
                      >
                        Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Review Document</DialogTitle>
                        <DialogDescription>
                          {item.label}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {(() => {
                          const docFile = getDocumentFile(item);
                          return (
                            <div className="p-3 rounded-md bg-muted/50 border space-y-3">
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Document Status</p>
                                <StatusBadge status={item.status || "missing"} />
                              </div>
                              {docFile ? (
                                <DocumentFileDetails 
                                  docFile={docFile} 
                                  checklistItemId={item.id!}
                                />
                              ) : (
                                <p className="text-sm text-muted-foreground">No file uploaded yet</p>
                              )}
                            </div>
                          );
                        })()}
                        <div className="space-y-2">
                          <Label>Quality Status</Label>
                          <Select value={qualityStatus} onValueChange={setQualityStatus}>
                            <SelectTrigger data-testid="select-quality">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass" data-testid="option-pass">
                                <span className="flex items-center gap-2">
                                  <ThumbsUp className="h-4 w-4 text-green-600" />
                                  Pass - Document acceptable
                                </span>
                              </SelectItem>
                              <SelectItem value="needs_attention" data-testid="option-needs-attention">
                                <span className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                  Needs Attention - Minor issues
                                </span>
                              </SelectItem>
                              <SelectItem value="rejected" data-testid="option-rejected">
                                <span className="flex items-center gap-2">
                                  <ThumbsDown className="h-4 w-4 text-red-600" />
                                  Rejected - Must re-upload
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes (optional)</Label>
                          <Textarea
                            placeholder="Add notes about document quality..."
                            value={qualityNotes}
                            onChange={(e) => setQualityNotes(e.target.value)}
                            data-testid="input-quality-notes"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => {
                            if (item.id && qualityStatus) {
                              qualityMutation.mutate({
                                docId: item.id,
                                status: qualityStatus,
                                notes: qualityNotes,
                              });
                            }
                          }}
                          disabled={!qualityStatus || qualityMutation.isPending}
                          data-testid="btn-save-quality"
                        >
                          {qualityMutation.isPending ? <LoadingSpinner size="sm" /> : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <span className="text-sm text-muted-foreground">Not uploaded</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const clarificationFormSchema = insertClarificationRequestSchema
  .pick({ subject: true, message: true })
  .extend({
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(1, "Message is required"),
    useAiDraft: z.boolean().default(false),
    aiContext: z.string().optional(),
  });

type ClarificationFormValues = z.infer<typeof clarificationFormSchema>;

function ClarificationsTab({ 
  applicationId,
  clarifications,
}: { 
  applicationId: number;
  clarifications: ClarificationRequest[];
}) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const form = useForm<ClarificationFormValues>({
    resolver: zodResolver(clarificationFormSchema),
    defaultValues: {
      subject: "",
      message: "",
      useAiDraft: false,
      aiContext: "",
    },
  });

  const useAiDraft = form.watch("useAiDraft");
  const aiContext = form.watch("aiContext");

  const generateAiDraft = async () => {
    const context = form.getValues("aiContext");
    if (!context) return;
    
    setIsGeneratingAi(true);
    try {
      const response = await fetch(`/api/lawyer/applications/${applicationId}/clarifications/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ context }),
      });
      if (!response.ok) throw new Error("Failed to generate draft");
      const data = await response.json();
      form.setValue("subject", data.subject || "");
      form.setValue("message", data.message || "");
      toast({ title: "AI draft generated", description: "Review and edit as needed" });
    } catch {
      toast({ title: "Failed to generate draft", variant: "destructive" });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: ClarificationFormValues) => {
      return apiRequest("POST", `/api/lawyer/applications/${applicationId}/clarifications`, {
        subject: values.subject,
        message: values.message,
        useAiDraft: values.useAiDraft,
        aiContext: values.useAiDraft ? values.aiContext : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Clarification created" });
      setIsCreating(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create clarification", description: error.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (clarificationId: number) => {
      return apiRequest("POST", `/api/lawyer/clarifications/${clarificationId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Clarification sent to founder" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (clarificationId: number) => {
      return apiRequest("POST", `/api/lawyer/clarifications/${clarificationId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString()] });
      toast({ title: "Clarification resolved" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to resolve", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: ClarificationFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold" data-testid="text-clarifications-title">Clarification Requests</h3>
          <p className="text-sm text-muted-foreground">Request additional information from the founder</p>
        </div>
        <Button onClick={() => setIsCreating(true)} data-testid="btn-new-clarification">
          <MessageSquare className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {isCreating && (
        <Card data-testid="card-create-clarification">
          <CardHeader>
            <CardTitle className="text-base">Create Clarification Request</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="useAiDraft"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-use-ai"
                        />
                      </FormControl>
                      <FormLabel className="flex items-center gap-2 cursor-pointer !mt-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Use AI to help draft this request
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {useAiDraft && (
                  <FormField
                    control={form.control}
                    name="aiContext"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Describe what you need clarification on</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., The passport scan is blurry and I need a clearer copy..."
                            {...field}
                            data-testid="input-ai-context"
                          />
                        </FormControl>
                        <FormMessage />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateAiDraft}
                          disabled={!aiContext || isGeneratingAi}
                          data-testid="btn-generate-ai"
                        >
                          {isGeneratingAi ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Draft
                            </>
                          )}
                        </Button>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brief subject of your request"
                          {...field}
                          data-testid="input-subject"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed explanation of what information is needed..."
                          rows={4}
                          {...field}
                          data-testid="input-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="btn-create-clarification"
                  >
                    {createMutation.isPending ? <LoadingSpinner size="sm" /> : "Create Request"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsCreating(false);
                      form.reset();
                    }}
                    data-testid="btn-cancel-clarification"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {clarifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No clarification requests yet</p>
            </CardContent>
          </Card>
        ) : (
          clarifications.map((req) => (
            <Card key={req.id} data-testid={`clarification-${req.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{req.subject}</CardTitle>
                    <CardDescription>
                      Created {new Date(req.createdAt!).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <StatusBadge status={req.status || "draft"} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{req.message}</p>

                <div className="flex gap-2 mt-4">
                  {req.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => sendMutation.mutate(req.id)}
                      disabled={sendMutation.isPending}
                      data-testid={`btn-send-${req.id}`}
                    >
                      {sendMutation.isPending ? <LoadingSpinner size="sm" /> : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          Send to Founder
                        </>
                      )}
                    </Button>
                  )}
                  {req.status === "responded" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate(req.id)}
                      disabled={resolveMutation.isPending}
                      data-testid={`btn-resolve-${req.id}`}
                    >
                      {resolveMutation.isPending ? <LoadingSpinner size="sm" /> : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark Resolved
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function ExecutionTab({ 
  applicationId,
  declarations,
  application,
}: { 
  applicationId: number;
  declarations: ExecutionDeclaration[];
  application: CompanyApplication;
}) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [declarationType, setDeclarationType] = useState<string>("");

  const createDeclaration = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/lawyer/applications/${applicationId}/execution-declaration`, {
        declarationType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId.toString(), "execution-declarations"] });
      toast({ title: "Declaration signed successfully" });
      setIsDialogOpen(false);
      setDeclarationType("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to sign declaration", description: error.message, variant: "destructive" });
    },
  });

  const canSign = application.status === "under_review" || application.status === "submitted";

  const declarationLabels: Record<string, string> = {
    document_verified: "I have verified all submitted documents are authentic and complete.",
    application_reviewed: "I have reviewed the application and confirm it meets all CAC requirements.",
    cac_filed: "I have filed this application with the Corporate Affairs Commission.",
    originals_received: "I have received the stamped original documents from CAC.",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Execution Declarations</h3>
          <p className="text-sm text-muted-foreground">Chain-of-custody tracking for document submissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canSign} data-testid="btn-sign-declaration">
              <Shield className="h-4 w-4 mr-2" />
              Sign Declaration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sign Execution Declaration</DialogTitle>
              <DialogDescription>
                This declaration confirms your role in preparing and submitting this application.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Declaration Type</Label>
                <Select value={declarationType} onValueChange={setDeclarationType}>
                  <SelectTrigger data-testid="select-declaration-type">
                    <SelectValue placeholder="Select declaration type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document_verified">Documents Verified</SelectItem>
                    <SelectItem value="application_reviewed">Application Reviewed</SelectItem>
                    <SelectItem value="cac_filed">Filed with CAC</SelectItem>
                    <SelectItem value="originals_received">Originals Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {declarationType && (
                <div className="space-y-2">
                  <Label>Declaration Statement</Label>
                  <div className="p-4 rounded-lg bg-muted text-sm leading-relaxed">
                    {declarationLabels[declarationType]}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">
                  By signing this declaration, you confirm that you have reviewed all documents and 
                  take responsibility for the accuracy of this submission.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createDeclaration.mutate()}
                disabled={!declarationType || createDeclaration.isPending}
                data-testid="btn-confirm-sign"
              >
                {createDeclaration.isPending ? <LoadingSpinner size="sm" /> : "Sign Declaration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!canSign && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm">
                Execution declarations can only be signed when the application is under review.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {declarations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No declarations signed yet</p>
            </CardContent>
          </Card>
        ) : (
          declarations.map((dec) => (
            <Card key={dec.id} data-testid={`declaration-${dec.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      {dec.submissionType === "digital" ? "Digital" : "Physical"} Submission Declaration
                    </CardTitle>
                    <CardDescription>
                      Signed on {new Date(dec.createdAt!).toLocaleDateString()} at {new Date(dec.createdAt!).toLocaleTimeString()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dec.submissionLocation && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Location</Label>
                      <p className="font-medium">{dec.submissionLocation}</p>
                    </div>
                  )}
                  {dec.notes && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Notes</Label>
                      <p className="text-sm mt-1 p-3 rounded-lg bg-muted">{dec.notes}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {dec.declarationAccepted && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        Declaration Accepted
                      </span>
                    )}
                    {dec.declarationTextVersion && (
                      <span>Version: {dec.declarationTextVersion}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
