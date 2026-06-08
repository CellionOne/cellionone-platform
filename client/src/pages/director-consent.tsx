import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/SignaturePad";
import { CelionLogo } from "@/components/celion-logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface ConsentTokenData {
  personId: number;
  fullName: string | null;
  role: string;
  companyName: string;
  applicationId: number;
}

export default function DirectorConsentPage() {
  const [, params] = useRoute("/director-consent/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [step, setStep] = useState<"loading" | "form" | "submitting" | "success" | "error">("loading");
  const [tokenData, setTokenData] = useState<ConsentTokenData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  const [consentToAct, setConsentToAct] = useState(false);
  const [consentToDisclosure, setConsentToDisclosure] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage("No consent token provided. Please use the link from your invitation email.");
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/director-consent/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.message || "This consent link is invalid or has expired.");
          setStep("error");
          return;
        }
        setTokenData(await res.json());
        setStep("form");
      } catch {
        if (!cancelled) {
          setErrorMessage("Could not reach the server. Please check your connection and try again.");
          setStep("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async () => {
    if (!signatureDataUrl) {
      toast({ title: "Signature required", description: "Please draw your signature before submitting.", variant: "destructive" });
      return;
    }
    if (!consentToAct) {
      toast({ title: "Consent required", description: "You must consent to act in this role.", variant: "destructive" });
      return;
    }

    setStep("submitting");
    try {
      const res = await fetch(`/api/director-consent/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureDataUrl,
          consentToAct,
          consentToDisclosure,
          consentText: "I consent to act as director/shareholder and to disclosure of my personal information to the Corporate Affairs Commission (CAC) as required for company registration.",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.message || "Failed to submit consent. Please try again.");
        setStep("error");
        return;
      }
      setStep("success");
    } catch {
      setErrorMessage("Could not reach the server. Please check your connection and try again.");
      setStep("error");
    }
  };

  const roleLabelMap: Record<string, string> = {
    director: "Director",
    shareholder: "Shareholder",
    secretary: "Company Secretary",
    director_shareholder: "Director & Shareholder",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <CelionLogo />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading consent form…</p>
          </div>
        )}

        {step === "error" && (
          <Card className="w-full max-w-md text-center">
            <CardHeader className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle>Link Error</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                If you need a new consent link, please contact the person who invited you.
              </p>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card className="w-full max-w-md text-center">
            <CardHeader className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Consent Submitted</CardTitle>
              <CardDescription className="text-base">
                Thank you{tokenData?.fullName ? `, ${tokenData.fullName}` : ""}! Your consent and signature have been recorded. The company registration team has been notified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="bg-primary/5 border-primary/20">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  Your signature will be used on CAC registration documents with a white background as required by the Corporate Affairs Commission.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {(step === "form" || step === "submitting") && tokenData && (
          <Card className="w-full max-w-xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-bold">Director / Shareholder Consent</CardTitle>
              <CardDescription>
                You have been invited to join <strong>{tokenData.companyName}</strong> as a{" "}
                <strong>{roleLabelMap[tokenData.role] ?? tokenData.role}</strong>.
                Please draw your signature and confirm your consent below to proceed with CAC registration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                  This signature will be printed on official CAC forms. Please sign clearly on a white background.
                </AlertDescription>
              </Alert>

              <SignaturePad
                label="Your Signature"
                required
                onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
                onClear={() => setSignatureDataUrl("")}
                width={520}
                height={160}
              />

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent-act"
                    checked={consentToAct}
                    onCheckedChange={(v) => setConsentToAct(!!v)}
                    disabled={step === "submitting"}
                  />
                  <Label htmlFor="consent-act" className="text-sm leading-snug cursor-pointer">
                    I consent to act as a {roleLabelMap[tokenData.role] ?? tokenData.role} of{" "}
                    <strong>{tokenData.companyName}</strong> and confirm that I am eligible to hold this role under the Companies and Allied Matters Act (CAMA) 2020.
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent-disclosure"
                    checked={consentToDisclosure}
                    onCheckedChange={(v) => setConsentToDisclosure(!!v)}
                    disabled={step === "submitting"}
                  />
                  <Label htmlFor="consent-disclosure" className="text-sm leading-snug cursor-pointer">
                    I consent to the disclosure of my personal information (name, address, identification details) to the Corporate Affairs Commission as required by law.
                  </Label>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={step === "submitting" || !consentToAct || !signatureDataUrl}
              >
                {step === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting…
                  </>
                ) : (
                  "Submit Consent & Signature"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By submitting, your electronic signature and consent will be recorded with your IP address and timestamp for audit purposes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
