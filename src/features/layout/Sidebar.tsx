"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useOrders } from "@/contexts/OrderContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { CashDrawerShiftModal } from "@/features/pos/CashDrawerShiftModal";
import { getAuthorizedNavItems } from "@/lib/rbac";
import { getTenantName } from "@/lib/tenant";
import { ProFeatureBadge } from "@/components/premium";
import {
  LayoutDashboard,
  Calculator,
  ClipboardList,
  Grid,
  UtensilsCrossed,
  Package,
  BookOpen,
  Users,
  BarChart3,
  UserCheck,
  Sparkles,
  Settings,
  LogOut,
  Laptop,
  Building2,
  ShieldCheck,
  Calendar,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  Calculator: <Calculator className="w-4 h-4" />,
  ClipboardList: <ClipboardList className="w-4 h-4" />,
  Grid: <Grid className="w-4 h-4" />,
  UtensilsCrossed: <UtensilsCrossed className="w-4 h-4" />,
  Package: <Package className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  BarChart3: <BarChart3 className="w-4 h-4" />,
  UserCheck: <UserCheck className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4 text-primary dark:text-primary-light" />,
  ShieldCheck: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
  Settings: <Settings className="w-4 h-4" />,
  Laptop: <Laptop className="w-4 h-4 text-blue-600" />,
  Building2: <Building2 className="w-4 h-4 text-purple-600" />,
  Calendar: <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
};

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeOrgModules, logout } = useAuth();
  const { t, settings } = useSettings();
  const { activeOutlet } = useOutlet();
  const [isCashDrawerModalOpen, setIsCashDrawerModalOpen] = useState(false);
  const { filteredOrders } = useOrders();
  const { activeShift } = useEmployeeShift();
  const navItems = getAuthorizedNavItems(user, activeOrgModules);

  const isCashier = user?.role?.slug === "CASHIER";

  // Live sales metrics for cashier shift reconciliation
  const liveCashSales = React.useMemo(() => {
    return filteredOrders
      .filter((o) => o.paymentMethod === "CASH" && o.paymentStatus === "PAID")
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [filteredOrders]);

  const liveQrisSales = React.useMemo(() => {
    return filteredOrders
      .filter((o) => (o.paymentMethod === "QRIS" || !o.paymentMethod) && o.paymentStatus === "PAID")
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [filteredOrders]);

  const liveEdcSales = React.useMemo(() => {
    return filteredOrders
      .filter((o) => o.paymentMethod === "EDC" && o.paymentStatus === "PAID")
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [filteredOrders]);

  const liveOtherNonCashSales = React.useMemo(() => {
    return filteredOrders
      .filter((o) => o.paymentMethod === "TRANSFER" && o.paymentStatus === "PAID")
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [filteredOrders]);

  const liveNonCashSales = liveQrisSales + liveEdcSales + liveOtherNonCashSales;
  const livePaidOrders = filteredOrders.filter((o) => o.paymentStatus === "PAID");
  const liveTransactionsCount = livePaidOrders.length;
  const liveDiscounts = livePaidOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const liveInitialCash = activeShift?.openingCash ?? 0;

  const handleLogoutClick = async () => {
    if (isCashier) {
      setIsCashDrawerModalOpen(true);
    } else {
      await logout();
      router.push("/login");
    }
  };

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full select-none transition-colors duration-200">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-10 relative flex-shrink-0">
            <Image
              src="/logo-dago.png"
              alt="Dago Creative Hub"
              width={32}
              height={40}
              priority
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              DAGO <span className="text-primary dark:text-emerald-400">Creative Hub</span>
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium tracking-wide">
              {user?.tenant ? getTenantName(user.tenant.id) : "Platform & Management"}
            </p>
          </div>
        </div>

        {/* Dynamic Multi-Business Navigation */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Menu ({user?.role.name})</span>
            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-600 dark:text-slate-400">
              {user?.scopeLevel}
            </span>
          </div>

          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-emerald-300 font-bold border border-primary/20 dark:border-primary/30 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className={isActive ? "text-primary dark:text-emerald-400" : "text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}>
                    {ICON_MAP[item.icon]}
                  </span>
                  <span className={isActive ? "text-slate-900 dark:text-slate-100" : ""}>{item.name}</span>
                </div>
                {item.module !== "CORE" && (
                  <div className="flex items-center space-x-1.5 flex-shrink-0 ml-1.5">
                    {item.module === "CO_WORKING" ? (
                      <ProFeatureBadge label="PRO" variant="pro" size="xs" />
                    ) : (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isActive ? "bg-primary/20 dark:bg-primary/30 text-primary dark:text-emerald-300 font-semibold" : "text-slate-400 dark:text-slate-400 font-normal"
                      }`}>
                        {item.module}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer & Logout */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 flex-shrink-0">
              {user?.name.charAt(0) || "U"}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">
                {user?.tenant ? (getTenantName(user.tenant.id) || user.tenant.name) : user?.organization?.name || "Dago Hub"}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isCashier ? "Tutup Sesi / Keluar" : "Keluar Sesi"}</span>
        </button>
      </div>

      {/* Shift Closing & Reconciliation Modal for Cashier */}
      {isCashDrawerModalOpen && (
        <CashDrawerShiftModal
          isOpen={isCashDrawerModalOpen}
          onClose={() => setIsCashDrawerModalOpen(false)}
          cashierName={user?.name || "Kasir Bertugas"}
          outletName={activeOutlet?.name || user?.outlet?.name || "Singaraja"}
          initialCash={liveInitialCash}
          totalCashSales={liveCashSales}
          totalNonCashSales={liveNonCashSales}
          totalTransactionsCount={liveTransactionsCount}
          qrisSales={liveQrisSales}
          edcSales={liveEdcSales}
          totalDiscounts={liveDiscounts}
          isTaxEnabled={settings.isTaxEnabled}
          taxRatePercent={settings.taxRatePercent}
        />
      )}
    </aside>
  );
}
