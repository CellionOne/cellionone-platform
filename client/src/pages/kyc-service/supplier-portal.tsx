import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { CelionLogo } from "@/components/celion-logo";
import { LoadingPage } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Shield, Building2, FileText, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type PortalData = {
  organisation: {
    id: number;
    name: string;
    slug: string;
    logoPath: string | null;
    contactEmail: string;
  };
  requirements: Array<{
    id: number;
    documentName: string;
    documentCategory: string;
    isMandatory: boolean;
    hasExpiry: boolean;
  }>;
};

export default function SupplierPortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  const { data, isLoading, error } = useQuery<PortalData>({
    queryKey: ["/api/kyc-service/portal", slug, "suppliers"],
    enabled: !!slug,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/kyc-service/portal/${slug}/suppliers`, {
        companyName,
        contactName,
        contactEmail,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      setSubmitted(true);
      setInviteToken(result.inviteToken);
      toast({ title: "Registration successful", description: "Check your email for the verification link." });
    },
    onError: (err: Error) => {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingPage />;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold" data-testid="text-error-title">Portal Not Available</h1>
          <p className="text-muted-foreground" data-testid="text-error-message">
            This supplier verification portal is not available or has been disabled.
          </p>
          <Link href="/">
            <Button variant="outline" data-testid="link-home">
              <ArrowLeft className="h-4 w-4 mr-2" /> Go Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { organisation, requirements } = data;

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-2xl mx-auto px-4">
            <div className="flex items-center justify-between h-14 gap-4">
              <CelionLogo textClassName="font-bold text-lg" />
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <main className="pt-20 pb-12 px-4">
          <div className="max-w-lg mx-auto">
            <Card className="p-8 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 dark:text-green-400" />
              <h1 className="text-2xl font-bold" data-testid="text-success-title">Registration Complete</h1>
              <p className="text-muted-foreground">
                A verification link has been sent to <strong>{contactEmail}</strong>. Please check your email to begin the supplier verification process.
              </p>
              <Button onClick={() => navigate(`/kyc/verify/${inviteToken}`)} data-testid="button-begin-verification">
                Begin Verification Now
              </Button>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3">
              <CelionLogo textClassName="font-bold text-lg" />
              <Separator orientation="vertical" className="h-5" />
              <span className="text-sm font-medium text-muted-foreground truncate" data-testid="text-org-name">{organisation.name}</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="pt-20 pb-12 px-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Shield className="h-10 w-10 mx-auto text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-portal-title">Supplier Verification</h1>
            <p className="text-muted-foreground">
              <strong>{organisation.name}</strong> requires your company to complete due diligence verification.
            </p>
          </div>

          <Card className="p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="font-semibold" data-testid="text-form-title">Register for Verification</h2>
              <p className="text-sm text-muted-foreground">
                Enter your company details below. You will receive an email with a verification link to complete the full process.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Enter your company name"
                  data-testid="input-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person Name *</Label>
                <Input
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Enter the contact person's name"
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Email *</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="Enter the contact email address"
                  data-testid="input-contact-email"
                />
              </div>
            </div>

            <Button
              onClick={() => registerMutation.mutate()}
              disabled={!companyName || !contactName || !contactEmail || registerMutation.isPending}
              className="w-full"
              data-testid="button-register"
            >
              {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
              Register for Verification
            </Button>
          </Card>

          {requirements.length > 0 && (
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-sm" data-testid="text-requirements-title">Documents You Will Need</h3>
              <div className="space-y-2">
                {requirements.map(req => (
                  <div key={req.id} className="flex items-center gap-2 text-sm" data-testid={`requirement-${req.id}`}>
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{req.documentName}</span>
                    {req.isMandatory && <Badge variant="secondary" className="text-xs">Required</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-center text-xs text-muted-foreground">
            By registering, you agree to Cellion One's{" "}
            <a href="/kyc/terms" target="_blank" rel="noopener noreferrer" className="underline">KYC Terms & Conditions</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
