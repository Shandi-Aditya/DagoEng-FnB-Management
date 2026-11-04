"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  RefreshCw,
  Ticket,
  Clock,
  ShieldCheck,
  User,
  Users,
  QrCode,
  Volume2,
  VolumeX,
  Upload,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommunityEvent, EventTicketOrder, AttendeeCheckInStatus } from "@/types/event";
import { Html5Qrcode } from "html5-qrcode";

interface EventCheckInQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CommunityEvent | null;
  bookings: EventTicketOrder[];
  onCheckIn: (
    booking: EventTicketOrder,
    status: AttendeeCheckInStatus,
    options?: { incrementQty?: number; targetQty?: number; reset?: boolean }
  ) => Promise<void>;
}

interface ScanFeedback {
  type: "SUCCESS" | "ALREADY_USED" | "UNPAID" | "WRONG_EVENT" | "NOT_FOUND" | "ERROR";
  title: string;
  message: string;
  ticketCode?: string;
  guestName?: string;
  ticketCount?: number;
  checkedInQty?: number;
  timestamp: string;
}

export function EventCheckInQRScannerModal({
  isOpen,
  onClose,
  selectedEvent,
  bookings,
  onCheckIn,
}: EventCheckInQRScannerModalProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isStoppingRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(null);

  // Play synthetic Web Audio API feedback chime
  const playChime = useCallback((isSuccess: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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
  }, [soundEnabled]);

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

  // Parse QR content flexibly (raw code, JSON, or URL)
  const parseQR = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj.ticketCode) return String(obj.ticketCode).trim();
      } catch {}
    }
    if (trimmed.startsWith("DAGO-CHECKIN:")) {
      const parts = trimmed.split(":");
      if (parts[1]) return parts[1].trim();
    }
    // Handle URL e.g. /events/tickets/DAGO-EVT-12345
    const match = trimmed.match(/DAGO-EVT-[A-Z0-9-]+/i);
    if (match) return match[0];

    return trimmed;
  };

  // Process ticket verification & check-in
  const processTicket = useCallback(
    async (rawText: string) => {
      const code = parseQR(rawText).toUpperCase();
      if (!code) {
        playChime(false);
        setFeedback({
          type: "ERROR",
          title: "Format QR Tidak Valid",
          message: "Data pada QR code ini bukan kode tiket Dago Creative Hub yang sah.",
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });
        return;
      }

      setIsProcessing(true);

      try {
        // Support individual sub-ticket code (e.g. DAGO-EVT-FIT02-2) or base ticket code
        const matchSeat = code.match(/^(DAGO-EVT-[A-Z0-9]+)-(\d+)$/i);
        const baseCode = matchSeat ? matchSeat[1] : code;
        const requestedSeat = matchSeat ? parseInt(matchSeat[2], 10) : undefined;

        // Find matching ticket in all bookings
        const booking = bookings.find(
          (b) => b.ticketCode.toUpperCase() === code || b.ticketCode.toUpperCase() === baseCode
        );

        if (!booking) {
          playChime(false);
          setFeedback({
            type: "NOT_FOUND",
            title: "Tiket Tidak Ditemukan",
            message: `Kode tiket "${code}" tidak ditemukan pada sistem data pemesanan.`,
            ticketCode: code,
            timestamp: new Date().toLocaleTimeString("id-ID"),
          });
          return;
        }

        // Validate event match
        if (selectedEvent && booking.eventId !== selectedEvent.id) {
          playChime(false);
          setFeedback({
            type: "WRONG_EVENT",
            title: "Bukan Event Ini!",
            message: `Tiket [${code}] terdaftar untuk "${booking.eventTitle || "event lain"}", bukan "${selectedEvent.title}".`,
            ticketCode: code,
            guestName: booking.guestName,
            timestamp: new Date().toLocaleTimeString("id-ID"),
          });
          return;
        }

        // Validate payment status
        if (booking.paymentStatus !== "PAID") {
          playChime(false);
          setFeedback({
            type: "UNPAID",
            title: "Tiket Belum Lunas!",
            message: `Status tiket ini masih ${booking.paymentStatus}. Pembayaran harus berstatus Lunas (PAID) untuk dapat masuk.`,
            ticketCode: code,
            guestName: booking.guestName,
            timestamp: new Date().toLocaleTimeString("id-ID"),
          });
          return;
        }

        const ticketCount = booking.ticketCount || 1;
        const currentChecked =
          typeof booking.checkedInQty === "number"
            ? booking.checkedInQty
            : booking.checkInStatus === "CHECKED_IN"
            ? ticketCount
            : 0;

        // Check if specific sub-ticket has already checked in
        if (requestedSeat !== undefined && ticketCount > 1 && currentChecked >= requestedSeat) {
          playChime(false);
          setFeedback({
            type: "ALREADY_USED",
            title: "Tiket Sudah Digunakan!",
            message: `Tiket #${requestedSeat} milik peserta [${booking.guestName}] sudah melakukan check-in sebelumnya.`,
            ticketCode: code,
            guestName: booking.guestName,
            ticketCount: ticketCount,
            checkedInQty: currentChecked,
            timestamp: new Date().toLocaleTimeString("id-ID"),
          });
          return;
        }

        // Validate already checked in completely
        if (currentChecked >= ticketCount) {
          playChime(false);
          const timeStr = booking.checkInTime
            ? new Date(booking.checkInTime).toLocaleTimeString("id-ID") + " WITA"
            : "sebelumnya";
          setFeedback({
            type: "ALREADY_USED",
            title: "Tiket Sudah Digunakan Lengkap!",
            message: `Seluruh ${ticketCount} tiket milik peserta [${booking.guestName}] sudah selesai check-in pada ${timeStr}. Hindari duplikasi tiket.`,
            ticketCode: code,
            guestName: booking.guestName,
            ticketCount: ticketCount,
            checkedInQty: ticketCount,
            timestamp: new Date().toLocaleTimeString("id-ID"),
          });
          return;
        }

        // Handle Group / Multi-Seat Booking (e.g. 2+ tickets)
        if (ticketCount > 1) {
          const newChecked = currentChecked + 1;
          const isComplete = newChecked >= ticketCount;

          await onCheckIn(booking, isComplete ? "CHECKED_IN" : "PARTIALLY_CHECKED_IN", {
            incrementQty: 1,
          });
          playChime(true);

          setFeedback({
            type: "SUCCESS",
            title: isComplete ? "Check-in Grup Selesai! 🎉" : "Check-in Tiket Grup (+1) ✅",
            message: isComplete
              ? `Seluruh ${ticketCount} tiket milik ${booking.guestName} telah hadir lengkap di venue!`
              : `Kehadiran peserta ke-${newChecked} untuk pemesanan ${booking.guestName} telah diverifikasi. Sisa ${ticketCount - newChecked} tiket belum hadir (teman dapat menyusul menggunakan QR ini).`,
            ticketCode: code,
            guestName: booking.guestName,
            ticketCount: ticketCount,
            checkedInQty: newChecked,
            timestamp: new Date().toLocaleTimeString("id-ID"),
          });
          return;
        }

        // Perform Standard Solo Check-in (1 Ticket)
        await onCheckIn(booking, "CHECKED_IN");
        playChime(true);

        setFeedback({
          type: "SUCCESS",
          title: "Check-in Berhasil! 🎉",
          message: `Selamat datang, ${booking.guestName}! Akses masuk untuk 1 tiket telah diverifikasi.`,
          ticketCode: code,
          guestName: booking.guestName,
          ticketCount: 1,
          checkedInQty: 1,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });
      } catch (err: any) {
        playChime(false);
        setFeedback({
          type: "ERROR",
          title: "Gagal Memproses Check-in",
          message: err.message || "Terjadi kendala saat memperbarui status kehadiran peserta.",
          ticketCode: code,
          timestamp: new Date().toLocaleTimeString("id-ID"),
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [bookings, onCheckIn, playChime, selectedEvent]
  );

  // Start Html5Qrcode Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsInitializing(true);

    try {
      await stopCameraStream();

      const container = document.getElementById("event-checkin-camera-reader");
      if (!container) {
        throw new Error("Wadah kamera belum siap dirender.");
      }

      const html5Qr = new Html5Qrcode("event-checkin-camera-reader", {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false, // Use ZXing software decoder for better detection on smartphone screen glare
        },
        verbose: false,
      });
      scannerRef.current = html5Qr;

      const config = {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(200, Math.floor(minEdge * 0.92));
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      await html5Qr.start(
        { facingMode },
        config,
        (decodedText) => {
          const now = Date.now();
          if (
            lastScannedRef.current &&
            lastScannedRef.current.code === decodedText &&
            now - lastScannedRef.current.timestamp < 3000
          ) {
            return;
          }

          lastScannedRef.current = { code: decodedText, timestamp: now };
          processTicket(decodedText);
        },
        () => {
          // Frame error ignored
        }
      );

      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera scanner error:", err);
      let msg = "Gagal mengaktifkan kamera.";
      const str = String(err?.message || err);
      if (str.includes("NotAllowedError") || str.includes("permission") || str.includes("Permission denied")) {
        msg = "Izin kamera ditolak. Harap izinkan akses kamera di browser Anda atau gunakan input manual.";
      } else if (str.includes("NotFoundError") || str.includes("DevicesNotFoundError")) {
        msg = "Tidak ditemukan kamera pada perangkat ini. Silakan gunakan pencarian tiket atau scanner barcode.";
      } else if (str.includes("NotReadableError")) {
        msg = "Kamera sedang digunakan aplikasi lain. Silakan tutup aplikasi tersebut.";
      } else if (err?.message) {
        msg = err.message;
      }
      setCameraError(msg);
      setIsCameraActive(false);
    } finally {
      setIsInitializing(false);
    }
  }, [facingMode, processTicket, stopCameraStream]);

  // Handle Modal Lifecycle
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        startCamera();
      }, 300);
      return () => {
        document.body.style.overflow = originalStyle;
        clearTimeout(timer);
      };
    } else {
      stopCameraStream();
      setFeedback(null);
      setManualCode("");
    }
  }, [isOpen, facingMode]);

  // Global Escape key listener to close scanner
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        stopCameraStream();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, stopCameraStream]);

  // Toggle Camera Facing Mode
  const toggleCameraDirection = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Scan QR from image file / screenshot
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setCameraError(null);
    try {
      let qrEngine = scannerRef.current;
      if (!qrEngine) {
        qrEngine = new Html5Qrcode("event-checkin-camera-reader");
        scannerRef.current = qrEngine;
      }
      const decoded = await qrEngine.scanFile(file, true);
      if (decoded) {
        await processTicket(decoded);
      }
    } catch (err: any) {
      playChime(false);
      setFeedback({
        type: "ERROR",
        title: "QR Tidak Terbaca dari Gambar",
        message: "Tidak ditemukan kode QR yang jelas pada gambar tersebut. Pastikan gambar tidak buram atau gunakan input manual.",
        timestamp: new Date().toLocaleTimeString("id-ID"),
      });
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processTicket(manualCode.trim());
    setManualCode("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight flex items-center space-x-1.5">
                <span>Scanner QR Kehadiran Peserta</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px] sm:max-w-xs">
                {selectedEvent ? selectedEvent.title : "Semua Event"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={soundEnabled ? "Audio Beep Aktif" : "Audio Beep Senyap"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-[#3B7A57]" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Viewport */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Camera Viewfinder Container */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-h-[300px] sm:max-h-[320px] mx-auto border-2 border-slate-800 flex items-center justify-center shadow-inner">
            <div id="event-checkin-camera-reader" className="w-full h-full" />

            {/* Target Laser Overlay */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-dashed border-emerald-400/80 rounded-2xl relative shadow-lg">
                  {/* Corner Marks */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                  {/* Laser Line */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                </div>
              </div>
            )}

            {/* Loading / Error States */}
            {isInitializing && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white space-y-2 z-10">
                <RefreshCw className="w-7 h-7 text-[#52B788] animate-spin" />
                <p className="text-xs text-slate-300 font-medium">Menghubungkan ke kamera...</p>
              </div>
            )}

            {cameraError && !isCameraActive && (
              <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
                <CameraOff className="w-10 h-10 text-rose-400" />
                <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                <Button
                  size="sm"
                  onClick={startCamera}
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-xs font-bold rounded-xl"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Coba Akses Kamera Lagi
                </Button>
              </div>
            )}
          </div>

          {/* Hidden File Input for QR Image Scan */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Camera Controls Bar & Alternative Image Upload */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
            <div className="flex items-center space-x-2">
              {isCameraActive ? (
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Kamera Aktif</span>
                </span>
              ) : (
                <span className="text-slate-400">Kamera Tidak Aktif</span>
              )}

              {isCameraActive && (
                <button
                  type="button"
                  onClick={toggleCameraDirection}
                  className="font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline ml-2"
                >
                  Ganti ({facingMode === "environment" ? "Belakang" : "Depan"})
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 hover:text-[#3B7A57] dark:hover:text-[#52B788] font-bold py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
              title="Unggah foto atau tangkapan layar e-tiket QR"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              <span>Scan dari File Gambar</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 italic">
            Tips: Jika memindai dari layar HP peserta dan kamera silau/reflektif, posisikan agak miring, gunakan scanner gambar, atau ketik kode tiket di bawah.
          </p>

          {/* Real-time Feedback Card */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-1.5 animate-in slide-in-from-top-2 ${
                feedback.type === "SUCCESS"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100"
                  : feedback.type === "ALREADY_USED"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-sm">
                  {feedback.type === "SUCCESS" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : feedback.type === "ALREADY_USED" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{feedback.title}</span>
                </div>
                <span className="text-[10px] opacity-75 font-mono">{feedback.timestamp}</span>
              </div>

              <p className="text-xs leading-relaxed font-medium">{feedback.message}</p>

              {feedback.ticketCount && feedback.ticketCount > 1 && (
                <div className="pt-1 flex items-center justify-between text-[11px] font-semibold">
                  <span>Kehadiran Tiket Rombongan:</span>
                  <span className="font-mono bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full font-bold">
                    {feedback.checkedInQty ?? feedback.ticketCount} / {feedback.ticketCount} Pax Masuk
                  </span>
                </div>
              )}

              {feedback.guestName && (
                <div className="pt-1.5 border-t border-current/15 flex items-center justify-between text-[11px]">
                  <span>
                    Peserta: <strong>{feedback.guestName}</strong>
                  </span>
                  {feedback.ticketCode && <span className="font-mono font-bold">[{feedback.ticketCode}]</span>}
                </div>
              )}
            </div>
          )}

          {/* Quick Manual / Barcode Gun Input */}
          <form onSubmit={handleManualSubmit} className="pt-2">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Gunakan Barcode Scanner Fisik atau Ketik Kode Tiket:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Contoh: DAGO-EVT-72676"
                disabled={isProcessing}
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-white"
              />
              <Button
                type="submit"
                disabled={!manualCode.trim() || isProcessing}
                className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl px-4"
              >
                {isProcessing ? "Memproses..." : "Check-in"}
              </Button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="text-[11px] text-slate-500">
            Arahkan kamera ke QR Code e-tiket peserta.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700"
          >
            Tutup Scanner
          </Button>
        </div>
      </div>
    </div>
  );
}

