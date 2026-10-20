"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { RoleAwareStatusPill } from "./RoleAwareStatusPill";
import {
  Store,
  ChevronDown,
  Bell,
  Calendar,
  Building,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  UserCheck,
  Check,
  ExternalLink,
  Menu,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header({
  onOpenMobileMenu,
  isSidebarCollapsed,
  onToggleSidebar,
}: {
  onOpenMobileMenu?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
} = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeOutletId, outlets, isAllOutlets, setOutlet } = useOutlet();
  const { filteredNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [isOutletDropdownOpen, setIsOutletDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDagoOwner = user?.scopeLevel === "ORGANIZATION";
  const isTenantOwner = user?.scopeLevel === "TENANT" && user?.role.slug === "OWNER";
  const canSwitchOutlets = isDagoOwner || isTenantOwner || user?.role.slug === "SUPER_ADMIN" || user?.role.slug === "MANAGER";

  const handleNotificationClick = (actionUrl?: string, id?: string) => {
    if (id) markAsRead(id);
    setIsNotifDropdownOpen(false);
    if (actionUrl) {
      router.push(actionUrl);
    }
  };

  return (
    <header className="h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 gap-2 transition-colors duration-200">
      {/* Left: Hamburger & Desktop Sidebar Toggle & Organization Title */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {/* Mobile & Tablet Drawer Trigger (<1024px) */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0"
          title="Buka Menu Navigasi"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop & Tablet Landscape Sidebar Toggle (only shown when sidebar is closed/hidden) */}
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden lg:flex p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0 items-center justify-center min-h-[40px] min-w-[40px] touch-manipulation"
            title="Buka Menu Navigasi"
            aria-label="Buka Menu Navigasi"
          >
            <PanelLeftOpen className="w-5 h-5 text-[#3B7A57] dark:text-[#52B788]" />
          </button>
        )}

        <div className="flex items-center space-x-2 truncate">
          <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-1.5 truncate">
            {user?.scopeLevel === "ORGANIZATION" ? (
              <>
                <Building className="w-4 h-4 text-primary dark:text-emerald-400" />
                <span>Dago Creative Hub</span>
              </>
            ) : user?.tenant ? (
              <>
                <Coffee className="w-4 h-4 text-primary" />
                <span>{user.tenant.name}</span>
              </>
            ) : (
              <span>{user?.organization?.name || "DagoEng Hub"}</span>
            )}
          </span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
        </div>

        {/* Outlet Switcher Dropdown */}
        {canSwitchOutlets ? (
          <div className="relative">
            <button
              onClick={() => setIsOutletDropdownOpen(!isOutletDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
              <span>
                {isAllOutlets ? "Semua Outlet (Konsolidasi)" : outlets.find((o) => o.id === activeOutletId)?.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>

            {isOutletDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOutletDropdownOpen(false)} />
                <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-dropdown border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                    Pilih Lingkup Outlet
                  </div>
                  <button
                    onClick={() => {
                      setOutlet("ALL");
                      setIsOutletDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between ${
                      isAllOutlets ? "text-primary dark:text-emerald-400 font-bold bg-primary/10 dark:bg-primary/20" : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span className="flex items-center">
                      <Globe className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
                      Semua Outlet (Konsolidasi Data)
                    </span>
                    {isAllOutlets && <span className="text-[10px] bg-primary text-white dark:text-slate-950 px-1.5 rounded font-bold">Aktif</span>}
                  </button>
                  <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                  {outlets.map((outlet) => {
                    const isSelected = activeOutletId === outlet.id;
                    return (
                      <button
                        key={outlet.id}
                        onClick={() => {
                          setOutlet(outlet.id);
                          setIsOutletDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between ${
                          isSelected ? "text-primary dark:text-emerald-400 font-bold bg-primary/10 dark:bg-primary/20" : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{outlet.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-400">{outlet.code}</p>
                        </div>
                        {isSelected && <span className="text-[10px] bg-primary text-white dark:text-slate-950 px-1.5 rounded font-bold">Aktif</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Store className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Outlet: {user?.outlet?.name || "Singaraja"}</span>
          </div>
        )}
      </div>

      {/* Right: Scope Status Pill, Date, Theme Toggle, and Notification Center */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        <div className="hidden md:block">
          <RoleAwareStatusPill />
        </div>

        <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
          <span>17 Sep 2026</span>
        </div>

        {/* Global Theme Toggle Button */}
        <ThemeToggle />

        {/* Interactive Notification Bell & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
            className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title="Pusat Notifikasi"
            aria-label="Pusat Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {isMounted && unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-primary text-white dark:text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-850 dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-50 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Pusat Notifikasi</span>
                    {isMounted && unreadCount > 0 && (
                      <span className="text-[10px] bg-primary/10 dark:bg-primary/20 text-primary dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                        {unreadCount} Baru
                      </span>
                    )}
                  </div>
                  {isMounted && unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] text-primary dark:text-emerald-400 hover:underline font-bold flex items-center space-x-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Tandai Semua Dibaca</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 dark:text-slate-400 text-xs">
                      Tidak ada notifikasi saat ini.
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif.actionUrl, notif.id)}
                        className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors flex items-start space-x-3 ${
                          !notif.isRead ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                        }`}
                      >
                        <div className="mt-0.5">
                          {notif.type === "CRITICAL_STOCK" || notif.type === "OUT_OF_STOCK" ? (
                            <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          ) : notif.type === "PAYMENT_RECEIVED" ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                              <CreditCard className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center">
                              <UserCheck className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-xs font-bold ${!notif.isRead ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">{notif.formattedTime}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {notif.detail}
                          </p>
                          <div className="pt-1 flex items-center justify-between text-[10px] text-primary dark:text-emerald-400 font-semibold">
                            <span>Outlet: {notif.outletName}</span>
                            {notif.actionUrl && (
                              <span className="flex items-center space-x-0.5 hover:underline">
                                <span>Lihat Detail</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
