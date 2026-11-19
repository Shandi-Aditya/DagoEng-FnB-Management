"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  RefreshCw,
  Ticket,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { Html5Qrcode } from "html5-qrcode";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import { filterTodayEventsWita } from "@/features/events-checkin/events-checkin-domain";

interface OrganizerQRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizerEmail: string;
  selectedEventId: string;
  events: CommunityEvent[];
  bookings: EventTicketOrder[];
  onCheckInSuccess: (updatedBooking: EventTicketOrder, message: string) => void;
}

interface ScanResultFeedback {
  type: "SUCCESS" | "ALREADY_USED" | "UNPAID" | "CANCELLED" | "NOT_FOUND" | "ERROR";
  title: string;
  message: string;
  ticketCode?: string;
  guestName?: string;
  eventTitle?: string;
  checkedInQty?: number;
  ticketCount?: number;
  timestamp: string;
}

export function OrganizerQRScannerDialog({
  open,
  onOpenChange,
  organizerEmail,
  selectedEventId,
  events,
  bookings,
  onCheckInSuccess,
}: OrganizerQRScannerDialogProps) {
  const todayEvents = filterTodayEventsWita(events.filter((e) => e.status === "APPROVED"));
  const hasTodayEvents = todayEvents.length > 0;
  const [activeEventId, setActiveEventId] = useState<string>(() => {
    if (selectedEventId && todayEvents.some((e) => e.id === selectedEventId)) {
      return selectedEventId;
    }
    return todayEvents[0]?.id || "";
  });

  useEffect(() => {
    if (selectedEventId && todayEvents.some((e) => e.id === selectedEventId)) {
      setActiveEventId(selectedEventId);
    } else if (todayEvents.length > 0 && !todayEvents.some((e) => e.id === activeEventId)) {
      setActiveEventId(todayEvents[0].id);
    }
  }, [selectedEventId, todayEvents, activeEventId]);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanResultFeedback | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const isStoppingRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(null);

  // Play synthetic audio beep feedback
  const playBeep = useCallback((isSuccess: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isSuccess ? 880 : 330, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio playback fails silently if browser policy blocks autoplay before interaction
    }
  }, []);

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

  const parseQRContent = (decodedText: string): { ticketCode: string; eventId?: string } => {
    const trimmed = decodedText.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.ticketCode) {
          return { ticketCode: String(parsed.ticketCode).trim(), eventId: parsed.eventId };
        }
      } catch {
        // Fallthrough
      }
    }

    if (trimmed.startsWith("DAGO-CHECKIN:")) {
      const parts = trimmed.split(":");
      return {
        ticketCode: parts[1] || "",
        eventId: parts[2] || undefined,
      };
    }

    return { ticketCode: trimmed };
  };

  const processCheckIn = useCallback(
    async (rawCode: string) => {
      const { ticketCode, eventId } = parseQRContent(rawCode);
      if (!ticketCode) {
        setFeedback({
          type: "ERROR",
          title: "Format QR tidak dikenali",
          message: "Data dalam QR code ini bukan tiket event DagoEng yang valid.",
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });
        playBeep(false);
        return;
      }

      const targetEvent = events.find((e) => e.id === eventId);
      const matchSeat = ticketCode.match(/^(DAGO-EVT-[A-Z0-9]+)-0*(\d+)$/i);
      const seatNumber = matchSeat ? parseInt(matchSeat[2], 10) : undefined;

      try {
        setIsProcessing(true);
        const res = await fetch("/api/events/portal/check-in", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: organizerEmail,
            ticketCode,
            eventId: eventId || activeEventId,
            checkInStatus: "CHECKED_IN",
            incrementQty: 1,
            seatNumber,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          const errMsg = json.error || "Gagal validasi tiket.";
          playBeep(false);

          if (errMsg.includes("sudah digunakan")) {
            const existing = bookings.find(
              (b) => b.ticketCode.toUpperCase() === ticketCode.toUpperCase()
            );
            setFeedback({
              type: "ALREADY_USED",
              title: "Tiket sudah digunakan",
              message: errMsg,
              ticketCode,
              guestName: existing?.guestName,
              eventTitle: targetEvent?.title || existing?.eventTitle,
              checkedInQty: existing?.ticketCount,
              ticketCount: existing?.ticketCount,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          } else if (errMsg.includes("PENDING") || errMsg.includes("belum diverifikasi lunas")) {
            setFeedback({
              type: "UNPAID",
              title: "Tiket belum lunas",
              message: "Tiket ini berbayar dan belum lunas. Peserta belum dapat check-in.",
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          } else if (errMsg.includes("CANCELLED")) {
            setFeedback({
              type: "CANCELLED",
              title: "Tiket dibatalkan",
              message: "Pesanan tiket ini telah dibatalkan dan hak hadir tidak berlaku.",
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          } else {
            setFeedback({
              type: "NOT_FOUND",
              title: "Tiket tidak ditemukan",
              message: errMsg,
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          }
          return;
        }

        playBeep(true);
        const updatedBooking = (json.data || json.booking) as EventTicketOrder;
        setFeedback({
          type: "SUCCESS",
          title: "Check-in berhasil",
          message: `Tiket ${ticketCode} berhasil divalidasi.`,
          ticketCode: updatedBooking.ticketCode,
          guestName: updatedBooking.guestName,
          eventTitle: updatedBooking.eventTitle,
          checkedInQty: updatedBooking.checkedInQty ?? updatedBooking.ticketCount,
          ticketCount: updatedBooking.ticketCount,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });

        onCheckInSuccess(updatedBooking, `Check-in berhasil untuk ${updatedBooking.guestName}`);
      } catch (err: unknown) {
        playBeep(false);
        setFeedback({
          type: "ERROR",
          title: "Gangguan koneksi",
          message: err instanceof Error ? err.message : "Gagal memproses check-in ke server.",
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [events, bookings, organizerEmail, activeEventId, onCheckInSuccess, playBeep]
  );

  const startCameraStream = useCallback(async () => {
    setCameraError(null);
    setIsInitializing(true);

    try {
      const container = document.getElementById("portal-qr-scanner-viewport");
      if (!container) return;

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("portal-qr-scanner-viewport");
      }

      const qrCodeSuccessCallback = (decodedText: string) => {
        const now = Date.now();
        if (
          lastScannedRef.current &&
          lastScannedRef.current.code === decodedText &&
          now - lastScannedRef.current.timestamp < 3000
        ) {
          return;
        }
        lastScannedRef.current = { code: decodedText, timestamp: now };
        processCheckIn(decodedText);
      };

      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        qrCodeSuccessCallback,
        undefined
      );

      setIsCameraActive(true);
    } catch (err: unknown) {
      const errString = String(err);
      let userFriendlyMessage = "Tidak dapat mengakses kamera perangkat.";
      if (errString.includes("NotAllowedError") || errString.includes("permission")) {
        userFriendlyMessage = "Izin kamera ditolak di pengaturan browser Anda.";
      } else if (errString.includes("NotFoundError")) {
        userFriendlyMessage = "Kamera tidak ditemukan pada perangkat ini.";
      }
      setCameraError(userFriendlyMessage);
      setIsCameraActive(false);
    } finally {
      setIsInitializing(false);
    }
  }, [processCheckIn]);

  useEffect(() => {
    if (open && hasTodayEvents) {
      const timer = setTimeout(() => {
        startCameraStream();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopCameraStream();
      setFeedback(null);
      setCameraError(null);
      setManualCode("");
    }
  }, [open, hasTodayEvents, startCameraStream, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    setManualCode("");
    if (!clean) return;
    processCheckIn(clean);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Camera className="size-5 text-primary" />
            <DialogTitle className="text-base font-medium">
              Check-in peserta
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Arahkan kamera ke QR tiket, atau ketik kode tiket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {!hasTodayEvents ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-xs text-warning space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Meja check-in belum dibuka</span>
              </div>
              <p className="text-foreground">
                Meja check-in hanya aktif pada hari pelaksanaan event (WITA). Saat ini tidak ada event Anda yang berlangsung hari ini.
              </p>
            </div>
          ) : (
            <>
              {todayEvents.length > 1 && (
                <div className="space-y-1.5 pb-2 border-b">
                  <label className="text-xs font-medium text-foreground block">
                    Pilih event hari ini (WITA):
                  </label>
                  <select
                    value={activeEventId}
                    onChange={(e) => setActiveEventId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    {todayEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Camera Viewport */}
          <div className="relative rounded-lg border bg-black/90 aspect-square max-h-[260px] mx-auto w-full flex items-center justify-center overflow-hidden">
            <div id="portal-qr-scanner-viewport" className="w-full h-full" />

            {!isCameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white/80 space-y-2 bg-black/80">
                {isInitializing ? (
                  <>
                    <RefreshCw className="size-6 animate-spin text-primary" />
                    <span className="text-xs">Mengaktifkan kamera...</span>
                  </>
                ) : (
                  <>
                    <CameraOff className="size-8 text-white/50" />
                    <span className="text-xs text-white/70">
                      {cameraError || "Kamera tidak aktif"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startCameraStream}
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      Coba nyalakan kamera
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Feedback Result Alert */}
          {feedback && (
            <div
              className={`rounded-lg border p-3.5 space-y-1.5 ${
                feedback.type === "SUCCESS"
                  ? "border-success/40 bg-success/10 text-success"
                  : feedback.type === "ALREADY_USED"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {feedback.type === "SUCCESS" ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0" />
                )}
                <span>{feedback.title}</span>
                <span className="text-muted-foreground font-mono ml-auto text-xs">
                  {feedback.timestamp}
                </span>
              </div>
              <p className="text-foreground leading-relaxed">
                {feedback.message}
              </p>
              {feedback.guestName && (
                <div className="text-xs text-foreground font-medium pt-1">
                  Peserta: {feedback.guestName} &bull; {feedback.ticketCode}
                </div>
              )}
            </div>
          )}

              {/* Manual Input Form */}
              <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t">
                <label className="font-medium text-foreground block">
                  Input kode tiket manual
                </label>
                <div className="flex gap-2">
                  <input
                    ref={manualInputRef}
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Contoh: DAGO-EVT-XXXXX"
                    disabled={isProcessing}
                    className="flex-1 h-9 rounded-md border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                  />
                  <Button type="submit" size="sm" disabled={isProcessing || !manualCode.trim()}>
                    {isProcessing ? <RefreshCw className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                    <span>Verifikasi</span>
                  </Button>
                </div>
              </form>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
