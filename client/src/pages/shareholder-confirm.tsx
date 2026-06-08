import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CelionLogo } from "@/components/celion-logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface ConfirmData {
  confirmationId: number;
  personName: string | null;
  role: string | null;
  companyName: string | null;
  sharesAllocated: number | null;
  shareClass: string | null;
  sharePercentage: string | null;
}

export default function ShareholderConfirmPage() {
  const [, params] = useRoute("/shareholder-confirm/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [step, setStep] = useState<"loading" | "form" | "submitting" | "success" | "error">("loading");
  const [data, setData] = useState<ConfirmData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pscAccepted, setPscAccepted] = useState(false);
  const [capitalAccepted, setCapitalAccepted] = useState(false);
  const [shareholdingAccepted, setShareholdingAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage("No confirmation token provided.");
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shareholder-confirm/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setErrorMessage(d.message || "Invalid or expired confirmation link.");
          setStep("error");
          return;
        }
        setData(await res.json());
        setStep("form");
      } catch {
        if (!cancelled) {
          setErrorMessage("Could not reach the server. Please check your connection.");
          setStep("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async () => {
    if (!shareholdingAccepted) {
      toast({ title: "Confirmation required", description: "Please confirm your shareholding details.", variant: "destructive" });
      return;
    }
    setStep("submitting");
    try {
      const res = await fetch(`/api/shareholder-confirm/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pscDeclarationAccepted: pscAccepted, capitalPaidUpDeclarationAccepted: capitalAccepted }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMessage(d.message || "Failed to submit. Please try again.");
        setStep("error");
        return;
      }
      setStep("success");
    } catch {
      setErrorMessage("Could not reach the server. Please try again.");
      setStep("error");
    }
  };

  const isPsc = data ? parseFloat(data.sharePercentage ?? "0") >= 25 : false;

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
            <p>Loading confirmation…</p>
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
                If you need a new confirmation link, please contact the company founder.
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
              <CardTitle className="text-2xl font-bold">Shareholding Confirmed</CardTitle>
              <CardDescription className="text-base">
                Thank you{data?.personName ? `, ${data.personName}` : ""}! Your shareholding details and declarations have been recorded. The founder has been notified.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {(step === "form" || step === "submitting") && data && (
          <Card className="w-full max-w-xl">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Confirm Your Shareholding</CardTitle>
                  <CardDescription>{data.companyName}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                <p className="text-sm font-medium">Share Allocation Details</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Shares</p>
                    <p className="font-medium">{data.sharesAllocated?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Class</p>
                    <p className="font-medium">{data.shareClass || "Ordinary"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Percentage</p>
                    <p className="font-medium">{data.sharePercentage ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="shareholding"
                    checked={shareholdingAccepted}
                    onCheckedChange={(v) => setShareholdingAccepted(!!v)}
                    disabled={step === "submitting"}
                  />
                  <Label htmlFor="shareholding" className="text-sm leading-snug cursor-pointer">
                    I confirm that the shareholding details above are correct and that I agree to hold{" "}
                    <strong>{data.sharesAllocated?.toLocaleString() ?? "—"} {data.shareClass || "Ordinary"} shares</strong> ({data.sharePercentage ?? "—"}) in{" "}
                    <strong>{data.companyName}</strong>.
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                </div>

                {isPsc && (
                  <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                      Your shareholding of <strong>{data.sharePercentage}</strong> meets the threshold for a Person with Significant Control (PSC) under CAMA 2020. Please complete the declaration below.
                    </AlertDescription>
                  </Alert>
                )}

                {isPsc && (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="psc"
                      checked={pscAccepted}
                      onCheckedChange={(v) => setPscAccepted(!!v)}
                      disabled={step === "submitting"}
                    />
                    <Label htmlFor="psc" className="text-sm leading-snug cursor-pointer">
                      <strong>PSC Declaration:</strong> I declare that I am a Person with Significant Control (PSC) of{" "}
                      <strong>{data.companyName}</strong> by virtue of holding 25% or more of the shares and/or voting rights, and I consent to my details being entered in the company's PSC register as required by the Companies and Allied Matters Act (CAMA) 2020.
                    </Label>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="capital"
                    checked={capitalAccepted}
                    onCheckedChange={(v) => setCapitalAccepted(!!v)}
                    disabled={step === "submitting"}
                  />
                  <Label htmlFor="capital" className="text-sm leading-snug cursor-pointer">
                    <strong>Capital Declaration:</strong> I confirm that at least 25% of the nominal value of all shares allocated to me in <strong>{data.companyName}</strong> has been paid up or will be paid up on allotment, in compliance with Section 124 of CAMA 2020.
                  </Label>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={step === "submitting" || !shareholdingAccepted || (isPsc && !pscAccepted)}
              >
                {step === "submitting" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</>
                ) : (
                  "Confirm Shareholding"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Your confirmation will be recorded with your IP address and timestamp for audit purposes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
