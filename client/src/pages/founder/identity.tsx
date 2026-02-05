import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Shield,
  Upload,
  Camera,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  User,
  Info,
} from "lucide-react";
import type { IdentityVerification } from "@shared/schema";

export default function IdentityVerificationPage() {
  const { toast } = useToast();
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);

  const { data: verification, isLoading } = useQuery<IdentityVerification | null>({
    queryKey: ["/api/founder/identity"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/founder/identity/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/founder/identity"] });
      toast({
        title: "Documents uploaded",
        description: "Your identity verification is now pending review.",
      });
      setSelfieFile(null);
      setIdDocFile(null);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfieFile || !idDocFile) {
      toast({
        title: "Missing files",
        description: "Please upload both your selfie and ID document.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("selfie", selfieFile);
    formData.append("idDoc", idDocFile);
    uploadMutation.mutate(formData);
  };

  const getStatusInfo = () => {
    switch (verification?.status) {
      case "verified":
        return {
          icon: CheckCircle2,
          title: "Identity Verified",
          description: "Your identity has been verified. You can now submit applications.",
          color: "text-green-600",
        };
      case "pending":
        return {
          icon: AlertCircle,
          title: "Verification Pending",
          description: "Your documents are being reviewed. This usually takes 1-2 business days.",
          color: "text-yellow-600",
        };
      case "rejected":
        return {
          icon: AlertCircle,
          title: "Verification Rejected",
          description: verification.notes || "Please upload clearer documents and try again.",
          color: "text-red-600",
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <DashboardLayout 
      role="founder" 
      breadcrumbs={[{ label: "Dashboard", href: "/founder/dashboard" }, { label: "Identity Verification" }]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Identity Verification</h1>
          <p className="text-muted-foreground">
            Verify your identity once to submit applications
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : statusInfo ? (
          <Card className={verification?.status === "verified" ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" : ""}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  verification?.status === "verified" ? "bg-green-100 dark:bg-green-900/50" :
                  verification?.status === "pending" ? "bg-yellow-100 dark:bg-yellow-900/50" :
                  "bg-red-100 dark:bg-red-900/50"
                }`}>
                  <statusInfo.icon className={`h-5 w-5 ${statusInfo.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle>{statusInfo.title}</CardTitle>
                    <StatusBadge status={verification?.status || "not_started"} />
                  </div>
                  <CardDescription className="mt-1">
                    {statusInfo.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {verification?.status === "rejected" && (
              <CardContent>
                <Button onClick={() => {}} data-testid="button-retry-verification">
                  Upload New Documents
                </Button>
              </CardContent>
            )}
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Verify Your Identity</CardTitle>
                    <CardDescription>
                      Upload your photo and government-issued ID to verify your identity
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="selfie" className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Selfie Photo
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <Input
                        id="selfie"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                        data-testid="input-selfie"
                      />
                      <label htmlFor="selfie" className="cursor-pointer">
                        {selfieFile ? (
                          <div className="flex items-center justify-center gap-2 text-primary">
                            <FileCheck className="h-5 w-5" />
                            {selfieFile.name}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload your selfie
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="idDoc" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Government-Issued ID
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <Input
                        id="idDoc"
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => setIdDocFile(e.target.files?.[0] || null)}
                        data-testid="input-id-doc"
                      />
                      <label htmlFor="idDoc" className="cursor-pointer">
                        {idDocFile ? (
                          <div className="flex items-center justify-center gap-2 text-primary">
                            <FileCheck className="h-5 w-5" />
                            {idDocFile.name}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload your ID (NIN, Passport, Driver's License)
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={uploadMutation.isPending}
                    data-testid="button-submit-verification"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Uploading...
                      </>
                    ) : (
                      "Submit for Verification"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accepted ID Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    National Identification Number (NIN) Slip
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    International Passport
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Driver's License
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Voter's Card
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>About Passport Photos</AlertTitle>
              <AlertDescription>
                This identity verification is separate from the passport photograph required for CAC registration. 
                When completing your company application, you will also need to upload a formal passport-sized 
                photograph (white background, professional attire) for the Corporate Affairs Commission filing.
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
