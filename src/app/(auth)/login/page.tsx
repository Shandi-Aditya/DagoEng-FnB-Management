"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, DEMO_PERSONAS, PersonaKey } from "@/contexts/AuthContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  Lock,
  Mail,
  ArrowRight,
  Phone,
  User,
  ArrowLeft,
  Sparkles,
  Zap,
  AlertCircle,
  Ticket,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";

/**
 * Strictly sanitizes returnTo parameter to prevent open-redirect vulnerabilities.
 * Only allows relative application paths beginning with "/" (and strictly rejects "//", "/\", absolute URLs with protocols, or backslash manipulation).
 */
function sanitizeReturnTo(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":") &&
    !trimmed.includes("\\")
  ) {
    return trimmed;
  }
  return null;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginCustomer } = useAuth();
  const { getOrCreateMember } = useLoyalty();

  const fromParam = searchParams.get("from");
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo") || searchParams.get("redirect"));
  const initialMode = searchParams.get("mode");

  const isFromEvents = fromParam === "events" || returnTo?.startsWith("/events");

  // Determine back navigation link explicitly based on source context.
  // NEVER send the visitor to returnTo (which may be a protected destination) on cancel/back!
  const backHref = isFromEvents ? "/events" : "/";
  const backLabel = isFromEvents ? "Kembali ke Event Marketplace" : "Kembali ke Beranda";

  // Form Mode: Universal Login (default) or Register
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Universal Login Credentials
  const [email, setEmail] = useState("owner.dago@dagoeng.com");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Customer Register Form States
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  useEffect(() => {
    if (initialMode === "register") {
      setIsRegisterMode(true);
    }
  }, [initialMode]);

  /**
   * Universal Login Handler with Backend Role Auto-Detection & Safe Auto-Routing
   */
  const handleUniversalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Gagal masuk. Periksa kembali email dan password Anda.");
        setIsLoading(false);
        return;
      }

      // Synchronize client authentication context with the verified identity
      await login(data.personaKey, data.user);
      setIsLoading(false);

      // Auto-routing destination determination
      let targetDestination = data.redirectUrl || "/dashboard";

      // If safe returnTo parameter exists, validate RBAC boundaries before redirecting:
      if (returnTo) {
        const userRole = data.user?.role?.slug || data.user?.role;
        const isCustomer = userRole === "CUSTOMER";
        const isRestrictedAdminRoute =
          returnTo.startsWith("/dashboard") ||
          returnTo.startsWith("/events-admin") ||
          returnTo.startsWith("/events/checkin") ||
          returnTo.startsWith("/events/portal") ||
          returnTo.startsWith("/settings") ||
          returnTo.startsWith("/reports") ||
          returnTo.startsWith("/employees") ||
          returnTo.startsWith("/commercial") ||
          returnTo.startsWith("/coworking") ||
          returnTo.startsWith("/kitchen") ||
          returnTo.startsWith("/pos") ||
          returnTo.startsWith("/waiter") ||
          returnTo.startsWith("/tables") ||
          returnTo.startsWith("/inventory") ||
          returnTo.startsWith("/customers") ||
          returnTo.startsWith("/activity-log");

        if (isCustomer && isRestrictedAdminRoute) {
          // Fallback to customer portal to prevent unauthorized access attempt
          targetDestination = "/customer";
        } else {
          targetDestination = returnTo;
        }
      }

      router.push(targetDestination);
    } catch (err: any) {
      console.error("Universal login error:", err);
      setErrorMessage("Terjadi kendala jaringan saat menghubungi server autentikasi.");
      setIsLoading(false);
    }
  };

  /**
   * New Member Registration Handler
   */
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPhone.trim()) {
      setErrorMessage("Nomor telepon/WhatsApp wajib diisi.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const cleanPhone = regPhone.trim();
      const cleanEmail = regEmail.trim() || `${cleanPhone.replace(/[^0-9]/g, "")}@customer.dagoeng.com`;

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim() || "Pelanggan Member",
          email: cleanEmail,
          phone: cleanPhone,
          password: regPassword || "Password123!",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Pendaftaran gagal. Periksa kembali data Anda.");
        setIsLoading(false);
        return;
      }

      // Initialize loyalty member
      const member = getOrCreateMember({
        name: data.user.name,
        phone: data.user.phone,
        email: data.user.email,
        initialPoints: 50,
      });

      await loginCustomer({
        name: member.name,
        phone: member.phone,
        email: member.email,
      });

      setIsLoading(false);

      if (returnTo) {
        router.push(returnTo);
      } else {
        router.push("/customer");
      }
    } catch (err: any) {
      console.error("Customer registration error:", err);
      setErrorMessage("Terjadi kendala jaringan saat memproses pendaftaran.");
      setIsLoading(false);
    }
  };

  /**
   * Quick Testing Demo Handler (executes official backend authentication for verification)
   */
  const handleQuickLogin = async (personaKey: PersonaKey) => {
    const target = DEMO_PERSONAS[personaKey];
    if (target) {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: target.email, password: "Password123!" }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMessage(data.error || "Akun demo tidak dapat diakses.");
          setIsLoading(false);
          return;
        }

        await login(personaKey, data.user);
        setIsLoading(false);

        if (returnTo) {
          router.push(returnTo);
          return;
        }

        router.push(data.redirectUrl || "/dashboard");
      } catch (err) {
        // Fallback for offline isolated test environments
        await login(personaKey);
        setIsLoading(false);
        if (returnTo) router.push(returnTo);
        else router.push("/dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-[#3B7A57] selection:text-white transition-colors duration-300">

      {/* Dynamic Ambient Background Glows matching Sage Green Design System */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-[#52B788]/15 dark:bg-[#52B788]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 -left-20 w-96 h-96 bg-[#3B7A57]/15 dark:bg-[#3B7A57]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Decorative Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#0000000a_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-md space-y-5 relative z-10">

        {/* Top Back Navigation Bar & Theme Toggle */}
        <div className="flex items-center justify-between px-1">
          <Link
            href={backHref}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white backdrop-blur-md shadow-xs transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
            <span>{backLabel}</span>
          </Link>

          <div className="flex items-center space-x-2">
            {returnTo && (
              <span className="text-[10px] bg-[#3B7A57]/10 dark:bg-[#52B788]/20 text-[#3B7A57] dark:text-[#52B788] font-bold px-2.5 py-1 rounded-full border border-[#3B7A57]/20 dark:border-[#52B788]/30">
                Tujuan: {returnTo}
              </span>
            )}
            <ThemeToggle variant="pill" />
          </div>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2.5 pt-2">
          <Link href="/" className="inline-block group">
            <div className="w-16 h-18 relative mx-auto transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_8px_20px_rgba(59,122,87,0.25)]">
              <Image
                src="/logo-dago.png"
                alt="DagoEng Creative Hub Logo"
                width={64}
                height={72}
                priority
                className="object-contain"
              />
            </div>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              DagoEng <span className="text-[#3B7A57] dark:text-[#52B788]">Platform</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              Sistem Terpadu F&B, Co-working, Event Marketplace & CRM
            </p>
          </div>
        </div>

        {/* Event Ticket Assistance Card - Context-Aware Alternative for Guest Visitors */}
        {isFromEvents && (
          <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-3xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-[#3B7A57] dark:bg-[#52B788] text-white dark:text-slate-900 shrink-0 mt-0.5 shadow-xs">
                <Ticket className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Akses Tiket Event Marketplace
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Login diperlukan untuk tiket yang terhubung resmi dengan akun Anda. Jika Anda memesan tiket sebagai <strong>Guest</strong> tanpa akun, silakan gunakan pencarian tiket tamu.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-500/20">
              <Link
                href="/events/tickets/recovery"
                className="inline-flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-800 dark:text-slate-200 transition-colors shadow-2xs"
              >
                <Search className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                <span>Cari Tiket Pesanan Guest</span>
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-[#3B7A57]/10 dark:bg-[#52B788]/20 hover:bg-[#3B7A57]/20 text-[11px] font-bold text-[#3B7A57] dark:text-[#52B788] transition-colors"
              >
                <span>Jelajahi Event</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Main Glassmorphic Universal Login Card */}
        <div className="bg-white dark:bg-[#131B2B] backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-xl dark:shadow-2xl overflow-hidden transition-colors">

          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/5 space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>
                {isRegisterMode ? "Daftar Member Baru DagoEng" : "Masuk ke Akun DagoEng"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isRegisterMode
                ? "Dapatkan langsung 50 Poin Selamat Datang dan promo eksklusif member DagoEng."
                : "Satu form login universal untuk seluruh akun (Owner, Manajer, Kasir, Mitra Tenant, Organizer & Member)."}
            </p>
          </div>

          <div className="p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {!isRegisterMode ? (
              /* Universal Login Form */
              <form onSubmit={handleUniversalLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Alamat Email Akun
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="nama@bisnis.com atau nama@gmail.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 cursor-pointer"
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-md shadow-[#3B7A57]/20 border border-[#52B788]/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>{isLoading ? "Memverifikasi Kredensial..." : "Masuk ke Sistem"}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>

                <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  <span>Belum memiliki akun member? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setIsRegisterMode(true);
                    }}
                    className="font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline cursor-pointer"
                  >
                    Daftar Member Baru (+50 Poin)
                  </button>
                </div>
              </form>
            ) : (
              /* New Member Registration Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="Contoh: Ketut Dian"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nomor WhatsApp / HP</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="+62 819-xxxx-xxxx"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="email@anda.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 cursor-pointer"
                      aria-label={showRegPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-xs font-bold space-x-1.5 mt-2 bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-md shadow-[#3B7A57]/20 border border-[#52B788]/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isLoading ? "Mendaftarkan..." : "Daftar & Klaim 50 Poin"}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>

                <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  <span>Sudah memiliki akun? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setIsRegisterMode(false);
                    }}
                    className="font-bold text-[#3B7A57] dark:text-[#52B788] hover:underline cursor-pointer"
                  >
                    Masuk di sini
                  </button>
                </div>
              </form>
            )}

            {/* Quick Testing Demo Section (QA & Evaluator Testing Suite) */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                <span>Akses Cepat Testing Demo (QA & Evaluasi Auto-Routing):</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Pilih persona untuk menguji autentikasi resmi dan auto-detection routing sesuai role akun:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("DAGO_OWNER")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">🏢 Owner Dago Hub</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /dashboard</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("SUPER_ADMIN")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">🛡️ Super Admin</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /dashboard</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("TENANT_OWNER_KS")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">☕ Mitra: Kopi Senja</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /dashboard (Mitra)</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("COWORK_MANAGER")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">💻 Manager Coworking</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /coworking</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CASHIER_SGR")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">💵 Kasir POS (Singaraja)</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /pos</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("KITCHEN_SGR")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">👨‍🍳 Chef Dapur (KDS)</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /kitchen</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("WAITER_SGR")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">🤵 Waiter Floor</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /waiter</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CUSTOMER_DEMO")}
                  className="p-2.5 text-left bg-[#3B7A57]/10 dark:bg-[#52B788]/15 hover:bg-[#3B7A57] hover:text-white border border-[#3B7A57]/30 dark:border-[#52B788]/30 rounded-xl font-bold text-[11px] text-[#3B7A57] dark:text-[#52B788] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">📱 Pelanggan / Member</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /customer</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("COMMUNITY_BARISTA")}
                  className="p-2.5 text-left bg-emerald-50 dark:bg-emerald-950/30 hover:bg-[#3B7A57] hover:text-white border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl font-bold text-[11px] text-[#3B7A57] dark:text-[#52B788] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">🎪 Organizer Komunitas</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /events/portal</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("COMMUNITY_BANDUNGDEV")}
                  className="p-2.5 text-left bg-emerald-50 dark:bg-emerald-950/30 hover:bg-[#3B7A57] hover:text-white border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl font-bold text-[11px] text-[#3B7A57] dark:text-[#52B788] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer group"
                >
                  <div className="font-bold group-hover:text-white">👾 Organizer Dev/Gaming</div>
                  <div className="text-[9px] text-slate-400 group-hover:text-white/80">→ /events/portal</div>
                </button>
              </div>
            </div>

          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          © {new Date().getFullYear()} DagoEng Creative Hub. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex items-center justify-center p-6 text-xs text-slate-500 font-bold">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#3B7A57] border-t-transparent rounded-full animate-spin" />
            <span>Memuat Halaman Login...</span>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
