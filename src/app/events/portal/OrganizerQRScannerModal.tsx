"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Search,
  RefreshCw,
  Ticket,
  Clock,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommunityEvent, EventTicketOrder } from "@/types/event";
import { Html5Qrcode } from "html5-qrcode";

interface OrganizerQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export function OrganizerQRScannerModal({
  isOpen,
  onClose,
  organizerEmail,
  selectedEventId,
  events,
  bookings,
  onCheckInSuccess,
}: OrganizerQRScannerModalProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanResultFeedback | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(null);

  // Play audio beep feedback via Web Audio API (synthetic, reliable, no external audio files required)
  const playBeep = useCallback((isSuccess: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isSuccess ? 880 : 330, ctx.currentTime); // 880Hz (A5) for success, 330Hz (E4) for error
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

  // Gracefully stop camera stream
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

  // Parse scanned QR code content (safe from PII or invalid formatting)
  const parseQRContent = (decodedText: string): { ticketCode: string; eventId?: string } => {
    const trimmed = decodedText.trim();
    // Case 1: JSON payload {"ticketCode":"DAGO-EVT-XXX","eventId":"evt-1"}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.ticketCode) {
          return { ticketCode: String(parsed.ticketCode).trim(), eventId: parsed.eventId };
        }
      } catch {
        // Fallthrough to plain text
      }
    }

    // Case 2: DAGO-CHECKIN:ticketCode:eventId
    if (trimmed.startsWith("DAGO-CHECKIN:")) {
      const parts = trimmed.split(":");
      return {
        ticketCode: parts[1] || "",
        eventId: parts[2] || undefined,
      };
    }

    // Case 3: Raw ticket code e.g. DAGO-EVT-12345
    return { ticketCode: trimmed };
  };

  // Perform server-side check-in validation against /api/events/portal/check-in
  const processCheckIn = useCallback(
    async (rawCode: string) => {
      const { ticketCode, eventId } = parseQRContent(rawCode);
      if (!ticketCode) {
        setFeedback({
          type: "ERROR",
          title: "Format QR Tidak Dikenali",
          message: "Data dalam QR Code ini bukan tiket event DagoEng yang valid.",
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });
        playBeep(false);
        return;
      }

      // Check against current organizer events
      const targetEvent = events.find((e) => e.id === eventId);
      const eventTitle = targetEvent?.title || "Event Komunitas";

      try {
        setIsProcessing(true);
        const res = await fetch("/api/events/portal/check-in", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: organizerEmail,
            ticketCode,
            checkInStatus: "CHECKED_IN",
            incrementQty: 1,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          const errMsg = json.error || "Gagal validasi tiket.";
          playBeep(false);

          if (errMsg.includes("sudah digunakan")) {
            // Find existing booking in memory to display previous check-in context
            const existing = bookings.find(
              (b) => b.ticketCode.toUpperCase() === ticketCode.toUpperCase()
            );
            setFeedback({
              type: "ALREADY_USED",
              title: "Tiket Sudah Digunakan",
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
              title: "Tiket Belum Lunas",
              message:
                "Tiket ini berbayar dan pembayarannya masih PENDING. Peserta belum dapat melakukan check-in sebelum lunas.",
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          } else if (errMsg.includes("CANCELLED")) {
            setFeedback({
              type: "CANCELLED",
              title: "Tiket Dibatalkan",
              message: "Pesanan tiket ini telah dibatalkan dan hak hadir tidak berlaku.",
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          } else if (errMsg.includes("FORBIDDEN")) {
            setFeedback({
              type: "ERROR",
              title: "Akses Ditolak (Bukan Event Anda)",
              message:
                "Tiket ini milik event komunitas lain. Anda hanya berwenang memvalidasi event Anda sendiri.",
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          } else if (errMsg.includes("tidak ditemukan")) {
            setFeedback({
              type: "NOT_FOUND",
              title: "Tiket Tidak Ditemukan",
              message: `Kode tiket "${ticketCode}" tidak terdaftar di sistem. Periksa kembali atau cari di daftar peserta.`,
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          } else {
            setFeedback({
              type: "ERROR",
              title: "Check-in Ditolak",
              message: errMsg,
              ticketCode,
              timestamp: new Date().toLocaleTimeString("id-ID"),
            });
          }
          return;
        }

        // Check-in Success!
        const updatedBooking: EventTicketOrder = json.data;
        playBeep(true);
        setFeedback({
          type: "SUCCESS",
          title: "Check-in Berhasil!",
          message: json.message || "Kehadiran peserta berhasil dicatat.",
          ticketCode: updatedBooking.ticketCode,
          guestName: updatedBooking.guestName,
          eventTitle: updatedBooking.eventTitle || eventTitle,
          checkedInQty: updatedBooking.checkedInQty,
          ticketCount: updatedBooking.ticketCount,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });

        // Notify parent portal to update state table
        onCheckInSuccess(updatedBooking, json.message);
      } catch (err: any) {
        playBeep(false);
        setFeedback({
          type: "ERROR",
          title: "Gangguan Jaringan",
          message: err.message || "Gagal menghubungi server validasi.",
          ticketCode,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [bookings, events, onCheckInSuccess, organizerEmail, playBeep]
  );

  // Initialize and start Html5Qrcode
  const startCameraStream = useCallback(async () => {
    setCameraError(null);
    setIsInitializing(true);

    try {
      // Ensure any existing instance is cleaned up
      await stopCameraStream();

      // Check if secure context
      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        throw new Error(
          "Akses kamera memerlukan koneksi aman (HTTPS). Harap buka aplikasi via HTTPS atau gunakan input manual."
        );
      }

      const readerElement = document.getElementById("dagoeng-camera-reader");
      if (!readerElement) {
        throw new Error("Elemen video scanner belum siap.");
      }

      const html5Qr = new Html5Qrcode("dagoeng-camera-reader");
      scannerRef.current = html5Qr;

      const qrConfig = {
        fps: 12,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      await html5Qr.start(
        { facingMode: "environment" }, // Prefer back camera on mobile phones
        qrConfig,
        (decodedText) => {
          // Cooldown throttling: Ignore same scanned text within 3.5 seconds
          const now = Date.now();
          if (
            lastScannedRef.current &&
            lastScannedRef.current.code === decodedText &&
            now - lastScannedRef.current.timestamp < 3500
          ) {
            return;
          }

          lastScannedRef.current = { code: decodedText, timestamp: now };
          processCheckIn(decodedText);
        },
        () => {
          // Frame scan error callback (silently ignored for smooth scanning)
        }
      );

      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera start error:", err);
      let userFriendlyMessage = "Gagal mengaktifkan kamera perangkat.";

      const errString = String(err?.message || err);
      if (
        errString.includes("NotAllowedError") ||
        errString.includes("Permission denied") ||
        errString.includes("permission")
      ) {
        userFriendlyMessage =
          "Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser Anda, atau gunakan input manual di bawah.";
      } else if (
        errString.includes("NotFoundError") ||
        errString.includes("DevicesNotFoundError")
      ) {
        userFriendlyMessage =
          "Kamera tidak ditemukan pada perangkat ini. Silakan gunakan pencarian kode tiket manual.";
      } else if (errString.includes("NotReadableError")) {
        userFriendlyMessage =
          "Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut dan coba lagi.";
      } else if (err?.message) {
        userFriendlyMessage = err.message;
      }

      setCameraError(userFriendlyMessage);
      setIsCameraActive(false);
    } finally {
      setIsInitializing(false);
    }
  }, [processCheckIn, stopCameraStream]);

  // Handle modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      // Auto start camera with slight delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        startCameraStream();
      }, 250);
      return () => clearTimeout(timer);
    } else {
      stopCameraStream();
      setFeedback(null);
      setCameraError(null);
      setManualCode("");
    }
  }, [isOpen, startCameraStream, stopCameraStream]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processCheckIn(manualCode.trim().toUpperCase());
    setManualCode("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Pemindai QR & Meja Check-In
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Arahkan kamera ke QR e-tiket peserta atau ketik kode booking manual.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Camera Viewport Area */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-square max-h-[280px] sm:max-h-[300px] mx-auto w-full flex items-center justify-center">
            {/* HTML5 QR Container */}
            <div id="dagoeng-camera-reader" className="w-full h-full" />

            {/* Viewfinder Overlay Frame (when camera is active) */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] relative">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-sm" />
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400/40 animate-pulse" />
                </div>
              </div>
            )}

            {/* Loading / Initializing overlay */}
            {isInitializing && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white space-y-2 z-10">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-xs font-semibold">Mengakses kamera belakang...</p>
                <p className="text-[10px] text-slate-400">Harap izinkan akses kamera di browser</p>
              </div>
            )}

            {/* Inactive or Error Overlay */}
            {!isCameraActive && !isInitializing && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-center p-4 space-y-3 z-10">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center">
                  <CameraOff className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-bold text-slate-200">Kamera Sedang Tidak Aktif</p>
                  {cameraError ? (
                    <p className="text-[11px] text-rose-300 leading-tight">{cameraError}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      Klik tombol di bawah untuk mengaktifkan scanner kamera HP.
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={startCameraStream}
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl px-4 py-2 cursor-pointer shadow-md"
                >
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  <span>Aktifkan Kamera</span>
                </Button>
              </div>
            )}
          </div>

          {/* Camera Toggle Button & Status */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center space-x-2">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  isCameraActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"
                }`}
              />
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {isCameraActive ? "Kamera Aktif (Siap Pindai)" : "Kamera Mati"}
              </span>
            </div>
            {isCameraActive && (
              <button
                type="button"
                onClick={stopCameraStream}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Matikan Kamera</span>
              </button>
            )}
          </div>

          {/* Processing Banner */}
          {isProcessing && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex items-center space-x-3 text-indigo-900 dark:text-indigo-200">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
              <div className="text-xs font-semibold">
                Memvalidasi tiket dengan server DagoEng...
              </div>
            </div>
          )}

          {/* Validation Feedback Result Banner */}
          {feedback && !isProcessing && (
            <div
              className={`p-4 rounded-2xl border transition-all animate-in zoom-in-95 duration-150 ${
                feedback.type === "SUCCESS"
                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100"
                  : feedback.type === "ALREADY_USED"
                  ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100"
                  : feedback.type === "UNPAID"
                  ? "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100"
                  : "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100"
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="shrink-0 mt-0.5">
                  {feedback.type === "SUCCESS" ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : feedback.type === "ALREADY_USED" ? (
                    <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  ) : feedback.type === "UNPAID" ? (
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs sm:text-sm">{feedback.title}</h4>
                    <span className="text-[10px] opacity-70 font-mono">{feedback.timestamp}</span>
                  </div>

                  <p className="text-xs leading-relaxed opacity-90">{feedback.message}</p>

                  {/* Context Details if Available */}
                  {(feedback.guestName || feedback.ticketCode) && (
                    <div className="pt-2 mt-2 border-t border-current/10 grid grid-cols-2 gap-2 text-[11px]">
                      {feedback.guestName && (
                        <div>
                          <span className="opacity-60 block text-[10px]">Nama Peserta:</span>
                          <span className="font-bold flex items-center space-x-1">
                            <User className="w-3 h-3 inline mr-1 opacity-70" />
                            {feedback.guestName}
                          </span>
                        </div>
                      )}
                      {feedback.ticketCode && (
                        <div>
                          <span className="opacity-60 block text-[10px]">Kode Tiket:</span>
                          <span className="font-mono font-bold">{feedback.ticketCode}</span>
                        </div>
                      )}
                      {feedback.checkedInQty !== undefined && feedback.ticketCount !== undefined && (
                        <div className="col-span-2">
                          <span className="opacity-60 block text-[10px]">Status Kehadiran Tiket:</span>
                          <span className="font-bold">
                            {feedback.checkedInQty} dari {feedback.ticketCount} Tiket Hadir
                            {feedback.checkedInQty < feedback.ticketCount
                              ? ` (Sisa ${feedback.ticketCount - feedback.checkedInQty} belum masuk)`
                              : " (Semua Hadir Lengkap)"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manual Ticket Code Fallback Input */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Fallback: Input Kode Booking Manual
            </span>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ketik kode (mis: DAGO-EVT-...)"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
                />
              </div>
              <Button
                type="submit"
                disabled={!manualCode.trim() || isProcessing}
                className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-4 rounded-xl cursor-pointer shrink-0 shadow-xs"
              >
                <span>Check-In</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            Tutup Scanner
          </Button>
        </div>
      </div>
    </div>
  );
}
