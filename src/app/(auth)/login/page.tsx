"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, DEMO_PERSONAS, PersonaKey } from "@/contexts/AuthContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldAlert,
  Phone,
  User,
  ArrowLeft,
  Sparkles,
  Building2,
  UtensilsCrossed,
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Zap,
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
    setIsLoading(true);

    let targetPersona: PersonaKey = "DAGO_OWNER";
    const emailLower = email.toLowerCase().trim();

    if (emailLower.includes("customer")) targetPersona = "CUSTOMER_DEMO";
    else if (emailLower.includes("cashier")) targetPersona = "CASHIER_SGR";
    else if (emailLower.includes("kitchen") || emailLower.includes("chef")) targetPersona = "KITCHEN_SGR";
    else if (emailLower.includes("waiter")) targetPersona = "WAITER_SGR";
    else if (emailLower.includes("cowork")) targetPersona = "COWORK_MANAGER";
    else if (emailLower.includes("commercial")) targetPersona = "COMMERCIAL_MANAGER";
    else if (emailLower.includes("kopisenja")) targetPersona = "TENANT_OWNER_KS";
    else if (emailLower.includes("admin")) targetPersona = "SUPER_ADMIN";

    await login(targetPersona);
    setIsLoading(false);

    if (returnTo) {
      router.push(returnTo);
      return;
    }

    // Default role-based redirection
    if (targetPersona === "CASHIER_SGR") router.push("/pos");
    else if (targetPersona === "KITCHEN_SGR") router.push("/kitchen");
    else if (targetPersona === "WAITER_SGR") router.push("/waiter");
    else if (targetPersona === "CUSTOMER_DEMO") router.push("/customer");
    else if (targetPersona === "COWORK_MANAGER") router.push("/coworking");
    else if (targetPersona === "COMMERCIAL_MANAGER") router.push("/commercial");
    else router.push("/dashboard");
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
      setIsLoading(true);
      await login(personaKey);
      setIsLoading(false);

      if (returnTo) {
        router.push(returnTo);
        return;
      }

      if (personaKey === "CASHIER_SGR") router.push("/pos");
      else if (personaKey === "KITCHEN_SGR") router.push("/kitchen");
      else if (personaKey === "WAITER_SGR") router.push("/waiter");
      else if (personaKey === "CUSTOMER_DEMO") router.push("/customer");
      else if (personaKey === "COWORK_MANAGER") router.push("/coworking");
      else if (personaKey === "COMMERCIAL_MANAGER") router.push("/commercial");
      else router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-brand-orange selection:text-white">
      
      {/* Dynamic Ambient Background Glows matching Onboarding */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-brand-orange/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 -left-20 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-10 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-md space-y-5 relative z-10">
        
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between px-1">
          <Link
            href={returnTo || "/"}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-brand-orange" />
            <span>{returnTo ? "Kembali ke Portal / Fitur" : "Kembali ke Beranda"}</span>
          </Link>

          {returnTo && (
            <span className="text-[10px] bg-brand-orange/20 text-brand-orange font-bold px-2.5 py-1 rounded-full border border-brand-orange/30">
              Konteks Terjaga
            </span>
          )}
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2.5 pt-2">
          <Link href="/" className="inline-block group">
            <div className="w-16 h-18 relative mx-auto transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_8px_20px_rgba(249,115,22,0.35)]">
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
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              DagoEng <span className="text-brand-orange">Platform</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Sistem Terpadu F&B, Co-working & Customer Loyalty
            </p>
          </div>
        </div>

        {/* Primary Role Mode Switcher (Staf & Manajemen vs Pelanggan / Member) */}
        <div className="grid grid-cols-2 p-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-xs font-bold shadow-inner">
          <button
            type="button"
            onClick={() => setActiveMode("STAFF")}
            className={`py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              activeMode === "STAFF"
                ? "bg-slate-800 text-white shadow-md border border-white/15 scale-[1.02]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Staf & Manajemen</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("CUSTOMER")}
            className={`py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              activeMode === "CUSTOMER"
                ? "bg-gradient-to-r from-orange-500 to-brand-orange text-white shadow-lg shadow-orange-500/30 border border-orange-400/30 scale-[1.02]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Pelanggan / Member</span>
          </button>
        </div>

        {/* Main Glassmorphic Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden">
          
          <div className="px-6 pt-6 pb-4 border-b border-white/5 space-y-1">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>
                {activeMode === "STAFF"
                  ? "Masuk ke Sesi Akun Staf"
                  : customerSubMode === "REGISTER"
                  ? "Daftar Member Baru DagoEng"
                  : "Masuk Akun Pelanggan"}
              </span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
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
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 transition-all"
                      placeholder="nama@bisnis.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-xs font-black bg-brand-orange hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>{isLoading ? "Memverifikasi..." : "Masuk ke Sistem Staf"}</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Customer Sub-mode Toggle (Masuk vs Daftar) */}
                <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCustomerSubMode("LOGIN")}
                    className={`py-2 rounded-lg transition-all ${
                      customerSubMode === "LOGIN"
                        ? "bg-white/15 text-white shadow-sm border border-white/20"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Masuk Akun
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerSubMode("REGISTER")}
                    className={`py-2 rounded-lg transition-all flex items-center justify-center space-x-1 ${
                      customerSubMode === "REGISTER"
                        ? "bg-brand-orange text-white shadow-md shadow-orange-500/30 font-black"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Daftar (+50 Poin)</span>
                  </button>
                </div>

                <form onSubmit={handleCustomerSubmit} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Nama Lengkap</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 transition-all"
                        placeholder="Contoh: Ketut Dian"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Nomor WhatsApp / HP</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="tel"
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 transition-all"
                        placeholder="+62 819-xxxx-xxxx"
                        required
                      />
                    </div>
                  </div>

                  {customerSubMode === "REGISTER" && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-xs font-bold text-slate-300">Email (Opsional untuk E-Receipt)</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          value={custEmail}
                          onChange={(e) => setCustEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 transition-all"
                          placeholder="email@anda.com"
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 text-xs font-black space-x-1.5 mt-2 bg-brand-orange hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Akses Cepat 1-Klik Testing Demo:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("DAGO_OWNER")}
                  className="p-2 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-orange/40 rounded-xl font-medium text-[11px] text-slate-300 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  🏢 Dago Hub Owner
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CASHIER_SGR")}
                  className="p-2 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 rounded-xl font-medium text-[11px] text-slate-300 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  💵 Kasir POS (Singaraja)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("KITCHEN_SGR")}
                  className="p-2 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/40 rounded-xl font-medium text-[11px] text-slate-300 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  👨‍🍳 Chef Dapur (KDS)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("WAITER_SGR")}
                  className="p-2 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 rounded-xl font-medium text-[11px] text-slate-300 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  🤵 Waiter (Floor Meja)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CUSTOMER_DEMO")}
                  className="p-2 text-left bg-brand-orange/15 hover:bg-brand-orange/25 border border-brand-orange/30 rounded-xl font-bold text-[11px] text-brand-orange hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  📱 Pelanggan (Customer)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("SUPER_ADMIN")}
                  className="p-2 text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 rounded-xl font-medium text-[11px] text-slate-300 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  ⚡ Platform Super Admin
                </button>
              </div>
            </div>

          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 font-medium">
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
        <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-6 text-xs text-slate-400 font-bold">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
            <span>Memuat Halaman Login...</span>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
