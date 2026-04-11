import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { ReceiptsList } from "@/components/receipts-list";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FolderOpen,
  FileText,
  Download,
  Building2,
  Shield,
  FileCheck,
  Receipt,
  Upload,
  CheckCircle2,
  Loader2,
  Landmark,
} from "lucide-react";
import type { DocumentFile, CompanyApplication, ProfileChecklistItem } from "@shared/schema";

interface CompanyDocumentGroup {
  profileId: number;
  companyName: string;
  status: string | null;
  items: ProfileChecklistItem[];
}

interface VaultData {
  applications: CompanyApplication[];
  documents: DocumentFile[];
  companyDocuments: CompanyDocumentGroup[];
}

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  identity: { label: "Identity Documents", icon: Shield },
  company: { label: "Company Documents", icon: Building2 },
  filing: { label: "Filing Documents", icon: FileText },
  stamped_originals: { label: "Stamped Originals", icon: FileCheck },
  courier: { label: "Courier Documents", icon: FileText },
};

const STANDARD_VAULT_DOCS: { key: string; label: string; hint: string }[] = [
  { key: "coi", label: "Certificate of Incorporation", hint: "PDF, JPG, or PNG — up to 10 MB" },
  { key: "memat", label: "Memorandum & Articles of Association (MEMART)", hint: "PDF — up to 10 MB" },
  { key: "cac_status", label: "CAC Status Report (CAC 1.1 / CAC 7 / BN-01)", hint: "PDF — up to 10 MB" },
  { key: "tin_cert", label: "TIN Certificate", hint: "PDF, JPG, or PNG — up to 10 MB" },
  { key: "proof_address", label: "Proof of Operating Address (Utility Bill / Tenancy Agreement)", hint: "PDF, JPG, or PNG — up to 10 MB" },
  { key: "director_id", label: "Director Government-Issued ID", hint: "PDF, JPG, or PNG — up to 10 MB" },
];

function CompanyDocumentsSection({ group }: { group: CompanyDocumentGroup }) {
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async ({ docKey, file }: { docKey: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docKey", docKey);
      const res = await fetch(`/api/founder/company-profiles/${group.profileId}/documents/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/vault"] });
      toast({ title: "Document uploaded", description: "Your document has been saved to the vault." });
      setUploadingKey(null);
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setUploadingKey(null);
    },
  });

  const handleFileSelect = (docKey: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKey(docKey);
    uploadMutation.mutate({ docKey, file });
  };

  const itemsByKey = Object.fromEntries(group.items.map(i => [i.key, i]));
  const isVerified = group.status === "verified";

  return (
    <Card data-testid={`card-company-docs-${group.profileId}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{group.companyName}</CardTitle>
          </div>
          <Badge variant={isVerified ? "default" : "secondary"} className={isVerified ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300" : ""}>
            {isVerified ? "Verified" : group.status ?? "In Review"}
          </Badge>
        </div>
        <CardDescription>
          Upload the standard bank KYC documents for this company. These documents are shared with the bank when you request corporate account opening.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {STANDARD_VAULT_DOCS.map(({ key, label, hint }) => {
            const item = itemsByKey[key];
            const isUploaded = item?.status === "provided" && !!item.filePath;
            const isUploading = uploadingKey === key && uploadMutation.isPending;

            return (
              <div
                key={key}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3"
                data-testid={`vault-doc-row-${key}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isUploaded ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"}`}>
                    {isUploaded
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <FileText className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">{isUploaded ? "Uploaded" : hint}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isUploaded && item?.filePath && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid={`button-download-vault-${key}`}
                    >
                      <a href={`/api/founder/company-profiles/${group.profileId}/documents/${item.id}/download`} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <input
                    ref={el => { fileInputRefs.current[key] = el; }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={e => handleFileSelect(key, e.target.files?.[0])}
                    data-testid={`input-file-${key}`}
                  />
                  <Button
                    variant={isUploaded ? "outline" : "default"}
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRefs.current[key]?.click()}
                    data-testid={`button-upload-${key}`}
                  >
                    {isUploading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Upload className="h-4 w-4" />
                    }
                    <span className="ml-1.5">{isUploaded ? "Replace" : "Upload"}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {isVerified && (
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Landmark className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Ready to open a corporate bank account?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload the documents above first. They will be forwarded to the bank when your request is reviewed.
                </p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0 w-full sm:w-auto" data-testid="button-open-bank-account-vault">
              <Link href={`/founder/service-request?service=BANK_ACCOUNT`}>
                Request Bank Account
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VaultPage() {
  const { data, isLoading } = useQuery<VaultData>({
    queryKey: ["/api/founder/vault"],
  });

  const groupedDocs = data?.documents?.reduce((acc, doc) => {
    const category = doc.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, DocumentFile[]>) || {};

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const [activeTab, setActiveTab] = useState("documents");

  const hasCompanyDocs = (data?.companyDocuments?.length ?? 0) > 0;

  const renderDocuments = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    const hasPlatformDocs = (data?.documents?.length ?? 0) > 0;

    return (
      <div className="space-y-8">
        {hasCompanyDocs && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Company KYC Documents</h2>
              <p className="text-sm text-muted-foreground">Upload documents for your verified existing companies. These are sent to the bank when you apply for corporate account opening.</p>
            </div>
            {data?.companyDocuments?.map(group => (
              <CompanyDocumentsSection key={group.profileId} group={group} />
            ))}
          </div>
        )}

        {hasPlatformDocs ? (
          <div className="space-y-4">
            {hasCompanyDocs && (
              <div>
                <h2 className="text-base font-semibold">Platform Documents</h2>
                <p className="text-sm text-muted-foreground">Documents generated by Cellion One for your applications.</p>
              </div>
            )}
            {Object.entries(groupedDocs).map(([category, docs]) => {
              const config = categoryConfig[category] || { label: category, icon: FileText };
              const Icon = config.icon;

              return (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Icon className="h-5 w-5 text-primary" />
                      {config.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y">
                      {docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                          data-testid={`document-${doc.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{doc.filename}</p>
                              <p className="text-sm text-muted-foreground">
                                {doc.docType} &bull; {formatFileSize(doc.sizeBytes)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-download-${doc.id}`}
                          >
                            <a href={`/api/documents/${doc.id}/download`} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : !hasCompanyDocs ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Your uploaded documents and completed certificates will appear here."
          />
        ) : null}
      </div>
    );
  };

  return (
    <DashboardLayout
      role="founder"
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Document Vault" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-muted-foreground">
            Upload company documents and access all certificates in one secure place.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="tab-documents">
              <FolderOpen className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex items-center gap-2" data-testid="tab-receipts">
              <Receipt className="h-4 w-4" />
              Receipts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-6">
            {renderDocuments()}
          </TabsContent>

          <TabsContent value="receipts" className="mt-6">
            <ReceiptsList />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
