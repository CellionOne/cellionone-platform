import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  label?: string;
  required?: boolean;
  existingSignature?: string;
  readOnly?: boolean;
}

export function SignaturePad({
  onSave,
  onClear,
  width = 400,
  height = 150,
  label = "Signature",
  required = false,
  existingSignature,
  readOnly = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!existingSignature);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // White background (CAC requirement)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (existingSignature && readOnly) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = existingSignature;
    } else {
      // "Sign here" placeholder line
      ctx.save();
      ctx.strokeStyle = "#d1d5db";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(20, canvas.height - 30);
      ctx.lineTo(canvas.width - 20, canvas.height - 30);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "#9ca3af";
      ctx.font = "13px sans-serif";
      ctx.fillText("Sign here", 20, canvas.height - 12);
      ctx.restore();
    }
  }, [existingSignature, readOnly]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = getCtx()!;

    if (isEmpty) {
      // Clear placeholder on first stroke
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      setIsEmpty(false);
    }

    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    lastPos.current = pos;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = getCtx()!;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDrawing = () => setIsDrawing(false);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initCanvas();
    setIsEmpty(true);
    onClear?.();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </p>
      )}
      <div
        className="rounded-lg border-2 border-input shadow-sm overflow-hidden"
        style={{ width: "100%", maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: "100%", display: "block", touchAction: "none", cursor: readOnly ? "default" : "crosshair", backgroundColor: "#fff" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={isEmpty}>
            Save Signature
          </Button>
        </div>
      )}
    </div>
  );
}
