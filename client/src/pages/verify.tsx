import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  FileText,
  Package,
  Clock,
  User,
  Building2,
  Fingerprint,
  Search,
  CreditCard,
} from "lucide-react";

interface VerificationStatus {
  status: string;
  subjectName: string | null;
  partnerName: string;
  partnerType: string;
  consentGrantedAt: string;
  expiresAt: string;
  dataScope: Record<string, boolean>;
  verification: {
    isVerified: boolean;
    verifiedAt: string | null;
    checks: {
      bvnValidation: boolean;
      ninValidation: boolean;
      documentVerification: boolean;
      biometricMatch: boolean;
      amlScreening: boolean;
    };
  };
}

const checkLabels = [
  { key: "bvnValidation", label: "BVN Validation", icon: CreditCard, description: "Bank Verification Number confirmed" },
  { key: "ninValidation", label: "NIN Validation", icon: User, description: "National Identification Number confirmed" },
  { key: "documentVerification", label: "Document Verification", icon: FileText, description: "Government-issued ID verified" },
  { key: "biometricMatch", label: "Biometric Match", icon: Fingerprint, description: "Selfie & liveness detection passed" },
  { key: "amlScreening", label: "AML Screening", icon: Search, description: "Anti-Money Laundering & sanctions cleared" },
];

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery<VerificationStatus>({
    queryKey: ["/api/partner/verified-data", token, "status"],
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const isInvalid = !data || data.status === "invalid";
  const isRevoked = data?.status === "revoked";
  const isExpired = data?.status === "expired";
  const isActive = data?.status === "active";

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-zinc-950 dark:to-zinc-900" data-testid="verify-page">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Cellion One</h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-wide uppercase">Identity Verification Portal</p>
        </div>

        {isInvalid && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="pt-8 pb-8 text-center">
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-300" data-testid="text-status">Invalid Verification Link</h2>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                This verification link is invalid or does not exist. Please check the URL and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {isRevoked && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="pt-8 pb-8 text-center">
              <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-300" data-testid="text-status">Consent Revoked</h2>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                The data owner has revoked consent for this verification. The data is no longer accessible.
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && (
          <Card className="border-amber-200 dark:border-amber-800">
            <CardContent className="pt-8 pb-8 text-center">
              <Clock className="w-16 h-16 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-300" data-testid="text-status">Verification Expired</h2>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                This verification link expired on {data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "N/A"}.
                Please request a new link from the data owner.
              </p>
            </CardContent>
          </Card>
        )}

        {isActive && data && (
          <div className="space-y-6">
            <Card className="border-green-200 dark:border-green-800 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
                <h2 className="text-2xl font-bold" data-testid="text-status">Identity Verified</h2>
                <p className="text-green-100 mt-1">
                  {data.subjectName && <span className="font-semibold">{data.subjectName}</span>}
                  {data.subjectName && " has been verified through Cellion One"}
                </p>
              </div>

              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div>
                    <p className="text-muted-foreground">Shared With</p>
                    <p className="font-medium" data-testid="text-partner-name">{data.partnerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Consent Granted</p>
                    <p className="font-medium">{new Date(data.consentGrantedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valid Until</p>
                    <p className="font-medium">{new Date(data.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                  {data.verification.verifiedAt && (
                    <div>
                      <p className="text-muted-foreground">Verified On</p>
                      <p className="font-medium">{new Date(data.verification.verifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    Verification Checks
                  </h3>
                  <div className="space-y-2">
                    {checkLabels.map(({ key, label, icon: Icon, description }) => {
                      const passed = data.verification.checks[key as keyof typeof data.verification.checks];
                      return (
                        <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid={`check-${key}`}>
                          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${passed ? "bg-green-100 dark:bg-green-900/40" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                            {passed ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircle className="w-5 h-5 text-zinc-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={passed ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400" : "border-zinc-300 text-zinc-500"}
                          >
                            {passed ? "PASSED" : "PENDING"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {data.dataScope && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold mb-3">Data Included</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.dataScope.personal && <Badge variant="secondary"><User className="w-3 h-3 mr-1" /> Personal Info</Badge>}
                      {data.dataScope.verification && <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" /> Verification</Badge>}
                      {data.dataScope.company && <Badge variant="secondary"><Building2 className="w-3 h-3 mr-1" /> Company</Badge>}
                      {data.dataScope.documents && <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" /> Documents</Badge>}
                      {data.dataScope.proofOfAddress && <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" /> Proof of Address</Badge>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                size="lg"
                className="w-full"
                onClick={() => window.open(`/api/partner/verified-data/${token}/certificate`, "_blank")}
                data-testid="button-download-certificate"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Certificate
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => window.open(`/api/partner/verified-data/${token}/package`, "_blank")}
                data-testid="button-download-package"
              >
                <Package className="w-4 h-4 mr-2" />
                Download Full Package
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              This data was shared with the consent of {data.subjectName || "the data owner"} on{" "}
              {new Date(data.consentGrantedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
              <br />
              For questions, contact <a href="mailto:service@cellionone.com" className="text-primary hover:underline">service@cellionone.com</a>
            </p>
          </div>
        )}

        <div className="text-center mt-12">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
