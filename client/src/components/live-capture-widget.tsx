import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle2, RefreshCw, Video, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveCaptureWidgetProps {
  onCapture: (base64ImageDataUrl: string) => void;
  className?: string;
}

type Phase = "idle" | "streaming" | "captured" | "error";

/**
 * LiveCaptureWidget — WebRTC-based liveness selfie capture for identity verification.
 * Opens the user-facing camera, streams live video, and allows the user to take a snapshot.
 * On confirmation the base64-encoded JPEG data URL is passed to `onCapture`.
 */
export function LiveCaptureWidget({ onCapture, className }: LiveCaptureWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  async function startCamera() {
    setCameraError("");
    setCapturedImage(null);
    setPhase("idle");
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
      const msg =
        err?.name === "NotAllowedError"
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
    <div className={cn("space-y-4", className)}>
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

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}
