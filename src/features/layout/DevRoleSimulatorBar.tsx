"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, PersonaKey, DEMO_PERSONAS } from "@/contexts/AuthContext";
import { ShieldAlert, Users, ChevronDown, Check, Building, Laptop, Coffee, Briefcase, ExternalLink, Zap, RotateCcw, Calculator, ChefHat, Smartphone } from "lucide-react";

interface PersonaOption {
  key: PersonaKey;
  label: string;
  scopeDesc: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
}

const PERSONAS_LIST: PersonaOption[] = [
  {
    key: "DAGO_OWNER",
    label: "Owner Dago Creative Hub",
    scopeDesc: "Scope: ORGANIZATION (Lihat seluruh F&B, Cowork & Commercial)",
    badge: "ORG OWNER",
    badgeColor: "bg-primary text-white",
    icon: <Building className="w-3.5 h-3.5 text-primary" />,
  },
  {
    key: "TENANT_OWNER_KS",
    label: "Owner Tenant (Kopi Senja)",
    scopeDesc: "Scope: TENANT (Khusus F&B Kopi Senja, isolasi total)",
    badge: "TENANT F&B",
    badgeColor: "bg-primary text-white",
    icon: <Coffee className="w-3.5 h-3.5 text-primary" />,
  },
  {
    key: "COWORK_MANAGER",
    label: "Manager Co-working",
    scopeDesc: "Scope: BUSINESS_UNIT (Meja, Ruang Meeting & Membership)",
    badge: "CO-WORKING",
    badgeColor: "bg-blue-600 text-white",
    icon: <Laptop className="w-3.5 h-3.5 text-blue-600" />,
  },
  {
    key: "COMMERCIAL_MANAGER",
    label: "Manager Commercial",
    scopeDesc: "Scope: BUSINESS_UNIT (Leasing Retail & Sewa Ruang)",
    badge: "COMMERCIAL",
    badgeColor: "bg-slate-700 text-white",
    icon: <Briefcase className="w-3.5 h-3.5 text-slate-300" />,
  },
  {
    key: "CASHIER_SGR",
    label: "Kasir Singaraja",
    scopeDesc: "Scope: OUTLET (POS & Laci Kas Outlet Singaraja)",
    badge: "CASHIER",
    badgeColor: "bg-emerald-600 text-white",
    icon: <Coffee className="w-3.5 h-3.5 text-emerald-600" />,
  },
  {
    key: "KITCHEN_SGR",
    label: "Chef / Kitchen Staff",
    scopeDesc: "Scope: OUTLET (KDS Antrean Dapur Singaraja)",
    badge: "KITCHEN",
    badgeColor: "bg-rose-600 text-white",
    icon: <Coffee className="w-3.5 h-3.5 text-rose-600" />,
  },
  {
    key: "WAITER_SGR",
    label: "Pramusaji / Waiter",
    scopeDesc: "Scope: OUTLET (Meja Lantai & Handheld Order)",
    badge: "WAITER",
    badgeColor: "bg-sky-600 text-white",
    icon: <Coffee className="w-3.5 h-3.5 text-sky-600" />,
  },
  {
    key: "CUSTOMER_DEMO",
    label: "Pelanggan Self-Order",
    scopeDesc: "Scope: TENANT (Menu QR Digital Meja)",
    badge: "CUSTOMER",
    badgeColor: "bg-pink-600 text-white",
    icon: <Coffee className="w-3.5 h-3.5 text-pink-600" />,
  },
  {
    key: "SUPER_ADMIN",
    label: "Platform Super Admin",
    scopeDesc: "Scope: PLATFORM (Konfigurasi Global Seluruh Tenant)",
    badge: "SUPER ADMIN",
    badgeColor: "bg-slate-800 text-white",
    icon: <Building className="w-3.5 h-3.5 text-slate-300" />,
  },
];

