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
} from "lucide-react";

export function Header() {
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
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Organization Title & Scope Context */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
            {user?.scopeLevel === "ORGANIZATION" ? (
              <>
                <Building className="w-4 h-4 text-brand-orange" />
                <span>Dago Creative Hub</span>
              </>
            ) : user?.tenant ? (
              <>
                <Coffee className="w-4 h-4 text-amber-600" />
                <span>{user.tenant.name}</span>
              </>
            ) : (
              <span>{user?.organization?.name || "DagoEng Hub"}</span>
            )}
          </span>
          <span className="text-slate-300">/</span>
        </div>

        {/* Outlet Switcher Dropdown */}
        {canSwitchOutlets ? (
          <div className="relative">
            <button
              onClick={() => setIsOutletDropdownOpen(!isOutletDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-brand-orange" />
              <span>
                {isAllOutlets ? "Semua Outlet (Konsolidasi)" : outlets.find((o) => o.id === activeOutletId)?.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isOutletDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOutletDropdownOpen(false)} />
                <div className="absolute left-0 mt-1 w-64 bg-white rounded-lg shadow-dropdown border border-slate-200 py-1.5 z-50 text-slate-900 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Pilih Lingkup Outlet
                  </div>
                  <button
                    onClick={() => {
                      setOutlet("ALL");
                      setIsOutletDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${
                      isAllOutlets ? "text-brand-orange font-bold bg-brand-orange/5" : "text-slate-700"
                    }`}
                  >
                    <span>🌐 Semua Outlet (Konsolidasi Data)</span>
                    {isAllOutlets && <span className="text-[10px] bg-brand-orange text-white px-1.5 rounded">Aktif</span>}
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {outlets.map((outlet) => {
                    const isSelected = activeOutletId === outlet.id;
                    return (
                      <button
                        key={outlet.id}
                        onClick={() => {
                          setOutlet(outlet.id);
                          setIsOutletDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between ${
                          isSelected ? "text-brand-orange font-bold bg-brand-orange/5" : "text-slate-700"
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{outlet.name}</p>
                          <p className="text-[10px] text-slate-400">{outlet.code}</p>
                        </div>
                        {isSelected && <span className="text-[10px] bg-brand-orange text-white px-1.5 rounded">Aktif</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-700">
            <Store className="w-3.5 h-3.5 text-slate-500" />
            <span>Outlet: {user?.outlet?.name || "Singaraja"}</span>
          </div>
        )}
      </div>

      {/* Right: Scope Status Pill, Date, and Interactive Notification Center */}
      <div className="flex items-center space-x-4">
        <RoleAwareStatusPill />

        <div className="h-4 w-px bg-slate-200" />

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>17 Sep 2026</span>
        </div>

        {/* Interactive Notification Bell & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
            title="Pusat Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {isMounted && unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-brand-orange text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-900 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-900">Pusat Notifikasi</span>
                    {isMounted && unreadCount > 0 && (
                      <span className="text-[10px] bg-orange-100 text-brand-orange px-1.5 py-0.2 rounded font-bold">
                        {unreadCount} Baru
                      </span>
                    )}
                  </div>
                  {isMounted && unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] text-brand-orange hover:underline font-bold flex items-center space-x-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Tandai Semua Dibaca</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {filteredNotifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      Tidak ada notifikasi saat ini.
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif.actionUrl, notif.id)}
                        className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start space-x-3 ${
                          !notif.isRead ? "bg-orange-50/40" : ""
                        }`}
                      >
                        <div className="mt-0.5">
                          {notif.type === "CRITICAL_STOCK" || notif.type === "OUT_OF_STOCK" ? (
                            <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          ) : notif.type === "PAYMENT_RECEIVED" ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                              <CreditCard className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                              <UserCheck className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-xs font-bold ${!notif.isRead ? "text-slate-900" : "text-slate-700"}`}>
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">{notif.formattedTime}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {notif.detail}
                          </p>
                          <div className="pt-1 flex items-center justify-between text-[10px] text-brand-orange font-semibold">
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
