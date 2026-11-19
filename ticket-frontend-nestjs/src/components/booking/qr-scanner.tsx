"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, SwitchCamera, Volume2, VolumeX } from "lucide-react";

interface QrScannerProps {
  onScan: (data: string) => void;
  enabled?: boolean;
  className?: string;
}

export default function QrScanner({ onScan, enabled = true, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef(0);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanLine, setScanLine] = useState(0);

  const beepRef = useRef<AudioContext | null>(null);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!beepRef.current) {
        beepRef.current = new AudioContext();
      }
      const ctx = beepRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio not supported
    }
  }, [soundEnabled]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
      }
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access."
          : "Could not access camera. Make sure no other app is using it."
      );
    }
  }, [facingMode]);

  // BarcodeDetector API scan loop
  useEffect(() => {
    if (!isActive || !enabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let detector: any = null;

    // Try BarcodeDetector API (Chrome, Edge, Safari)
    if ("BarcodeDetector" in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
      } catch {
        // fallback
      }
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let linePos = 0;

    const scan = async () => {
      if (!video.videoWidth || !video.videoHeight) {
        animFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Animate scan line
      linePos = (linePos + 2) % canvas.height;
      setScanLine(linePos / canvas.height * 100);

      const now = Date.now();
      // Debounce: don't scan same code within 3 seconds
      if (now - lastScanTimeRef.current < 1500) {
        animFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      if (detector) {
        try {
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code && code !== lastScannedRef.current) {
              lastScannedRef.current = code;
              lastScanTimeRef.current = now;
              playBeep();
              onScan(code);
            }
          }
        } catch {
          // detection failed, continue
        }
      }

      animFrameRef.current = requestAnimationFrame(scan);
    };

    animFrameRef.current = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isActive, enabled, onScan, playBeep]);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (beepRef.current) {
        beepRef.current.close().catch(() => {});
      }
    };
  }, [stopCamera]);

  const toggleCamera = useCallback(() => {
    if (isActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [isActive, stopCamera, startCamera]);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    if (isActive) {
      stopCamera();
      // Restart with new facing mode after a brief delay
      setTimeout(() => startCamera(), 200);
    }
  }, [isActive, stopCamera, startCamera]);

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay */}
        {isActive && (
          <>
            {/* Corner markers */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[15%] left-[15%] w-12 h-12 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-[15%] right-[15%] w-12 h-12 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-[15%] left-[15%] w-12 h-12 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-[15%] right-[15%] w-12 h-12 border-b-3 border-r-3 border-emerald-400 rounded-br-lg" />
            </div>
            {/* Scan line */}
            <div
              className="absolute left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent transition-all pointer-events-none"
              style={{ top: `${15 + scanLine * 0.7}%`, opacity: 0.8 }}
            />
            {/* Dim outside scan area */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 right-0 h-[15%] bg-black/40" />
              <div className="absolute bottom-0 left-0 right-0 h-[15%] bg-black/40" />
              <div className="absolute top-[15%] bottom-[15%] left-0 w-[15%] bg-black/40" />
              <div className="absolute top-[15%] bottom-[15%] right-0 w-[15%] bg-black/40" />
            </div>
          </>
        )}

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 gap-3">
            <Camera className="h-12 w-12 text-slate-400" />
            <p className="text-sm text-slate-400">
              {error || "Click to start camera"}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mt-3">
        <Button
          variant={isActive ? "destructive" : "default"}
          size="sm"
          onClick={toggleCamera}
          className="gap-1.5"
        >
          {isActive ? (
            <>
              <CameraOff className="h-4 w-4" /> Stop Camera
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" /> Start Camera
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={switchCamera}
          disabled={!isActive}
          className="gap-1.5"
        >
          <SwitchCamera className="h-4 w-4" /> Flip
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="gap-1.5"
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-500 text-center mt-2">{error}</p>
      )}
    </div>
  );
}