const QUICK_PERSONAS: { key: PersonaKey; label: string; icon: React.ReactNode }[] = [
  { key: "DAGO_OWNER", label: "Dago Hub Owner", icon: <Building className="w-3 h-3 text-[#52B788]" /> },
  { key: "TENANT_OWNER_KS", label: "Kopi Senja (Tenant)", icon: <Coffee className="w-3 h-3 text-amber-400" /> },
  { key: "CASHIER_SGR", label: "POS Kasir", icon: <Calculator className="w-3 h-3 text-emerald-400" /> },
  { key: "KITCHEN_SGR", label: "Dapur KDS", icon: <ChefHat className="w-3 h-3 text-rose-400" /> },
  { key: "CUSTOMER_DEMO", label: "Pelanggan QR", icon: <Smartphone className="w-3 h-3 text-purple-400" /> },
];

export function DevRoleSimulatorBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, switchPersona } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectPersona = (key: PersonaKey) => {
    switchPersona(key);
    setIsOpen(false);
    if (key === "CUSTOMER_DEMO") router.push("/customer");
    else if (key === "WAITER_SGR") router.push("/waiter");
    else if (key === "CASHIER_SGR") router.push("/pos");
    else if (key === "KITCHEN_SGR") router.push("/kitchen");
    else if (key === "COWORK_MANAGER") router.push("/coworking");
    else if (key === "COMMERCIAL_MANAGER") router.push("/commercial");
    else router.push("/dashboard");
  };

  return (
    <div className="bg-slate-950 border-b border-slate-800 text-slate-200 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-50 shadow-md">
      {/* Left: Active Persona Display & Quick Switcher Buttons */}
      <div className="flex items-center space-x-3 overflow-x-auto py-0.5">
        <div className="flex items-center space-x-1.5 text-brand-yellow font-bold uppercase tracking-wider whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Demo Simulator:</span>
        </div>

        {/* Current Active Persona Badge */}
        <div className="flex items-center space-x-1.5 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 whitespace-nowrap">
          <span className="font-semibold text-white">{user?.name}</span>
          <span className="text-[9px] bg-primary text-white px-1.5 py-0.2 rounded font-mono font-bold">
            {user?.scopeLevel}
          </span>
        </div>

        {/* Quick 1-Click Role Presets */}
        <div className="hidden lg:flex items-center space-x-1 border-l border-slate-800 pl-3">
          {QUICK_PERSONAS.map((qp) => {
            const isCurrent = DEMO_PERSONAS[qp.key]?.id === user?.id;
            return (
              <button
                key={qp.key}
                onClick={() => handleSelectPersona(qp.key)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center space-x-1 ${
                  isCurrent
                    ? "bg-primary text-white font-bold shadow-xs scale-105"
                    : "bg-slate-900 text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-800"
                }`}
                title={`Switch langsung ke ${qp.label}`}
              >
                <span>{qp.icon}</span>
                <span>{qp.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Full Dropdown & Quick Route Links */}
      <div className="flex items-center space-x-2">
        {/* Master 1-Click Demo Reset Button */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset seluruh data transaksi, pesanan, booking, dan shift demo ke kondisi bersih awal?")) {
              Object.keys(localStorage).forEach((k) => {
                if (k.startsWith("dagoeng_")) {
                  localStorage.removeItem(k);
                }
              });
              window.location.reload();
            }
          }}
          className="flex items-center space-x-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 px-2.5 py-1 rounded transition-all font-bold text-xs shadow-xs hover:scale-105 active:scale-95"
          title="Reset semua data transaksi demo ke kondisi awal bersih"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
          <span>Reset Data Demo</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded transition-colors font-medium text-xs"
          >
            <Users className="w-3.5 h-3.5 text-brand-cyan" />
            <span>Ganti Persona ({PERSONAS_LIST.length})</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-96 bg-white dark:bg-[#1E293B] rounded-xl shadow-dropdown border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Panel Otorisasi Multi-Tenant RBAC</span>
                  <span className="text-[10px] text-[#3B7A57] dark:text-[#52B788] font-bold">Multi-Tenant RBAC</span>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                  {PERSONAS_LIST.map((item) => {
                    const isSelected = DEMO_PERSONAS[item.key]?.id === user?.id;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSelectPersona(item.key)}
                        className={`w-full text-left px-3 py-2 flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                          isSelected ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-l-2 border-[#3B7A57] dark:border-[#52B788]" : ""
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{item.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold font-mono ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.scopeDesc}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
