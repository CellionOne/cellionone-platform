import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  Eye,
  Loader2,
} from "lucide-react";

interface LocationData {
  id: number;
  label: string;
  line1: string;
  city: string;
  state: string;
  utilityBillStatus: string | null;
  utilityBillUploadedAt: string | null;
  utilityBillExpiresAt: string | null;
}

interface UtilityBillData {
  status: string | null;
  uploadedAt: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
}

export default function BuildingManagerUtilityBill() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: location, isLoading: loadingLocation } = useQuery<LocationData>({
    queryKey: ["/api/building-manager/location"],
  });

  const { data: utilityBill, isLoading: loadingBill } = useQuery<UtilityBillData>({
    queryKey: ["/api/building-manager/utility-bill"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      const res = await apiRequest("POST", "/api/building-manager/utility-bill/upload-url", {
        fileName: file.name,
        contentType: file.type,
      });
      const data = await res.json();

      await fetch(data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await apiRequest("POST", "/api/building-manager/utility-bill/upload-complete", {
        storagePath: data.storagePath,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/building-manager/utility-bill"] });
      queryClient.invalidateQueries({ queryKey: ["/api/building-manager/location"] });
      toast({ title: "Utility bill uploaded successfully" });
      setSelectedFile(null);
      setIsUploading(false);
    },
    onError: () => {
      toast({ title: "Failed to upload utility bill", variant: "destructive" });
      setIsUploading(false);
    },
  });

  const isLoading = loadingLocation || loadingBill;

  if (isLoading) {
    return (
      <DashboardLayout
        role="building_manager"
        breadcrumbs={[
          { label: "Dashboard", href: "/building-manager/dashboard" },
          { label: "Utility Bill" },
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!location) {
    return (
      <DashboardLayout
        role="building_manager"
        breadcrumbs={[
          { label: "Dashboard", href: "/building-manager/dashboard" },
          { label: "Utility Bill" },
        ]}
      >
        <EmptyState
          icon={Building2}
          title="No Location Assigned"
          description="You have not been assigned to a building location yet."
        />
      </DashboardLayout>
    );
  }

  const getStatusBadge = () => {
    const status = utilityBill?.status || location.utilityBillStatus;
    switch (status) {
      case "current":
        return <Badge className="gap-1 bg-primary" data-testid="badge-bill-status"><CheckCircle2 className="h-3 w-3" />Current</Badge>;
      case "expired":
        return <Badge variant="destructive" className="gap-1" data-testid="badge-bill-status"><AlertTriangle className="h-3 w-3" />Expired</Badge>;
      case "pending":
        return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600" data-testid="badge-bill-status"><Clock className="h-3 w-3" />Pending</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1" data-testid="badge-bill-status"><Upload className="h-3 w-3" />Not Uploaded</Badge>;
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const effectiveStatus = utilityBill?.status || location.utilityBillStatus;
  const effectiveUploadedAt = utilityBill?.uploadedAt || location.utilityBillUploadedAt;
  const effectiveExpiresAt = utilityBill?.expiresAt || location.utilityBillExpiresAt;

  return (
    <DashboardLayout
      role="building_manager"
      breadcrumbs={[
        { label: "Dashboard", href: "/building-manager/dashboard" },
        { label: "Utility Bill" },
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="h-6 w-6 text-primary" />
            Utility Bill Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage the utility bill for {location.label}
          </p>
        </div>

        <Card data-testid="card-current-bill">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Current Utility Bill</CardTitle>
                <CardDescription>
                  The utility bill is used as proof of address for subscriber registrations
                </CardDescription>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {effectiveStatus === "current" || effectiveStatus === "pending" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {effectiveUploadedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Uploaded</p>
                        <p className="font-medium" data-testid="text-uploaded-date">
                          {new Date(effectiveUploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {effectiveExpiresAt && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p className="font-medium" data-testid="text-expiry-date">
                          {new Date(effectiveExpiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {utilityBill?.downloadUrl && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open(utilityBill.downloadUrl!, "_blank")}
                    data-testid="button-preview-bill"
                  >
                    <Eye className="h-4 w-4" />
                    Preview Current Bill
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {effectiveStatus === "expired" ? "Utility bill has expired" : "No utility bill uploaded"}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Please upload a recent utility bill to support subscriber proof of address requests.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-upload-bill">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload New Utility Bill
            </CardTitle>
            <CardDescription>
              Upload a recent utility bill (electricity, water, or gas). It will automatically be set to expire in 3 months.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="utility-file">Select File</Label>
              <Input
                id="utility-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                data-testid="input-utility-file"
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, JPG, PNG. Maximum file size: 10MB.
              </p>
            </div>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading || uploadMutation.isPending}
              className="gap-2"
              data-testid="button-submit-upload"
            >
              {isUploading || uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Utility Bill
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
