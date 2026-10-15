"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Archive,
  Eye,
  Edit,
  ExternalLink,
  Mail,
  Phone,
  User,
  Sparkles,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommunityEvent, EventCategory, EventStatus } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";

const STATUS_TABS: { key: string; label: string; status?: EventStatus }[] = [
  { key: "ALL", label: "Semua Pengajuan" },
  { key: "PENDING", label: "Menunggu Review", status: "PENDING" },
  { key: "APPROVED", label: "Disetujui", status: "APPROVED" },
  { key: "REVISION_REQUESTED", label: "Perlu Revisi", status: "REVISION_REQUESTED" },
  { key: "REJECTED", label: "Ditolak", status: "REJECTED" },
  { key: "ARCHIVED", label: "Arsip", status: "ARCHIVED" },
];

const CATEGORIES: EventCategory[] = [
  "WORKSHOP",
  "MEETUP",
  "CREATIVE",
  "COMMUNITY",
  "TECH",
  "SEMINAR",
  "OTHER",
];

export default function AdminEventsPage() {
  const { user } = useAuth();

  const isAuthorized =
    (user?.role?.slug === "SUPER_ADMIN" ||
      user?.role?.slug === "OWNER" ||
      user?.role?.slug === "MANAGER") &&
    (user?.scopeLevel === "PLATFORM" || user?.scopeLevel === "ORGANIZATION");

  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Modals state
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Revision / Reject form notes
  const [modalNotes, setModalNotes] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState<Partial<CommunityEvent>>({});

  useEffect(() => {
    if (isAuthorized) {
      loadAdminEvents();
    }
  }, [isAuthorized]);

  const loadAdminEvents = async () => {
    try {
      setIsLoading(true);
      setActionErrorMessage(null);

      const res = await fetch("/api/events/admin", {
        headers: {
          "x-user-role": user?.role?.slug || "MANAGER",
          "x-user-id": user?.id || "admin-user",
          "x-user-scope": user?.scopeLevel || "ORGANIZATION",
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionErrorMessage(json.error || "Gagal memuat data event.");
        return;
      }

      setEvents(json.data || []);
    } catch (err: any) {
      setActionErrorMessage(err.message || "Kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (
    eventId: string,
    newStatus: EventStatus,
    extraData?: { rejectionReason?: string; revisionNotes?: string; adminNotes?: string }
  ) => {
    try {
      setIsProcessingAction(true);
      setActionErrorMessage(null);
      setActionSuccessMessage(null);

      const res = await fetch(`/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role?.slug || "MANAGER",
          "x-user-id": user?.id || "admin-user",
          "x-user-scope": user?.scopeLevel || "ORGANIZATION",
        },
        body: JSON.stringify({
          status: newStatus,
          ...extraData,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setActionErrorMessage(json.error || "Gagal memperbarui status event.");
        return;
      }

      setActionSuccessMessage(json.message);
      setIsRevisionModalOpen(false);
      setIsRejectModalOpen(false);
      setIsDetailModalOpen(false);
      setModalNotes("");

      // Refresh list
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal memproses perubahan status.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent) return;

    try {
      setIsProcessingAction(true);
      setActionErrorMessage(null);

      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role?.slug || "MANAGER",
          "x-user-id": user?.id || "admin-user",
          "x-user-scope": user?.scopeLevel || "ORGANIZATION",
        },
        body: JSON.stringify(editFormData),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setActionErrorMessage(json.error || "Gagal memperbarui rincian event.");
        return;
      }

      setActionSuccessMessage("Rincian event berhasil diperbarui.");
      setIsEditModalOpen(false);
      await loadAdminEvents();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Gagal menyimpan rincian event.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const openEditModal = (event: CommunityEvent) => {
    setSelectedEvent(event);
    setEditFormData({
      title: event.title,
      category: event.category,
      description: event.description,
      location: event.location,
      startDate: event.startDate ? event.startDate.substring(0, 16) : "",
      endDate: event.endDate ? event.endDate.substring(0, 16) : "",
      isPaid: event.isPaid,
      price: event.price,
      posterUrl: event.posterUrl,
      externalRegistrationUrl: event.externalRegistrationUrl || "",
    });
    setIsEditModalOpen(true);
  };

  // Status counts for badges
  const pendingCount = useMemo(
    () => events.filter((e) => e.status === "PENDING").length,
    [events]
  );

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchStatus =
        selectedStatusTab === "ALL" || e.status === selectedStatusTab;
      const matchSearch =
        searchQuery === "" ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.organizerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchSearch;
    });
  }, [events, selectedStatusTab, searchQuery]);

  if (!isAuthorized) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="p-8 text-center bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Akses Dibatasi (Unauthorized)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Halaman moderasi Event Komunitas hanya dapat diakses oleh peran Super Admin, Owner, dan Manager.
            Role Anda saat ini adalah <span className="font-semibold text-rose-600 dark:text-rose-400">{user?.role?.name || "Staff"}</span>.
          </p>
        </Card>
      </div>
    );
  }

  const renderStatusBadge = (status: EventStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
            Menunggu Review
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
            Disetujui (Tayang)
          </Badge>
        );
      case "REVISION_REQUESTED":
        return (
          <Badge className="bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold">
            Perlu Revisi
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold">
            Ditolak
          </Badge>
        );
      case "ARCHIVED":
        return (
          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
            Diarsipkan
          </Badge>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Moderasi Event Komunitas
            </h1>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-extrabold animate-pulse">
                {pendingCount} Baru
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola pengajuan acara dari komunitas publik. Penyelenggara tidak memiliki akun internal; konfirmasi dilakukan langsung melalui email/WhatsApp yang tertera.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAdminEvents}
            disabled={isLoading}
            className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
          <a href="/events" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Lihat Halaman Publik
            </Button>
          </a>
        </div>
      </div>

      {/* Action Notices */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-xs font-bold underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{actionErrorMessage}</span>
          </div>
          <button
            onClick={() => setActionErrorMessage(null)}
            className="text-xs font-bold underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const active = selectedStatusTab === tab.key;
            const count =
              tab.status !== undefined
                ? events.filter((e) => e.status === tab.status).length
                : events.length;

            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatusTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  active
                    ? "bg-[#3B7A57] text-white shadow-sm"
                    : "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pengajuan..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3B7A57]"
          />
        </div>
      </div>

      {/* Table / List View of Events */}
      <Card className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-[#3B7A57] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Memuat pengajuan event...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada pengajuan event pada status ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Event & Poster</th>
                  <th className="py-3 px-4">Kategori & Harga</th>
                  <th className="py-3 px-4">Jadwal & Ruang</th>
                  <th className="py-3 px-4">Penyelenggara</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi Moderasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Event Title & Poster */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={evt.posterUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white block truncate">
                            {evt.title}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-300 font-mono block">
                            ID: {evt.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category & Pricing */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-[10px] border-slate-300 dark:border-slate-700">
                          {evt.category}
                        </Badge>
                        <span className="block font-bold text-slate-800 dark:text-slate-200">
                          {evt.isPaid ? formatCurrencyIDR(evt.price) : "Gratis"}
                        </span>
                      </div>
                    </td>

                    {/* Schedule & Venue */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                          <span>{new Date(evt.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-300 text-[11px]">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{evt.location}</span>
                        </div>
                      </div>
                    </td>

                    {/* Organizer details */}
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="font-semibold block truncate max-w-[140px]">
                          {evt.organizerName}
                        </span>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-300">
                          <a
                            href={`https://wa.me/${evt.organizerPhone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-emerald-600"
                            title="WhatsApp"
                          >
                            <Phone className="w-3 h-3 inline mr-0.5" />
                            WA
                          </a>
                          <span>•</span>
                          <a
                            href={`mailto:${evt.organizerEmail}`}
                            className="hover:text-emerald-600"
                            title="Email"
                          >
                            <Mail className="w-3 h-3 inline mr-0.5" />
                            Email
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(evt.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-1.5">
                        {/* View Details */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEvent(evt);
                            setIsDetailModalOpen(true);
                          }}
                          className="h-8 px-2 text-slate-600 dark:text-slate-400 hover:text-[#3B7A57]"
                          title="Lihat Detail & Kontak"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        {/* Edit details */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(evt)}
                          className="h-8 px-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
                          title="Edit Rincian"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>

                        {/* Approve Quick Button */}
                        {evt.status !== "APPROVED" && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(evt.id, "APPROVED")}
                            disabled={isProcessingAction}
                            className="h-8 px-2.5 bg-[#3B7A57] hover:bg-[#2E6044] text-white text-[11px] font-bold rounded-lg shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Setujui
                          </Button>
                        )}

                        {/* Request Revision */}
                        {evt.status === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEvent(evt);
                              setModalNotes(evt.revisionNotes || "");
                              setIsRevisionModalOpen(true);
                            }}
                            className="h-8 px-2.5 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 hover:bg-sky-50 text-[11px] font-semibold rounded-lg"
                          >
                            Revisi
                          </Button>
                        )}

                        {/* Reject */}
                        {evt.status === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEvent(evt);
                              setModalNotes(evt.rejectionReason || "");
                              setIsRejectModalOpen(true);
                            }}
                            className="h-8 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 text-[11px] rounded-lg"
                            title="Tolak Pengajuan"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* Archive button */}
                        {evt.status === "APPROVED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(evt.id, "ARCHIVED")}
                            className="h-8 px-2 text-slate-400 hover:text-slate-600"
                            title="Arsipkan Event"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[90vh] space-y-5">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 font-mono">ID: {selectedEvent.id}</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Poster Preview */}
            <div className="h-44 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedEvent.posterUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 flex space-x-1.5">
                {renderStatusBadge(selectedEvent.status)}
                <Badge className="bg-slate-900/80 text-white text-[10px]">
                  {selectedEvent.category}
                </Badge>
              </div>
            </div>

            {/* Organizer Contact Card (Private) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Kontak Penyelenggara (Privat):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Nama:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedEvent.organizerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Email:</span>
                  <a href={`mailto:${selectedEvent.organizerEmail}`} className="text-emerald-600 underline">
                    {selectedEvent.organizerEmail}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">WhatsApp / Telp:</span>
                  <a
                    href={`https://wa.me/${selectedEvent.organizerPhone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 underline font-semibold"
                  >
                    {selectedEvent.organizerPhone}
                  </a>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                Pemberitahuan perubahan status atau revisi disampaikan secara manual menggunakan kontak di atas.
              </p>
            </div>

            {/* Description */}
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
              {selectedEvent.description}
            </div>

            {/* Rejection / Revision Notes if exists */}
            {selectedEvent.revisionNotes && (
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs">
                <span className="font-bold block">Catatan Revisi Terakhir:</span>
                {selectedEvent.revisionNotes}
              </div>
            )}
            {selectedEvent.rejectionReason && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
                <span className="font-bold block">Alasan Penolakan:</span>
                {selectedEvent.rejectionReason}
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
                className="text-xs"
              >
                Tutup
              </Button>

              <div className="flex items-center space-x-2">
                {selectedEvent.status !== "APPROVED" && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedEvent.id, "APPROVED")}
                    disabled={isProcessingAction}
                    className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold"
                  >
                    Setujui & Publikasikan
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVISION MODAL */}
      {isRevisionModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Minta Revisi Pengajuan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tuliskan poin yang perlu disesuaikan oleh penyelenggara (misal resolusi poster, penyesuaian jam ruangan, dll).
            </p>

            <textarea
              rows={4}
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Contoh: Mohon perbarui deskripsi agar mencantumkan target peserta dan fasilitas yang disediakan..."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRevisionModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction || !modalNotes.trim()}
                onClick={() =>
                  handleUpdateStatus(selectedEvent.id, "REVISION_REQUESTED", {
                    revisionNotes: modalNotes,
                  })
                }
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
              >
                Kirim Permintaan Revisi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {isRejectModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tolak Pengajuan Event
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tuliskan alasan penolakan untuk catatan kurator internal dan konfirmasi ke penyelenggara.
            </p>

            <textarea
              rows={3}
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Contoh: Ruang amphitheater telah terbooking penuh pada tanggal yang diajukan..."
              className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction || !modalNotes.trim()}
                onClick={() =>
                  handleUpdateStatus(selectedEvent.id, "REJECTED", {
                    rejectionReason: modalNotes,
                  })
                }
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Tolak Pengajuan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto max-h-[90vh] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Informasi Event
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Judul Event</label>
                <input
                  type="text"
                  value={editFormData.title || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Kategori</label>
                  <select
                    value={editFormData.category || "COMMUNITY"}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, category: e.target.value as EventCategory })
                    }
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Lokasi</label>
                  <input
                    type="text"
                    value={editFormData.location || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Waktu Mulai</label>
                  <input
                    type="datetime-local"
                    value={editFormData.startDate || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Waktu Selesai</label>
                  <input
                    type="datetime-local"
                    value={editFormData.endDate || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Deskripsi</label>
                <textarea
                  rows={4}
                  value={editFormData.description || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Harga Tiket (Rp)</label>
                  <input
                    type="number"
                    value={editFormData.price || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        price: Number(e.target.value),
                        isPaid: Number(e.target.value) > 0,
                      })
                    }
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">URL Poster</label>
                  <input
                    type="url"
                    value={editFormData.posterUrl || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, posterUrl: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">URL Pendaftaran Eksternal</label>
                <input
                  type="url"
                  value={editFormData.externalRegistrationUrl || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, externalRegistrationUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={isProcessingAction}
                onClick={handleSaveEdit}
                className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold"
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
