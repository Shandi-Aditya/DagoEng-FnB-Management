"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, DEMO_PERSONAS, PersonaKey } from "@/contexts/AuthContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Mail, ArrowRight, ShieldAlert, Phone, User, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { createMember, members } = useLoyalty();

  const [activeMode, setActiveMode] = useState<"STAFF" | "CUSTOMER">("STAFF");
  const [email, setEmail] = useState("owner.dago@dagoeng.com");
  const [password, setPassword] = useState("Password123!");
  const [isLoading, setIsLoading] = useState(false);

  // Customer register/login form
  const [custName, setCustName] = useState("Ketut Dian");
  const [custPhone, setCustPhone] = useState("+62 819-1122-3344");

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Identify persona based on email
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

    // Role-based redirection
    if (targetPersona === "CASHIER_SGR") router.push("/pos");
    else if (targetPersona === "KITCHEN_SGR") router.push("/kitchen");
    else if (targetPersona === "WAITER_SGR") router.push("/waiter");
    else if (targetPersona === "CUSTOMER_DEMO") router.push("/customer");
    else if (targetPersona === "COWORK_MANAGER") router.push("/coworking");
    else if (targetPersona === "COMMERCIAL_MANAGER") router.push("/commercial");
    else router.push("/dashboard");
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return;

    setIsLoading(true);

    // Check if member exists or create new
    const existing = members.find((m) => m.phone === custPhone.trim());
    if (!existing) {
      createMember({
        name: custName.trim(),
        phone: custPhone.trim(),
        initialPoints: 50, // Welcome bonus points
      });
    }

    await login("CUSTOMER_DEMO");
    setIsLoading(false);
    router.push("/customer");
  };

  const handleQuickLogin = async (personaKey: PersonaKey) => {
    const target = DEMO_PERSONAS[personaKey];
    if (target) {
      setIsLoading(true);
      await login(personaKey);
      setIsLoading(false);

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
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-5">
        
        {/* Top Back Link */}
        <div className="flex items-center px-1">
          <Link
            href="/"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Kembali ke Halaman Utama</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-16 relative mx-auto">
            <Image
              src="/logo-dago.png"
              alt="DagoEng Creative Hub"
              width={56}
              height={64}
              priority
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            DagoEng <span className="text-brand-orange">Platform</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Sistem Terpadu F&B, Co-working & Customer Loyalty
          </p>
        </div>

        {/* Mode Toggle Tab */}
        <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveMode("STAFF")}
            className={`py-2 rounded-lg transition-all ${
              activeMode === "STAFF"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Staf & Manajemen
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("CUSTOMER")}
            className={`py-2 rounded-lg transition-all ${
              activeMode === "CUSTOMER"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pelanggan / Member
          </button>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-slate-200/80 bg-white overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">
              {activeMode === "STAFF" ? "Masuk ke Sesi Akun Staf" : "Masuk / Registrasi Pelanggan"}
            </CardTitle>
            <CardDescription className="text-xs">
              {activeMode === "STAFF"
                ? "Gunakan email terdaftar untuk membuka dashboard atau stasiun kerja"
                : "Masukkan nama dan nomor HP untuk akses loyalty poin & pemesanan"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeMode === "STAFF" ? (
              <form onSubmit={handleStaffLogin} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 text-xs h-10"
                      placeholder="nama@bisnis.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 text-xs h-10"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 text-xs font-bold space-x-2 mt-2 bg-slate-900 hover:bg-slate-800 text-white"
                >
                  <span>{isLoading ? "Memverifikasi..." : "Masuk ke Sistem"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleCustomerLogin} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Pelanggan</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Input
                      type="text"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="pl-9 text-xs h-10"
                      placeholder="Contoh: Ketut Dian"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nomor WhatsApp / HP</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Input
                      type="tel"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="pl-9 text-xs h-10"
                      placeholder="+62 819-xxxx-xxxx"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 text-xs font-bold space-x-2 mt-2 bg-brand-orange hover:bg-orange-600 text-white"
                >
                  <span>{isLoading ? "Menghubungkan..." : "Masuk Customer Portal"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            )}

            {/* Quick 1-Click Role Login for QA / Evaluator */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center space-x-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <ShieldAlert className="w-3.5 h-3.5 text-brand-yellow" />
                <span>Akses Cepat 1-Klik Testing Role:</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("DAGO_OWNER")}
                  className="p-1.5 text-left border rounded-lg hover:bg-slate-50 font-medium text-[11px] text-slate-700"
                >
                  🏢 Dago Hub Owner
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CASHIER_SGR")}
                  className="p-1.5 text-left border rounded-lg hover:bg-slate-50 font-medium text-[11px] text-slate-700"
                >
                  💵 Kasir Singaraja (POS)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("KITCHEN_SGR")}
                  className="p-1.5 text-left border rounded-lg hover:bg-slate-50 font-medium text-[11px] text-slate-700"
                >
                  👨‍🍳 Chef Singaraja (KDS)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("WAITER_SGR")}
                  className="p-1.5 text-left border rounded-lg hover:bg-slate-50 font-medium text-[11px] text-slate-700"
                >
                  🤵 Waiter (Meja)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("CUSTOMER_DEMO")}
                  className="p-1.5 text-left border rounded-lg hover:bg-slate-50 font-medium text-[11px] text-brand-orange font-bold"
                >
                  📱 Pelanggan (Customer Portal)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("SUPER_ADMIN")}
                  className="p-1.5 text-left border rounded-lg hover:bg-slate-50 font-medium text-[11px] text-slate-700"
                >
                  ⚡ Platform Super Admin
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} DagoEng Creative Hub. All rights reserved.
        </p>
      </div>
    </div>
  );
}
