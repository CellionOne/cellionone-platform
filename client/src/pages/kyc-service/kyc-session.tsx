import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Shield, CheckCircle2, XCircle, Clock, ChevronRight,
  User, FileText, Camera, AlertTriangle, ExternalLink, Mail,
  RefreshCw, Video,
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
  organisation: { name: string; logoPath: string | null } | null;
  returnUrl?: string;
};

type IdentityData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

const STEPS = [
  { id: "consent", label: "Consent", icon: Shield },
  { id: "identity", label: "Identity", icon: User },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "selfie", label: "Selfie", icon: Camera },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < currentStep;
        const active = idx === currentStep;
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
            {idx < STEPS.length - 1 && (
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

function ConsentStep({ session, onAccept, isPending }: {
  session: SessionData;
  onAccept: () => void;
  isPending: boolean;
}) {
  const [agreed, setAgreed] = useState(false);

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

      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold">What we'll collect</p>
          <ul className="space-y-2">
            {[
              { icon: User, text: "Your personal details (name, date of birth)" },
              { icon: FileText, text: "Government-issued ID document" },
              { icon: Camera, text: "A liveness selfie for biometric matching" },
            ].map(({ icon: Icon, text }) => (
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

function DocumentsStep({ onNext }: { onNext: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("national_id");
  const [error, setError] = useState("");

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

  function handleNext() {
    if (!file) {
      setError("Please upload your document");
      return;
    }
    onNext();
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

      <Button className="w-full" onClick={handleNext} data-testid="button-next-documents">
        Continue
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

function SelfieStep({ onCapture }: { onCapture: (base64: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<"idle" | "streaming" | "captured" | "error">("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  async function startCamera() {
    setCameraError("");
    setPhase("idle");
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("streaming");
    } catch (err: any) {
      const msg = err?.name === "NotAllowedError"
        ? "Camera access was denied. Please allow camera access and try again."
        : err?.name === "NotFoundError"
          ? "No camera found on this device."
          : "Could not start camera. Please try again.";
      setCameraError(msg);
      setPhase("error");
    }
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    setPhase("captured");
    stopStream();
  }

  function retake() {
    setCapturedImage(null);
    startCamera();
  }

  function confirm() {
    if (capturedImage) onCapture(capturedImage);
  }

  return (
    <div className="space-y-5" data-testid="step-selfie">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Liveness Selfie</h2>
        <p className="text-sm text-muted-foreground">
          Take a clear selfie to verify your identity against your document
        </p>
      </div>

      {phase === "idle" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-2 text-left">
              <p className="text-sm font-semibold">Before you take your selfie:</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  Face the camera directly and stay still
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  Remove glasses or hats if wearing them
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  Ensure good lighting — no shadows on your face
                </li>
              </ul>
            </CardContent>
          </Card>
          <Button className="w-full" onClick={startCamera} data-testid="button-start-camera">
            <Video className="h-4 w-4 mr-2" />
            Start Camera
          </Button>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Camera not available</p>
              <p className="text-xs text-red-600 dark:text-red-500">{cameraError}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={startCamera} data-testid="button-retry-camera">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}

      {phase === "streaming" && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-border">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
              data-testid="video-selfie-preview"
            />
            <div className="absolute inset-0 border-4 border-primary/30 rounded-xl pointer-events-none" />
            <div className="absolute top-3 left-3">
              <Badge className="text-xs bg-red-500 text-white border-0 animate-pulse">
                ● LIVE
              </Badge>
            </div>
          </div>
          <Button className="w-full" onClick={capture} data-testid="button-capture-selfie">
            <Camera className="h-4 w-4 mr-2" />
            Take Photo
          </Button>
        </div>
      )}

      {phase === "captured" && capturedImage && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-black">
            <img
              src={capturedImage}
              alt="Captured selfie"
              className="w-full h-full object-cover"
              data-testid="img-captured-selfie"
            />
            <div className="absolute top-3 right-3">
              <Badge className="text-xs bg-green-500 text-white border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Captured
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={retake} data-testid="button-retake-selfie">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button onClick={confirm} data-testid="button-confirm-selfie">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Use This Photo
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
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

export default function KycSessionPage() {
  const { token } = useParams<{ token: string }>();
  const [stepIdx, setStepIdx] = useState(0);
  const [identityData, setIdentityData] = useState<IdentityData | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [completedRequestId, setCompletedRequestId] = useState<number | undefined>();
  const [completedReturnUrl, setCompletedReturnUrl] = useState<string | undefined>();
  const [completedSessionId, setCompletedSessionId] = useState<number | undefined>();

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

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/kyc-service/sessions/${token}/start`),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/kyc-service/sessions/${token}/complete`, {
      firstName: identityData?.firstName,
      lastName: identityData?.lastName,
      dateOfBirth: identityData?.dateOfBirth,
      selfieBase64: selfieBase64,
    }),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      setCompletedRequestId(data.verificationRequestId);
      setCompletedReturnUrl(data.returnUrl || session?.returnUrl || undefined);
      setCompletedSessionId(session?.sessionId);
      setStepIdx(5);
    },
  });

  function handleConsentAccept() {
    startMutation.mutate(undefined, {
      onSuccess: () => setStepIdx(1),
    });
  }

  function handleIdentityNext(data: IdentityData) {
    setIdentityData(data);
    setStepIdx(2);
  }

  function handleDocumentsNext() {
    setStepIdx(3);
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
  const isExpired = sessionError?.status === 410 || session?.status === "expired";
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

            <StepIndicator currentStep={stepIdx} />

            <Card>
              <CardContent className="pt-6 pb-6">
                {stepIdx === 0 && (
                  <ConsentStep
                    session={session}
                    onAccept={handleConsentAccept}
                    isPending={startMutation.isPending}
                  />
                )}
                {stepIdx === 1 && (
                  <IdentityStep session={session} onNext={handleIdentityNext} />
                )}
                {stepIdx === 2 && (
                  <DocumentsStep onNext={handleDocumentsNext} />
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
