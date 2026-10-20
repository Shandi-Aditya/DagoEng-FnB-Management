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
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
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

export function Sidebar({
  onNavigate,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeOrgModules, logout } = useAuth();
  const { t, settings } = useSettings();
  const { activeOutlet } = useOutlet();
  const [isCashDrawerModalOpen, setIsCashDrawerModalOpen] = useState(false);
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const { filteredOrders } = useOrders();
  const { activeShift } = useEmployeeShift();
  const navItems = getAuthorizedNavItems(user, activeOrgModules);

  // Determine active collapsed state (controlled vs local)
  const isDrawer = Boolean(onNavigate);
  const isCollapsed = isDrawer ? false : (controlledCollapsed !== undefined ? controlledCollapsed : localCollapsed);

  // Restore client preference for sidebar minimize if not controlled
  React.useEffect(() => {
    if (controlledCollapsed === undefined && !isDrawer) {
      try {
        const saved = localStorage.getItem("dago_sidebar_collapsed");
        if (saved !== null) {
          setLocalCollapsed(saved === "true");
        }
      } catch (_) {}
    }
  }, [controlledCollapsed, isDrawer]);

  const toggleCollapsed = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setLocalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("dago_sidebar_collapsed", String(next));
        } catch (_) {}
        return next;
      });
    }
  };

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
    <div
      className="w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full select-none"
    >
      {/* Brand Header & Minimize Toggle */}
      <div>
        <div
          className={`p-4 border-b border-slate-100 dark:border-slate-800 flex items-center ${
            isCollapsed ? "flex-col space-y-2 justify-center" : "justify-between"
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-3 overflow-hidden min-w-0">
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
                <div className="truncate">
                  <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 leading-tight truncate">
                    DAGO <span className="text-primary dark:text-emerald-400">Creative Hub</span>
                  </h1>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium tracking-wide truncate">
                    {user?.tenant ? getTenantName(user.tenant.id) : "Platform & Management"}
                  </p>
                </div>
              </div>

              {!isDrawer && (
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0 touch-manipulation"
                  title="Perkecil / Tutup Sidebar"
                  aria-label="Perkecil / Tutup Sidebar"
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              )}
            </>
          ) : (
            <>
              <div className="w-8 h-8 relative flex-shrink-0">
                <Image
                  src="/logo-dago.png"
                  alt="Dago Creative Hub"
                  width={32}
                  height={32}
                  priority
                  className="object-contain"
                />
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="p-2 min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center touch-manipulation"
                title="Perluas Sidebar"
                aria-label="Perluas Sidebar"
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Dynamic Multi-Business Navigation */}
        <nav className={`p-2 space-y-1 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Menu ({user?.role.name})</span>
              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-600 dark:text-slate-400">
                {user?.scopeLevel}
              </span>
            </div>
          )}

          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

            if (isCollapsed) {
              return (
                <div key={item.href} className="relative group w-full flex justify-center">
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${
                      isActive
                        ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-emerald-300 font-bold border border-primary/20 dark:border-primary/30 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                    title={item.name}
                    aria-label={item.name}
                  >
                    <span className={isActive ? "text-primary dark:text-emerald-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"}>
                      {ICON_MAP[item.icon]}
                    </span>
                  </Link>

                  {/* Floating accessible hover tooltip */}
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xl whitespace-nowrap hidden group-hover:flex items-center space-x-1.5 z-50 pointer-events-none">
                    <span>{item.name}</span>
                    {item.module !== "CORE" && (
                      <span className="text-[9px] bg-primary/30 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                        {item.module}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

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
      <div className={`p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 ${isCollapsed ? "flex flex-col items-center space-y-2" : ""}`}>
        {!isCollapsed ? (
          <>
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
              type="button"
              onClick={handleLogoutClick}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors min-h-[44px] touch-manipulation"
            >
              <LogOut className="w-4 h-4" />
              <span>{isCashier ? "Tutup Sesi / Keluar" : "Keluar Sesi"}</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200"
              title={user?.name}
            >
              {user?.name.charAt(0) || "U"}
            </div>
            <button
              type="button"
              onClick={handleLogoutClick}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
              title={isCashier ? "Tutup Sesi / Keluar" : "Keluar Sesi"}
              aria-label="Keluar Sesi"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
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
    </div>
  );
}
