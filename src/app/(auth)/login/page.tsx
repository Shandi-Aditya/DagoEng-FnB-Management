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
  Building2,
  Zap,
  AlertCircle,
} from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginCustomer } = useAuth();
  const { getOrCreateMember } = useLoyalty();

  const returnTo = searchParams.get("returnTo");
  const initialMode = searchParams.get("mode");

  const [activeMode, setActiveMode] = useState<"STAFF" | "CUSTOMER">("STAFF");
  const [customerSubMode, setCustomerSubMode] = useState<"LOGIN" | "REGISTER">("LOGIN");

  const [email, setEmail] = useState("owner.dago@dagoeng.com");
  const [password, setPassword] = useState("Password123!");
  const [isLoading, setIsLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Customer register/login form
  const [custName, setCustName] = useState("Ketut Dian");
  const [custPhone, setCustPhone] = useState("+62 819-1122-3344");
  const [custEmail, setCustEmail] = useState("ketut.dian@gmail.com");

  useEffect(() => {
    if (initialMode === "register") {
      setActiveMode("CUSTOMER");
      setCustomerSubMode("REGISTER");
    } else if (initialMode === "customer") {
      setActiveMode("CUSTOMER");
      setCustomerSubMode("LOGIN");
    }
  }, [initialMode]);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStaffError(data.error || "Gagal masuk. Periksa kembali email dan password Anda.");
        setIsLoading(false);
        return;
      }

      // Synchronize client context with the authenticated persona
      await login(data.personaKey);
      setIsLoading(false);

      if (returnTo) {
        router.push(returnTo);
        return;
      }

      router.push(data.redirectUrl || "/dashboard");
    } catch (err: any) {
      console.error("Staff login error:", err);
      setStaffError("Terjadi kendala jaringan saat menghubungi server autentikasi.");
      setIsLoading(false);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custPhone.trim()) return;

    setIsLoading(true);

    // Get existing member or create new (deduplicated)
    const member = getOrCreateMember({
      name: custName.trim() || "Pelanggan Member",
      phone: custPhone.trim(),
      email: custEmail.trim() || undefined,
      initialPoints: customerSubMode === "REGISTER" ? 50 : 0,
    });

    // Log in customer session
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
  };

  const handleQuickLogin = async (personaKey: PersonaKey) => {
    const target = DEMO_PERSONAS[personaKey];
    if (target) {
      setStaffError(null);
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: target.email, password: "Password123!" }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setStaffError(data.error || "Akun demo tidak dapat diakses.");
          setIsLoading(false);
          return;
        }

        await login(personaKey);
        setIsLoading(false);

        if (returnTo) {
          router.push(returnTo);
          return;
        }

        router.push(data.redirectUrl || "/dashboard");
      } catch (err) {
        // Fallback for isolated offline client-only tests if fetch fails
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
            href={returnTo || "/"}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white backdrop-blur-md shadow-xs transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
            <span>{returnTo ? "Kembali ke Portal / Fitur" : "Kembali ke Beranda"}</span>
          </Link>

          <div className="flex items-center space-x-2">
            {returnTo && (
              <span className="text-[10px] bg-[#3B7A57]/10 dark:bg-[#52B788]/20 text-[#3B7A57] dark:text-[#52B788] font-bold px-2.5 py-1 rounded-full border border-[#3B7A57]/20 dark:border-[#52B788]/30">
                Konteks Terjaga
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
              Sistem Terpadu F&B, Co-working & Customer Loyalty
            </p>
          </div>
        </div>

        {/* Primary Role Mode Switcher (Staf & Manajemen vs Pelanggan / Member) */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-200/70 dark:bg-white/5 backdrop-blur-md border border-slate-300/80 dark:border-white/10 rounded-2xl text-xs font-bold shadow-inner transition-colors">
          <button
            type="button"
            onClick={() => setActiveMode("STAFF")}
            className={`py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${activeMode === "STAFF"
                ? "bg-white dark:bg-[#131B2B] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-white/15 scale-[1.02]"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
          >
            <Building2 className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
            <span>Staf & Manajemen</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("CUSTOMER")}
            className={`py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${activeMode === "CUSTOMER"
                ? "bg-[#3B7A57] text-white shadow-md shadow-[#3B7A57]/25 border border-[#52B788]/30 scale-[1.02]"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Pelanggan / Member</span>
          </button>
        </div>

        {/* Main Glassmorphic Login Card */}
        <div className="bg-white dark:bg-[#131B2B] backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-xl dark:shadow-2xl overflow-hidden transition-colors">

          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/5 space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>
                {activeMode === "STAFF"
                  ? "Masuk ke Sesi Akun Staf"
                  : customerSubMode === "REGISTER"
                    ? "Daftar Member Baru DagoEng"
                    : "Masuk Akun Pelanggan"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {activeMode === "STAFF"
                ? "Gunakan kredensial terdaftar untuk membuka dashboard POS, KDS, atau manajerial."
                : customerSubMode === "REGISTER"
                  ? "Dapatkan langsung 50 Poin Selamat Datang dan promo eksklusif member."
                  : "Masukkan nomor WhatsApp atau Nama untuk mengakses poin loyalty Anda."}
            </p>
          </div>

          <div className="p-6 space-y-5">
            {activeMode === "STAFF" ? (
              <form onSubmit={handleStaffLogin} className="space-y-4">
                {staffError && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{staffError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="nama@bisnis.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-xs font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-md shadow-[#3B7A57]/20 border border-[#52B788]/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>{isLoading ? "Memverifikasi..." : "Masuk ke Sistem Staf"}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Customer Sub-mode Toggle (Masuk vs Daftar) */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCustomerSubMode("LOGIN")}
                    className={`py-2 rounded-lg transition-all ${customerSubMode === "LOGIN"
                        ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-white/20"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    Masuk Akun
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerSubMode("REGISTER")}
                    className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1 ${customerSubMode === "REGISTER"
                        ? "bg-[#3B7A57] text-white shadow-sm shadow-[#3B7A57]/20 font-bold"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Daftar (+50 Poin)</span>
                  </button>
                </div>

                <form onSubmit={handleCustomerSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
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
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                        placeholder="+62 819-xxxx-xxxx"
                        required
                      />
                    </div>
                  </div>

                  {customerSubMode === "REGISTER" && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email (Opsional untuk E-Receipt)</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          value={custEmail}
                          onChange={(e) => setCustEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#52B788] focus:ring-2 focus:ring-[#52B788]/20 transition-all"
                          placeholder="email@anda.com"
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 text-xs font-bold space-x-1.5 mt-2 bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-xl shadow-md shadow-[#3B7A57]/20 border border-[#52B788]/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>
                      {isLoading
                        ? "Menghubungkan..."
                        : customerSubMode === "REGISTER"
                          ? "Daftar & Klaim 50 Poin"
                          : "Masuk Customer Portal"}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </form>
              </div>
            )}

            {/* Quick 1-Click Role Login for QA / Testing Evaluator */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                <span>Akses Cepat 1-Klik Testing Demo:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("DAGO_OWNER")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  🏢 Dago Hub Owner
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("TENANT_OWNER_KS")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  ☕ Mitra: Kopi Senja
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("TENANT_OWNER_KITCHEN")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  🍽️ Mitra: Dapur Mama
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("TENANT_OWNER_BAKERY")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  🥐 Mitra: Manis Bakery
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("TENANT_OWNER_TEA")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  🍃 Mitra: Warung Bu Narti
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CASHIER_SGR")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  💵 Kasir POS (Singaraja)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("KITCHEN_SGR")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  👨‍🍳 Chef Dapur (KDS)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("WAITER_SGR")}
                  className="p-2.5 text-left bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 rounded-xl font-medium text-[11px] text-slate-700 dark:text-slate-300 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  🤵 Waiter (Floor Meja)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CUSTOMER_DEMO")}
                  className="p-2.5 text-center bg-[#3B7A57]/10 dark:bg-[#52B788]/15 hover:bg-[#3B7A57] hover:text-white border border-[#3B7A57]/30 dark:border-[#52B788]/30 rounded-xl font-bold text-[11px] text-[#3B7A57] dark:text-[#52B788] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  📱 Pelanggan QR
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("COMMUNITY_BARISTA")}
                  className="p-2.5 text-center bg-emerald-50 dark:bg-emerald-950/30 hover:bg-[#3B7A57] hover:text-white border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl font-bold text-[11px] text-[#3B7A57] dark:text-[#52B788] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs cursor-pointer"
                >
                  🎪 Penyelenggara Event
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
