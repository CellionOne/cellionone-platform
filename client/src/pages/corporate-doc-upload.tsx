import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Upload, AlertCircle, FileText, Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocSlot {
  key: string;
  label: string;
  description?: string;
}

interface UploadTokenData {
  entityName: string | null;
  companyName: string;
  expiresAt: string;
  personId: number;
  applicationId: number;
  requiredDocSlots: DocSlot[];
}

export default function CorporateDocUploadPage() {
  const [, params] = useRoute("/corporate-doc-upload/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [step, setStep] = useState<"loading" | "form" | "uploading" | "success" | "error">("loading");
  const [tokenData, setTokenData] = useState<UploadTokenData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [files, setFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    if (!token) {
      setErrorMessage("No upload token provided. Please use the link from your invitation email.");
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/corporate-doc-upload/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.message || "This upload link is invalid or has expired.");
          setStep("error");
          return;
        }
        const data = await res.json();
        setTokenData(data);
        setStep("form");
      } catch {
        if (!cancelled) {
          setErrorMessage("Failed to validate upload link. Please try again.");
          setStep("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleFileChange = (slug: string, file: File | null) => {
    setFiles(prev => {
      if (!file) {
        const next = { ...prev };
        delete next[slug];
        return next;
      }
      return { ...prev, [slug]: file };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenData) return;

    const missingSlots = tokenData.requiredDocSlots.filter(s => !files[s.key]);
    if (missingSlots.length > 0) {
      toast({
        title: "Documents required",
        description: `Please upload: ${missingSlots.map(s => s.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setStep("uploading");
    try {
      const formData = new FormData();
      for (const [slug, file] of Object.entries(files)) {
        formData.append(slug, file);
      }

      const res = await fetch(`/api/corporate-doc-upload/${encodeURIComponent(token)}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.message || "Upload failed. Please try again.");
        setStep("error");
        return;
      }

      setStep("success");
    } catch {
      setErrorMessage("Upload failed. Please check your connection and try again.");
      setStep("error");
    }
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Validating your upload link…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Link unavailable</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                If you believe this is an error, please contact the person who sent you this link to request a new one.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Documents uploaded</CardTitle>
            <CardDescription>
              Your documents have been securely uploaded for the incorporation of <strong>{tokenData?.companyName}</strong>.
              The founder has been notified and will review them shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-center text-muted-foreground">You may close this window.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slots = tokenData?.requiredDocSlots ?? [];
  const uploadedCount = slots.filter(s => files[s.key]).length;
  const allUploaded = uploadedCount === slots.length && slots.length > 0;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cellion One</p>
              <CardTitle className="text-lg">{tokenData?.companyName}</CardTitle>
            </div>
          </div>
          <CardDescription>
            {tokenData?.entityName
              ? `Please upload the required documents for ${tokenData.entityName}.`
              : "Please upload the required corporate entity documents."}{" "}
            No account creation is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {slots.map((slot) => {
              const file = files[slot.key] ?? null;
              return (
                <div key={slot.key} className="space-y-1.5">
                  <Label htmlFor={`file-${slot.key}`}>
                    {slot.label} <span className="text-destructive">*</span>
                  </Label>
                  {slot.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{slot.description}</p>
                  )}
                  <div className="relative">
                    <Input
                      id={`file-${slot.key}`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="absolute inset-0 opacity-0 cursor-pointer h-full"
                      onChange={(e) => handleFileChange(slot.key, e.target.files?.[0] ?? null)}
                      data-testid={`input-corp-doc-${slot.key}`}
                    />
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${file ? "border-primary bg-primary/5" : "border-input bg-background"}`}>
                      {file ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate text-foreground">{file.name}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Choose file…</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">PDF, JPEG or PNG · max 10 MB</p>
                </div>
              );
            })}

            {slots.length > 1 && (
              <p className="text-xs text-muted-foreground">
                {uploadedCount} of {slots.length} documents selected
              </p>
            )}

            {tokenData?.expiresAt && (
              <p className="text-xs text-muted-foreground">
                Link expires: {new Date(tokenData.expiresAt).toLocaleString()}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={step === "uploading" || !allUploaded}
              data-testid="btn-submit-corp-doc-upload"
            >
              {step === "uploading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit documents
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
