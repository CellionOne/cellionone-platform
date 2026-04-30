import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Upload, AlertCircle, FileText, Loader2, Building2, PenLine, Eraser, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "react-signature-canvas";

interface UploadTokenData {
  directorName: string | null;
  companyName: string;
  expiresAt: string;
  personId: number;
  applicationId: number;
}

export default function DirectorUploadPage() {
  const [, params] = useRoute("/director-upload/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [step, setStep] = useState<"loading" | "form" | "uploading" | "success" | "error">("loading");
  const [tokenData, setTokenData] = useState<UploadTokenData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [govIdFile, setGovIdFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [sigPadEmpty, setSigPadEmpty] = useState(true);

  const sigRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage("No upload token provided. Please use the link from your invitation email.");
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/director-upload/${encodeURIComponent(token)}`);
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

  const handleClearSignature = useCallback(() => {
    sigRef.current?.clear();
    setSigPadEmpty(true);
    setSignatureFile(null);
  }, []);

  const handleSaveSignature = useCallback(() => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const canvas = sigRef.current.getTrimmedCanvas();
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "signature.png", { type: "image/png" });
        setSignatureFile(file);
        toast({ title: "Signature captured", description: "Your drawn signature will be submitted with your documents." });
      }
    }, "image/png");
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passportFile || !govIdFile) {
      toast({ title: "Documents required", description: "Please upload both your passport photograph and government-issued ID.", variant: "destructive" });
      return;
    }
    if (!signatureFile) {
      toast({ title: "Signature required", description: "Please draw or upload your signature specimen.", variant: "destructive" });
      return;
    }

    setStep("uploading");
    try {
      const formData = new FormData();
      formData.append("passportPhoto", passportFile);
      formData.append("govId", govIdFile);
      formData.append("signature", signatureFile);

      const res = await fetch(`/api/director-upload/${encodeURIComponent(token)}`, {
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

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
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
            {tokenData?.directorName
              ? `Hello ${tokenData.directorName}, please`
              : "Please"}{" "}
            upload your identification documents and signature for the company incorporation. No account creation is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="passportPhoto">
                Passport Photograph <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="passportPhoto"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="absolute inset-0 opacity-0 cursor-pointer h-full"
                  onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
                  data-testid="input-passport-photo"
                />
                <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${passportFile ? "border-primary bg-primary/5" : "border-input bg-background"}`}>
                  {passportFile ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate text-foreground">{passportFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Choose file…</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">JPEG, PNG or PDF · max 10 MB</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="govId">
                Government-issued ID <span className="text-destructive">*</span>
                <span className="text-muted-foreground font-normal"> (NIN slip, International Passport, Driver's Licence)</span>
              </Label>
              <div className="relative">
                <Input
                  id="govId"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="absolute inset-0 opacity-0 cursor-pointer h-full"
                  onChange={(e) => setGovIdFile(e.target.files?.[0] || null)}
                  data-testid="input-gov-id"
                />
                <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${govIdFile ? "border-primary bg-primary/5" : "border-input bg-background"}`}>
                  {govIdFile ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate text-foreground">{govIdFile.name}</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Choose file…</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">JPEG, PNG or PDF · max 10 MB</p>
            </div>

            <div className="space-y-2">
              <Label>
                Signature Specimen <span className="text-destructive">*</span>
              </Label>
              <Tabs defaultValue="draw" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="draw" className="flex-1 gap-1.5" data-testid="tab-draw-signature">
                    <PenLine className="h-3.5 w-3.5" />
                    Draw
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 gap-1.5" data-testid="tab-upload-signature">
                    <Upload className="h-3.5 w-3.5" />
                    Upload scan
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="draw" className="mt-3 space-y-3">
                  {signatureFile && !sigPadEmpty ? (
                    <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-foreground">Signature captured — ready to submit</span>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed rounded-lg bg-white dark:bg-gray-50 overflow-hidden"
                      data-testid="signature-pad-container"
                    >
                      <SignatureCanvas
                        ref={sigRef}
                        penColor="#000000"
                        canvasProps={{
                          className: "w-full",
                          style: { width: "100%", height: "140px" },
                        }}
                        onBegin={() => setSigPadEmpty(false)}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearSignature}
                      disabled={sigPadEmpty && !signatureFile}
                      data-testid="button-clear-signature"
                    >
                      <Eraser className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveSignature}
                      disabled={sigPadEmpty}
                      data-testid="button-save-signature"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Capture signature
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Sign in the box above, then click "Capture signature"</p>
                </TabsContent>
                <TabsContent value="upload" className="mt-3 space-y-2">
                  <div className="relative">
                    <Input
                      id="signatureUpload"
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      className="absolute inset-0 opacity-0 cursor-pointer h-full"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f) {
                          const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                          if (!allowedTypes.includes(f.type)) {
                            toast({ title: "Invalid file type", description: "Signature must be a JPEG or PNG image.", variant: "destructive" });
                            e.target.value = "";
                            return;
                          }
                          if (f.size > 5 * 1024 * 1024) {
                            toast({ title: "File too large", description: "Signature image must be 5 MB or smaller.", variant: "destructive" });
                            e.target.value = "";
                            return;
                          }
                        }
                        setSignatureFile(f);
                        setSigPadEmpty(true);
                      }}
                      data-testid="input-signature-upload"
                    />
                    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${signatureFile ? "border-primary bg-primary/5" : "border-input bg-background"}`}>
                      {signatureFile ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate text-foreground">{signatureFile.name}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Choose file…</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Upload a scan or clear photo of your handwritten signature · JPEG or PNG · max 5 MB</p>
                </TabsContent>
              </Tabs>
            </div>

            {tokenData?.expiresAt && (
              <p className="text-xs text-muted-foreground">
                Link expires: {new Date(tokenData.expiresAt).toLocaleString()}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={step === "uploading" || !passportFile || !govIdFile || !signatureFile}
              data-testid="btn-submit-director-upload"
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
