import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import {
  FolderOpen,
  FileText,
  Download,
  Building2,
  Shield,
  FileCheck,
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

  return (
    <DashboardLayout 
      role="founder" 
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Document Vault" }]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-muted-foreground">
            Access all your company documents in one secure place
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !data?.documents?.length ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Your uploaded documents and completed certificates will appear here."
          />
        ) : (
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
        )}
      </div>
    </DashboardLayout>
  );
}
