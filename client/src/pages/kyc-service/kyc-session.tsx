import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingSpinner } from "@/components/loading-spinner";
import { LiveCaptureWidget } from "@/components/live-capture-widget";
import {
  Shield, CheckCircle2, XCircle, Clock, ChevronRight,
  User, FileText, Camera, AlertTriangle, ExternalLink, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SessionData = {
  sessionId: number;
  status: string;
  type: string;
  subjectEmail: string;
  subjectName: string;
  expiresAt: string;
  metadata: Record<string, any> | null;
  prefillData: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    idNumber?: string;
    documentType?: string;
    idDocumentUrl?: string;
  } | null;
  requiredSteps: string[] | null;
  organisation: { name: string; logoPath: string | null } | null;
  returnUrl?: string;
};

type IdentityData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

const ALL_STEPS = [
  { id: "consent", label: "Consent", icon: Shield },
  { id: "identity", label: "Identity", icon: User },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "selfie", label: "Selfie", icon: Camera },
];

function getActiveSteps(requiredSteps: string[] | null) {
  if (!requiredSteps) return ALL_STEPS;
  return ALL_STEPS.filter(s => s.id === "consent" || requiredSteps.includes(s.id));
}

function StepIndicator({ currentStepId, activeSteps }: { currentStepId: string; activeSteps: typeof ALL_STEPS }) {
  const currentIdx = activeSteps.findIndex(s => s.id === currentStepId);
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {activeSteps.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                done ? "bg-primary border-primary text-primary-foreground" :
                  active ? "border-primary bg-primary/10 text-primary" :
                    "border-muted text-muted-foreground bg-muted/30"
              )}>
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={cn(
                "text-xs font-medium hidden sm:block",
                active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"
              )}>{step.label}</span>
            </div>
            {idx < activeSteps.length - 1 && (
              <div className={cn(
                "h-0.5 w-8 sm:w-12 mx-1 transition-all",
                done ? "bg-primary" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PrefillConfirmationCard({ data, label }: { data: Record<string, string | undefined>; label: string }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {label} pre-filled by the requesting organisation
      </div>
      <div className="space-y-1">
        {Object.entries(data).filter(([, v]) => !!v).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
            <span className="font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsentStep({ session, requiredSteps, onAccept, isPending }: {
  session: SessionData;
  requiredSteps: string[] | null;
  onAccept: () => void;
  isPending: boolean;
}) {
  const [agreed, setAgreed] = useState(false);

  const allCollect = [
    { id: "identity", icon: User, text: "Your personal details (name, date of birth)" },
    { id: "documents", icon: FileText, text: "Government-issued ID document" },
    { id: "selfie", icon: Camera, text: "A liveness selfie for biometric matching" },
  ];
  const collectItems = requiredSteps
    ? allCollect.filter(c => requiredSteps.includes(c.id))
    : allCollect;

  const hasPrefillIdentity = !!(session.prefillData?.firstName && session.prefillData?.lastName && session.prefillData?.dateOfBirth);
  const hasPrefillDocument = !!(session.prefillData?.idNumber || session.prefillData?.documentType);

  return (
    <div className="space-y-6" data-testid="step-consent">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Identity Verification</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {session.organisation?.name
            ? `${session.organisation.name} is requesting identity verification to comply with regulatory requirements.`
            : "You have been invited to complete identity verification."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-medium">Verification for:</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{session.subjectName}</p>
              <p className="text-xs text-muted-foreground">{session.subjectEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Link expires {new Date(session.expiresAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
        </CardContent>
      </Card>

      {(hasPrefillIdentity || hasPrefillDocument) && (
        <div className="space-y-2">
          {hasPrefillIdentity && (
            <PrefillConfirmationCard
              label="Identity details"
              data={{
                "First name": session.prefillData!.firstName,
                "Last name": session.prefillData!.lastName,
                "Date of birth": session.prefillData!.dateOfBirth,
              }}
            />
          )}
          {hasPrefillDocument && (
            <PrefillConfirmationCard
              label="Document info"
              data={{
                "Document type": session.prefillData!.documentType,
                "ID number": session.prefillData!.idNumber,
              }}
            />
          )}
        </div>
      )}

      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold">{collectItems.length < 3 ? "What you'll need to complete" : "What we'll collect"}</p>
          <ul className="space-y-2">
            {collectItems.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                {text}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer" onClick={() => setAgreed(!agreed)}>
        <div className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
          agreed ? "border-primary bg-primary" : "border-muted-foreground"
        )} data-testid="checkbox-consent">
          {agreed && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          I consent to my identity being verified and understand that my data will be processed
          securely in accordance with Cellion One's privacy policy.
        </p>
      </div>

      <Button
        className="w-full"
        disabled={!agreed || isPending}
        onClick={onAccept}
        data-testid="button-accept-consent"
      >
        {isPending ? <LoadingSpinner className="h-4 w-4 mr-2" /> : null}
        Continue
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

function IdentityStep({ session, onNext }: {
  session: SessionData;
  onNext: (data: IdentityData) => void;
}) {
  const [firstName, setFirstName] = useState(session.subjectName.split(" ")[0] || "");
  const [lastName, setLastName] = useState(session.subjectName.split(" ").slice(1).join(" ") || "");
  const [dob, setDob] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    if (!dob) errs.dob = "Date of birth is required";
    else {
      const d = new Date(dob);
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 18) errs.dob = "You must be at least 18 years old";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validate()) onNext({ firstName: firstName.trim(), lastName: lastName.trim(), dateOfBirth: dob });
  }

  return (
    <div className="space-y-6" data-testid="step-identity">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Personal Details</h2>
        <p className="text-sm text-muted-foreground">Please confirm your personal information</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              className={cn(
                "w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow",
                errors.firstName ? "border-red-500" : "border-input"
              )}
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Adebayo"
              data-testid="input-first-name"
            />
            {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              className={cn(
                "w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow",
                errors.lastName ? "border-red-500" : "border-input"
              )}
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Ogunlesi"
              data-testid="input-last-name"
            />
            {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="dob">Date of Birth</label>
          <input
            id="dob"
            type="date"
            className={cn(
              "w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow",
              errors.dob ? "border-red-500" : "border-input"
            )}
            value={dob}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
            onChange={e => setDob(e.target.value)}
            data-testid="input-dob"
          />
          {errors.dob && <p className="text-xs text-red-500">{errors.dob}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            readOnly
            className="w-full px-3 py-2 rounded-md border bg-muted text-sm text-muted-foreground cursor-not-allowed border-input"
            value={session.subjectEmail}
            data-testid="input-email"
          />
          <p className="text-xs text-muted-foreground">Email is pre-filled from your verification link</p>
        </div>
      </div>

      <Button className="w-full" onClick={handleNext} data-testid="button-next-identity">
        Continue
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

type DocumentUploadResult = {
  objectPath: string;
  docType: string;
};

function DocumentsStep({ token, onNext }: { token: string; onNext: (result: DocumentUploadResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("national_id");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError("File must be under 5MB");
      return;
    }
    setError("");
    setFile(f);
  }

  async function handleNext() {
    if (!file) {
      setError("Please upload your document");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const urlRes = await fetch(`/api/kyc-service/sessions/${token}/upload-url`, { method: "POST" });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      onNext({ objectPath, docType });
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="step-documents">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Upload Document</h2>
        <p className="text-sm text-muted-foreground">Upload a clear, unobstructed photo of your government-issued ID</p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Document Type</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "national_id", label: "National ID" },
            { value: "passport", label: "Passport" },
            { value: "drivers_license", label: "Driver's Licence" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDocType(opt.value)}
              className={cn(
                "py-2 px-3 rounded-lg border text-xs font-medium transition-all",
                docType === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:border-primary/50"
              )}
              data-testid={`button-doctype-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/30 hover:border-primary/40"
        )}
        onClick={() => document.getElementById("doc-upload")?.click()}
        data-testid="upload-area"
      >
        <input
          id="doc-upload"
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFile}
          data-testid="input-doc-file"
        />
        {file ? (
          <div className="space-y-2">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm font-medium text-primary">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB — tap to change</p>
          </div>
        ) : (
          <div className="space-y-2">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Tap to upload document</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
        <CardContent className="pt-4 text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <p className="font-semibold">Tips for a successful submission</p>
          <ul className="space-y-0.5 text-amber-600 dark:text-amber-500">
            <li>• All text must be clearly readable</li>
            <li>• Ensure the full document is visible</li>
            <li>• Avoid glare, shadows, or blurring</li>
          </ul>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleNext} disabled={uploading} data-testid="button-next-documents">
        {uploading ? (
          <>
            <LoadingSpinner className="h-4 w-4 mr-2" />
            Uploading…
          </>
        ) : (
          <>
            Continue
            <ChevronRight className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}

function SelfieStep({ onCapture }: { onCapture: (base64: string) => void }) {
  return (
    <div className="space-y-5" data-testid="step-selfie">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Liveness Selfie</h2>
        <p className="text-sm text-muted-foreground">
          Take a clear selfie to verify your identity against your document
        </p>
      </div>
      <LiveCaptureWidget onCapture={onCapture} />
    </div>
  );
}

function SubmitStep({ onComplete, isPending }: {
  onComplete: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-6 text-center" data-testid="step-submit">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <Shield className="h-10 w-10 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Ready to Submit</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          All information collected. Tap the button below to submit your verification for review.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2 text-left">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              Personal details confirmed
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ID document uploaded
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              Selfie captured
            </li>
          </ul>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={onComplete} disabled={isPending} data-testid="button-submit-session">
        {isPending ? <LoadingSpinner className="h-4 w-4 mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
        Submit Verification
      </Button>

      <p className="text-xs text-muted-foreground">
        By submitting, you confirm all information provided is accurate and genuine.
      </p>
    </div>
  );
}

function DoneState({ returnUrl, requestId, sessionId }: {
  returnUrl?: string | null;
  requestId?: number;
  sessionId?: number;
}) {
  useEffect(() => {
    if (returnUrl) {
      const timer = setTimeout(() => {
        window.location.href = returnUrl;
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [returnUrl]);

  return (
    <div className="space-y-6 text-center" data-testid="state-completed">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Verification Submitted</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Your identity verification has been submitted successfully. You'll receive an email when
          it has been reviewed.
        </p>
      </div>
      {requestId && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          Reference #{requestId}
        </div>
      )}
      {returnUrl && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Redirecting you back shortly…</p>
          <Button variant="outline" size="sm" onClick={() => window.location.href = returnUrl} data-testid="button-return">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Return now
          </Button>
        </div>
      )}
    </div>
  );
}

const STEP_ID_MAP: Record<number, string> = { 0: "consent", 1: "identity", 2: "documents", 3: "selfie", 4: "submit" };

export default function KycSessionPage() {
  const { token } = useParams<{ token: string }>();
  const [stepIdx, setStepIdx] = useState(0);
  const [identityData, setIdentityData] = useState<IdentityData | null>(null);
  const [documentUpload, setDocumentUpload] = useState<DocumentUploadResult | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [completedRequestId, setCompletedRequestId] = useState<number | undefined>();
  const [completedReturnUrl, setCompletedReturnUrl] = useState<string | undefined>();
  const [completedSessionId, setCompletedSessionId] = useState<number | undefined>();
  const [sessionExpiredMidFlow, setSessionExpiredMidFlow] = useState(false);

  const { data: session, isLoading, error } = useQuery<SessionData>({
    queryKey: ["/api/kyc-service/sessions", token],
    queryFn: () => fetch(`/api/kyc-service/sessions/${token}`).then(async r => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw Object.assign(new Error(body.message || "Failed"), { status: r.status, body });
      }
      return r.json();
    }),
    enabled: !!token,
    retry: false,
  });

  // Pre-populate identity data from prefillData when session loads
  useEffect(() => {
    if (session?.prefillData && !identityData) {
      const { firstName, lastName, dateOfBirth } = session.prefillData;
      if (firstName && lastName && dateOfBirth) {
        setIdentityData({ firstName, lastName, dateOfBirth });
      }
    }
  }, [session]);

  const activeSteps = session ? getActiveSteps(session.requiredSteps) : ALL_STEPS;
  const requiredSteps = session?.requiredSteps;

  function getNextStepAfterConsent(): number {
    if (!requiredSteps || requiredSteps.includes("identity")) return 1;
    if (requiredSteps.includes("documents")) return 2;
    if (requiredSteps.includes("selfie")) return 3;
    return 4;
  }

  function getNextStepAfterIdentity(): number {
    if (!requiredSteps || requiredSteps.includes("documents")) return 2;
    if (requiredSteps.includes("selfie")) return 3;
    return 4;
  }

  function getNextStepAfterDocuments(): number {
    if (!requiredSteps || requiredSteps.includes("selfie")) return 3;
    return 4;
  }

  function handleMutationError(err: any) {
    const msg = err?.message || "";
    if (msg.startsWith("410") || err?.status === 410) {
      setSessionExpiredMidFlow(true);
    }
  }

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/kyc-service/sessions/${token}/start`),
    onError: handleMutationError,
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/kyc-service/sessions/${token}/complete`, {
      firstName: identityData?.firstName,
      lastName: identityData?.lastName,
      dateOfBirth: identityData?.dateOfBirth,
      selfieBase64: selfieBase64,
      documentObjectPath: documentUpload?.objectPath,
      documentType: documentUpload?.docType,
    }),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      setCompletedRequestId(data.verificationRequestId);
      setCompletedReturnUrl(data.returnUrl || session?.returnUrl || undefined);
      setCompletedSessionId(session?.sessionId);
      setStepIdx(5);
    },
    onError: handleMutationError,
  });

  function handleConsentAccept() {
    startMutation.mutate(undefined, {
      onSuccess: () => setStepIdx(getNextStepAfterConsent()),
    });
  }

  function handleIdentityNext(data: IdentityData) {
    setIdentityData(data);
    setStepIdx(getNextStepAfterIdentity());
  }

  function handleDocumentsNext(result: DocumentUploadResult) {
    setDocumentUpload(result);
    setStepIdx(getNextStepAfterDocuments());
  }

  function handleSelfieCapture(base64: string) {
    setSelfieBase64(base64);
    setStepIdx(4);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-zinc-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const sessionError = error as any;
  const isExpired = sessionExpiredMidFlow || sessionError?.status === 410 || session?.status === "expired";
  const isAlreadyDone = session?.status === "completed" || stepIdx === 5;
  const notFound = !session && !isLoading && !isExpired;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-zinc-950 dark:to-zinc-900" data-testid="kyc-session-page">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Cellion One</p>
              <p className="text-[10px] text-muted-foreground">Verification Portal</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {notFound && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              <XCircle className="w-14 h-14 text-red-400 mx-auto" />
              <h2 className="text-lg font-semibold text-red-700 dark:text-red-300" data-testid="text-not-found">
                Link Not Found
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                This verification link is invalid. Please check the URL or contact the organisation that sent it.
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              <Clock className="w-14 h-14 text-amber-400 mx-auto" />
              <h2 className="text-lg font-semibold" data-testid="text-expired">
                Link Expired
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                This verification link has expired. Please contact the organisation to request a new link.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Contact the organisation that invited you
              </div>
            </CardContent>
          </Card>
        )}

        {isAlreadyDone && !isExpired && (
          <DoneState
            returnUrl={completedReturnUrl || session?.returnUrl}
            requestId={completedRequestId}
            sessionId={completedSessionId || session?.sessionId}
          />
        )}

        {session && !isExpired && !isAlreadyDone && (
          <div className="space-y-2">
            {session.organisation && (
              <div className="text-center mb-4">
                <Badge variant="secondary" className="border-0 text-xs" data-testid="badge-org-name">
                  Requested by {session.organisation.name}
                </Badge>
              </div>
            )}

            <StepIndicator currentStepId={STEP_ID_MAP[stepIdx] ?? "consent"} activeSteps={activeSteps} />

            <Card>
              <CardContent className="pt-6 pb-6">
                {stepIdx === 0 && (
                  <ConsentStep
                    session={session}
                    requiredSteps={session.requiredSteps}
                    onAccept={handleConsentAccept}
                    isPending={startMutation.isPending}
                  />
                )}
                {stepIdx === 1 && (
                  <IdentityStep session={session} onNext={handleIdentityNext} />
                )}
                {stepIdx === 2 && (
                  <DocumentsStep token={token!} onNext={handleDocumentsNext} />
                )}
                {stepIdx === 3 && (
                  <SelfieStep onCapture={handleSelfieCapture} />
                )}
                {stepIdx === 4 && (
                  <SubmitStep
                    onComplete={() => completeMutation.mutate()}
                    isPending={completeMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground pt-2">
              Secured by Cellion One · <a href="/privacy" className="hover:underline">Privacy Policy</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
