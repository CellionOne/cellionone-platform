import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { ReceiptsList } from "@/components/receipts-list";
import {
  FolderOpen,
  FileText,
  Download,
  Building2,
  Shield,
  FileCheck,
  Receipt,
} from "lucide-react";
import type { DocumentFile, CompanyApplication } from "@shared/schema";

interface VaultData {
  applications: CompanyApplication[];
  documents: DocumentFile[];
}

const categoryConfig: Record<string, { label: string; icon: React.ElementType }> = {
  identity: { label: "Identity Documents", icon: Shield },
  company: { label: "Company Documents", icon: Building2 },
  filing: { label: "Filing Documents", icon: FileText },
  stamped_originals: { label: "Stamped Originals", icon: FileCheck },
  courier: { label: "Courier Documents", icon: FileText },
};

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

  const renderDocuments = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    if (!data?.documents?.length) {
      return (
        <EmptyState
          icon={FolderOpen}
          title="No documents yet"
          description="Your uploaded documents and completed certificates will appear here."
        />
      );
    }

    return (
      <div className="space-y-6">
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
            Access all your company documents and receipts in one secure place
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
