"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Calendar,
  Mail,
  User,
  Clock,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function ActivationFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [organizerInfo, setOrganizerInfo] = useState<{
    name: string;
    category: string;
    contactPerson: string;
    email: string;
  } | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setValidationError("Tautan aktivasi tidak valid. Parameter token tidak ditemukan pada URL.");
      return;
    }

    async function checkToken() {
      try {
        const res = await fetch(`/api/events/auth/activate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setOrganizerInfo(data.data.organizer);
          setExpiresAt(data.data.expiresAt);
          setValidationError(null);
        } else {
          setValidationError(data.error || "Tautan aktivasi tidak valid atau telah kedaluwarsa.");
        }
      } catch {
        setValidationError("Gagal menghubungi server untuk memvalidasi token aktivasi.");
      } finally {
        setIsLoading(false);
      }
    }

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password wajib memiliki minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Konfirmasi password tidak cocok dengan password baru.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/events/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
      } else {
        setFormError(data.error || "Aktivasi gagal. Silakan coba kembali.");
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan saat aktivasi akun.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-10 h-10 border-4 border-[#3B7A57] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Memvalidasi token aktivasi akun Anda...
        </p>
      </div>
    );
  }

  // 2. Success State
  if (isSuccess) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-8 sm:p-10 shadow-xl max-w-lg mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/70 text-[#3B7A57] dark:text-[#52B788] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Aktivasi Berhasil</span>
        </span>

        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">
          Selamat Datang di DAGO!
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Akun penyelenggara Anda ({organizerInfo?.name}) telah aktif. Kredensial telah diamankan dan Anda dapat langsung masuk ke portal.
        </p>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-6 text-left border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Email Login Terdaftar:</div>
          <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 break-all">
            {organizerInfo?.email}
          </div>
        </div>

        <Link href="/login" className="block">
          <Button
            type="button"
            className="w-full bg-[#3B7A57] hover:bg-[#2D5F43] text-white font-bold h-12 rounded-xl text-sm shadow-md shadow-emerald-900/10 transition-all flex items-center justify-center space-x-2"
          >
            <span>Masuk ke Halaman Login</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  // 3. Invalid or Expired Token State
  if (validationError) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-8 sm:p-10 shadow-xl max-w-lg mx-auto text-center">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <AlertTriangle className="w-9 h-9" />
        </div>

        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 mb-3">
          Tautan Tidak Berlaku
        </span>

        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3">
          Tidak Dapat Mengaktifkan Akun
        </h2>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          {validationError}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/login" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl text-xs font-bold border-slate-300 dark:border-slate-700"
            >
              <LogIn className="w-4 h-4 mr-1.5" />
              <span>Ke Halaman Login</span>
            </Button>
          </Link>
          <Link href="/events" className="flex-1">
            <Button
              className="w-full h-11 rounded-xl text-xs font-bold bg-[#3B7A57] hover:bg-[#2D5F43] text-white"
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              <span>Jelajahi Event</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Form State (Valid Token)
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl max-w-lg mx-auto">
      {/* Header Info */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/70 text-[#3B7A57] dark:text-[#52B788] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <span className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-2">
          Aktivasi Akun Penyelenggara
        </span>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
          Buat Password Anda
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Daftarkan password mandiri untuk mengakses Portal Penyelenggara Event DAGO.
        </p>
      </div>

      {/* Organizer Summary Card */}
      {organizerInfo && (
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-4 mb-6 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#3B7A57]" />
              <span>Komunitas:</span>
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {organizerInfo.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-[#3B7A57]" />
              <span>Penanggung Jawab:</span>
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {organizerInfo.contactPerson}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5 text-[#3B7A57]" />
              <span>Email Akun:</span>
            </span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {organizerInfo.email}
            </span>
          </div>
          {expiresAt && (
            <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/30 text-[10px] text-slate-400">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Masa Berlaku Tautan:</span>
              </span>
              <span>48 Jam sejak penerbitan</span>
            </div>
          )}
        </div>
      )}

      {/* Error Alert */}
      {formError && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* Password Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Password Baru *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Konfirmasi Password *
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang password"
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 pr-10 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#3B7A57] text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || password.length < 8}
            className="w-full bg-[#3B7A57] hover:bg-[#2D5F43] disabled:opacity-50 text-white font-bold h-11 rounded-xl text-sm shadow-md shadow-emerald-900/10 transition-all flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <span>Mengaktifkan Akun...</span>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-1.5" />
                <span>Aktifkan Akun & Buat Password</span>
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[11px] text-slate-400">
          Sudah memiliki password?{" "}
          <Link href="/login" className="font-bold text-[#3B7A57] hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ActivateOrganizerPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-[#3B7A57] to-[#52B788] flex items-center justify-center shadow-lg shadow-emerald-900/20 text-white font-black text-xl">
            D
          </div>
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            DAGO<span className="text-[#3B7A57]">.hub</span>
          </span>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-[#3B7A57] border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <ActivationFormContent />
      </Suspense>
    </div>
  );
}
