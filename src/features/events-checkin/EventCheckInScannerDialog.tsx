"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Loader2,
  ScanLine,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { StatusBadge } from "@/components/app/status-badge";
import type { CommunityEvent, EventTicketOrder, AttendeeCheckInStatus } from "@/types/event";
import { Html5Qrcode } from "html5-qrcode";
import {
  parseTicketScanCode,
  validateTicketCheckIn,
} from "./events-checkin-domain";

interface EventCheckInScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CommunityEvent | null;
  bookings: readonly EventTicketOrder[];
  onCheckIn: (
    booking: EventTicketOrder,
    status: AttendeeCheckInStatus,
    options?: {
      incrementQty?: number;
      targetQty?: number;
      reset?: boolean;
      ticketCode?: string;
      seatNumber?: number;
    }
  ) => Promise<void>;
}

interface ScanFeedback {
  tone: "success" | "warning" | "destructive" | "neutral";
  title: string;
  message: string;
  ticketCode?: string;
  guestName?: string;
  timestamp: string;
}

export function EventCheckInScannerDialog({
  isOpen,
  onClose,
  selectedEvent,
  bookings,
  onCheckIn,
}: EventCheckInScannerDialogProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(null);

  // Play synthetic Web Audio API feedback chime
  const playChime = useCallback(
    (isSuccess: boolean) => {
      if (!soundEnabled) return;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(isSuccess ? 880 : 330, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } catch {
        // Audio autoplay restrictions fail silently
      }
    },
    [soundEnabled]
  );

  // Stop camera stream gracefully
  const stopCameraStream = useCallback(async () => {
    if (isStoppingRef.current) return;
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        isStoppingRef.current = true;
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Scanner stop warning:", err);
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
        setIsCameraActive(false);
      }
    } else {
      setIsCameraActive(false);
    }
  }, []);

  // Process ticket verification & check-in
  const processTicket = useCallback(
    async (rawText: string) => {
      const { cleanCode, baseCode, seatNumber } = parseTicketScanCode(rawText);
      const nowStr = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      });

      if (!cleanCode) {
        playChime(false);
        setFeedback({
          tone: "destructive",
          title: "Format QR tidak valid",
          message: "Data pada QR code bukan kode tiket Dago Creative Hub yang sah.",
          timestamp: nowStr,
        });
        return;
      }

      setIsProcessing(true);

      try {
        // Find matching ticket in all bookings
        const booking = bookings.find((b) => {
          const bCode = (b.ticketCode || "").trim().toUpperCase();
          const bId = (b.id || "").trim().toUpperCase();
          return (
            (bCode && (bCode === cleanCode || bCode === baseCode)) ||
            (bId && (bId === cleanCode || bId === baseCode))
          );
        });

        const currentEventId = selectedEvent?.id || "";
        const validation = validateTicketCheckIn(booking || null, currentEventId, seatNumber);

        if (!validation.valid) {
          playChime(false);
          let title = "Pemeriksaan tiket gagal";
          if (validation.code === "NOT_FOUND") title = "Tiket tidak ditemukan";
          else if (validation.code === "WRONG_EVENT") title = "Bukan event ini";
          else if (validation.code === "UNPAID") title = "Tiket belum lunas";
          else if (validation.code === "ALREADY_USED" || validation.code === "SEAT_ALREADY_USED") {
            title = "Tiket sudah digunakan";
          }

          setFeedback({
            tone: validation.code === "ALREADY_USED" ? "warning" : "destructive",
            title,
            message: validation.message || "Validasi tiket gagal.",
            ticketCode: cleanCode,
            guestName: booking?.guestName,
            timestamp: nowStr,
          });
          return;
        }

        if (!booking) return;

        // Perform server check-in
        const targetStatus = validation.targetStatus || "CHECKED_IN";
        await onCheckIn(booking, targetStatus, {
          ticketCode: cleanCode,
          seatNumber,
          incrementQty: 1,
        });

        playChime(true);
        const ticketCount = booking.ticketCount || 1;
        setFeedback({
          tone: "success",
          title: "Check-in dicatat",
          message:
            ticketCount > 1
              ? `Tiket rombongan (${booking.guestName}): ${validation.isComplete ? "Lengkap" : "Sebagian masuk"}`
              : `Tiket ${cleanCode} atas nama ${booking.guestName} berhasil diverifikasi.`,
          ticketCode: cleanCode,
          guestName: booking.guestName,
          timestamp: nowStr,
        });
      } catch (err: unknown) {
        playChime(false);
        const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses tiket.";
        setFeedback({
          tone: "destructive",
          title: "Gagal memproses check-in",
          message: errorMsg,
          timestamp: nowStr,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [bookings, selectedEvent, onCheckIn, playChime]
  );

  // Initialize camera scanner stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsInitializing(true);

    try {
      if (scannerRef.current) {
        await stopCameraStream();
      }

      const elementId = "reader-camera-surface";
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      const qrCodeSuccessCallback = (decodedText: string) => {
        const now = Date.now();
        const clean = decodedText.trim();

        if (
          lastScannedRef.current &&
          lastScannedRef.current.code === clean &&
          now - lastScannedRef.current.timestamp < 2000
        ) {
          return;
        }

        lastScannedRef.current = { code: clean, timestamp: now };
        processTicket(clean);
      };

      await html5QrCode.start(
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        qrCodeSuccessCallback,
        undefined
      );

      setIsCameraActive(true);
    } catch (err: unknown) {
      console.error("Camera start error:", err);
      const msg = err instanceof Error ? err.message : "Tidak dapat mengakses kamera.";
      setCameraError(
        msg.includes("Permission") || msg.includes("NotAllowedError")
          ? "Izin akses kamera ditolak. Berikan izin di browser atau gunakan input manual."
          : "Gagal memulai kamera. Periksa perangkat kamera atau gunakan input manual."
      );
      setIsCameraActive(false);
    } finally {
      setIsInitializing(false);
    }
  }, [facingMode, processTicket, stopCameraStream]);

  // Toggle camera direction
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Watch open state
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startCamera();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopCameraStream();
      setFeedback(null);
      setCameraError(null);
    }
  }, [isOpen, facingMode, startCamera, stopCameraStream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          stopCameraStream();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Kamera Pemindai QR</DialogTitle>
              <DialogDescription className="text-xs">
                {selectedEvent ? selectedEvent.title : "Arahkan kamera ke QR code e-tiket peserta."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Controls Bar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleToggleFacingMode}
                disabled={isInitializing}
                title="Ganti kamera depan/belakang"
              >
                <RefreshCw className={isInitializing ? "animate-spin" : ""} />
                <span>Kamera {facingMode === "environment" ? "Belakang" : "Depan"}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? "Matikan suara notifikasi" : "Nyalakan suara notifikasi"}
              >
                {soundEnabled ? <Volume2 /> : <VolumeX />}
              </Button>
            </div>

            {isCameraActive && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-success animate-pulse" />
                <span>Kamera aktif</span>
              </span>
            )}
          </div>

          {/* Camera Viewport Container */}
          <div className="relative rounded-xl border border-border bg-muted/40 overflow-hidden min-h-[260px] flex items-center justify-center">
            <div id="reader-camera-surface" className="w-full h-full min-h-[260px]" />

            {isInitializing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-4 text-center">
                <Loader2 className="animate-spin text-primary size-6" />
                <p className="text-xs font-medium text-foreground">Menghubungkan kamera...</p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-background/90 p-6 flex flex-col items-center justify-center text-center gap-2">
                <CameraOff className="size-8 text-destructive" />
                <p className="text-xs font-medium text-destructive">{cameraError}</p>
                <Button type="button" size="sm" variant="outline" onClick={startCamera}>
                  <span>Coba lagi</span>
                </Button>
              </div>
            )}
          </div>

          {/* Live Feedback Notification Banner */}
          {feedback && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between">
                <StatusBadge status={feedback.tone}>{feedback.title}</StatusBadge>
                <span className="text-xs text-muted-foreground">{feedback.timestamp}</span>
              </div>
              <p className="text-xs text-foreground font-medium">{feedback.message}</p>
              {feedback.ticketCode && (
                <p className="text-xs text-muted-foreground font-mono">
                  {feedback.ticketCode} {feedback.guestName ? `• ${feedback.guestName}` : ""}
                </p>
              )}
            </div>
          )}

          {/* Fallback Manual Code Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim() && !isProcessing) {
                const code = manualCode;
                setManualCode("");
                processTicket(code);
              }
            }}
            className="flex items-center gap-2 pt-1"
          >
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <ScanLine className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ketik kode manual (mis. DAGO-EVT-...)"
                disabled={isProcessing}
                aria-label="Input kode tiket manual"
              />
            </InputGroup>
            <Button
              type="submit"
              size="default"
              variant="outline"
              disabled={!manualCode.trim() || isProcessing}
            >
              <span>Validasi</span>
            </Button>
          </form>
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="default"
            variant="outline"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="w-full sm:w-auto"
          >
            <span>Tutup kamera</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
