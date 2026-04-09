import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Camera, CheckCircle2, AlertCircle, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Director Biometric Verification Page
// Accessed via secure invite token link: /director-biometric?token=<invite_token>
// Directors follow the link from their email to complete Smile ID Job Type 4 biometric (selfie) verification.

export default function DirectorBiometricPage() {
  const [search] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(search.split("?")[1] || "");
  const token = params.get("token") || "";

  const [step, setStep] = useState<"loading" | "form" | "submitting" | "success" | "error">("loading");
  const [inviteData, setInviteData] = useState<{
    directorName: string;
    expiresAt: string;
    status: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string>("");
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Validate invite token on mount using useEffect (not useState — avoids StrictMode double-invoke issues)
  useEffect(() => {
    if (!token) {
      setErrorMessage("No verification token provided. Please use the link from your invitation email.");
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/director-biometric/invite?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.message || "This verification link is invalid or has expired.");
          setStep("error");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setInviteData(data);
        setStep("form");
      } catch {
        if (!cancelled) {
          setErrorMessage("Failed to validate your verification link. Please try again.");
          setStep("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select a photo (JPEG or PNG).", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select a photo under 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSelfiePreview(dataUrl);
      // Strip data:image/...;base64, prefix — Smile ID expects raw base64
      setSelfieBase64(dataUrl.split(",")[1] || "");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selfieBase64) {
      toast({ title: "Selfie required", description: "Please take or upload a selfie photo to proceed.", variant: "destructive" });
      return;
    }
    setStep("submitting");
    try {
      const res = await fetch("/api/director-biometric/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, selfieImageBase64: selfieBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || "Biometric submission failed. Please try again.");
        setStep("error");
        return;
      }
      setStep("success");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStep("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Identity Verification</h1>
          <p className="text-muted-foreground text-sm mt-1">Cellion One — Director Biometric Verification</p>
        </div>

        {step === "loading" && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        )}

        {step === "error" && (
          <Card>
            <CardContent className="py-8 space-y-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-6 w-6 shrink-0" />
                <p className="font-semibold">Verification Link Issue</p>
              </div>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <p className="text-sm text-muted-foreground">
                If you believe this is an error, please contact the company owner or reach out to{" "}
                <a href="mailto:support@cellionone.com" className="underline text-primary">support@cellionone.com</a>.
              </p>
            </CardContent>
          </Card>
        )}

        {step === "form" && inviteData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Director Biometric Verification
              </CardTitle>
              <CardDescription>
                Hi <strong>{inviteData.directorName}</strong>, please submit a selfie photo to complete your identity verification as a director on Cellion One.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Requirements:</strong> Use a clear, well-lit selfie. Your face must be visible and unobstructed. Avoid sunglasses or hats.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => selfieInputRef.current?.click()}
                  data-testid="div-selfie-upload-area"
                >
                  {selfiePreview ? (
                    <div className="space-y-2">
                      <img
                        src={selfiePreview}
                        alt="Selfie preview"
                        className="w-32 h-32 object-cover rounded-full mx-auto border-2 border-primary/30"
                      />
                      <p className="text-sm text-muted-foreground">Tap to replace photo</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Camera className="h-10 w-10 text-muted-foreground mx-auto" />
                      <p className="text-sm font-medium">Take or upload a selfie</p>
                      <p className="text-xs text-muted-foreground">JPEG or PNG, max 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleSelfieChange}
                  className="hidden"
                  capture="user"
                  data-testid="input-selfie-file"
                />
                {selfiePreview && (
                  <Button variant="outline" size="sm" onClick={() => selfieInputRef.current?.click()} className="w-full" data-testid="button-retake-selfie">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Choose Different Photo
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Your biometric data is processed by Smile ID, our identity verification partner.</p>
                <p>• Your selfie is used solely for identity verification and is not shared with third parties.</p>
                <p>
                  • This link expires on{" "}
                  <strong>{new Date(inviteData.expiresAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</strong>.
                </p>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!selfieBase64}
                className="w-full"
                data-testid="button-submit-biometric"
              >
                Submit for Verification
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "submitting" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-semibold">Submitting your biometric...</p>
                <p className="text-sm text-muted-foreground">This may take a moment. Please do not close this page.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div className="text-center space-y-2">
                <p className="font-semibold text-lg">Verification Submitted</p>
                <p className="text-sm text-muted-foreground">
                  Thank you! Your biometric verification has been submitted successfully. Our compliance team will review your submission and you will be notified of the outcome.
                </p>
                <Badge variant="secondary" className="mt-2">Verification Under Review</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
