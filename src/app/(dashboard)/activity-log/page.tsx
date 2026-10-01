"use client";

import React, { useState } from "react";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { ActivityLogEntry, ActivityModule, AuditStatus, ActivitySeverity } from "@/types/audit";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Clock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  FileText,
  Lock,
  Calendar,
  Layers,
  Sparkles,
  Zap,
  ListFilter,
  History,
  Code,
  Copy,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Table as TableIcon,
  GitCommit,
  Tag,
  Eye,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import ActivityLogPDFModal from "@/features/activity-log/ActivityLogPDFModal";

type ViewMode = "TABLE" | "TIMELINE";
type DateFilterType = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";

export default function ActivityLogPage() {
  const { user } = useAuth();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { logs, simulateActivity, clearLogs } = useActivityLog();

  const [viewMode, setViewMode] = useState<ViewMode>("TABLE");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("ALL");
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Scoped logs with all filters
  const scopedLogs = logs.filter((l) => {
    // Outlet filter
    if (activeOutletId !== "ALL" && l.outletId && l.outletId !== activeOutletId) {
      return false;
    }

    // Module filter
    if (selectedModule !== "ALL" && l.module !== selectedModule) {
      return false;
    }

    // Status filter
    if (selectedStatus !== "ALL" && l.status !== selectedStatus) {
      return false;
    }

    // Severity filter
    if (selectedSeverity !== "ALL" && l.severity !== selectedSeverity) {
      return false;
    }

    // Date range filter
    const logTime = new Date(l.timestamp).getTime();
    const now = new Date().getTime();
    if (dateFilter === "TODAY") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      if (logTime < startOfDay.getTime()) return false;
    } else if (dateFilter === "LAST_7_DAYS") {
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      if (logTime < sevenDaysAgo) return false;
    } else if (dateFilter === "LAST_30_DAYS") {
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      if (logTime < thirtyDaysAgo) return false;
    }

    // Search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchActor = l.actorName?.toLowerCase().includes(term);
      const matchRole = l.actorRole?.toLowerCase().includes(term);
      const matchAction = l.action?.toLowerCase().includes(term);
      const matchDesc = l.description?.toLowerCase().includes(term);
      const matchReason = l.reason?.toLowerCase().includes(term);
      const matchRecord = l.recordId?.toLowerCase().includes(term);
      const matchPrev = l.previousValue?.toLowerCase().includes(term);
      const matchNext = l.newValue?.toLowerCase().includes(term);

      if (
        !matchActor &&
        !matchRole &&
        !matchAction &&
        !matchDesc &&
        !matchReason &&
        !matchRecord &&
        !matchPrev &&
        !matchNext
      ) {
        return false;
      }
    }

    return true;
  });

  const getPeriodLabel = () => {
    if (dateFilter === "TODAY") return "Hari Ini (" + new Date().toLocaleDateString("id-ID") + ")";
    if (dateFilter === "LAST_7_DAYS") return "7 Hari Terakhir";
    if (dateFilter === "LAST_30_DAYS") return "30 Hari Terakhir";
    return "Semua Rekam Audit";
  };

  // Export handlers
  const handleExportCSV = () => {
    downloadCSV(
      `Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}`,
      [
        "Timestamp",
        "Aktor",
        "Role",
        "Gerai",
        "Modul",
        "Aksi",
        "Record ID",
        "Status",
        "Severity",
        "Nilai Sebelumnya",
        "Nilai Baru",
        "Deskripsi",
        "Alasan",
      ],
      scopedLogs.map((l) => [
        l.timestamp,
        l.actorName,
        l.actorRole,
        l.outletName || "-",
        l.module,
        l.action,
        l.recordId || "-",
        l.status,
        l.severity || "INFO",
        l.previousValue || "-",
        l.newValue || "-",
        l.description,
        l.reason || "-",
      ])
    );
  };

  const handleExportExcel = () => {
    downloadExcel(
      `Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}`,
      "Audit Trail",
      [
        "Timestamp",
        "Aktor",
        "Role",
        "Gerai",
        "Modul",
        "Aksi",
        "Record ID",
        "Status",
        "Severity",
        "Nilai Sebelumnya",
        "Nilai Baru",
        "Deskripsi",
        "Alasan Bisnis",
      ],
      scopedLogs.map((l) => [
        new Date(l.timestamp).toLocaleString("id-ID"),
        l.actorName,
        l.actorRole,
        l.outletName || "-",
        l.module,
        l.action,
        l.recordId || "-",
        l.status,
        l.severity || "INFO",
        l.previousValue || "-",
        l.newValue || "-",
        l.description,
        l.reason || "-",
      ])
    );
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scopedLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Audit_Log_${activeOutlet?.name || "All"}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const copyLogJson = (log: ActivityLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const modulesList = [
    { key: "ALL", label: "Semua Modul" },
    { key: "POS", label: "POS & Kasir" },
    { key: "TABLES", label: "Meja & Reservasi" },
    { key: "INVENTORY", label: "Smart Inventory" },
    { key: "MENU", label: "Katalog Menu" },
    { key: "LOYALTY", label: "Loyalty CRM" },
    { key: "COWORKING", label: "Co-working" },
    { key: "COMMERCIAL", label: "Commercial Leases" },
    { key: "EMPLOYEES_SHIFT", label: "Shift & Staf" },
    { key: "SETTINGS", label: "Pengaturan Platform" },
    { key: "AUTH", label: "Keamanan & Auth" },
    { key: "AI_INSIGHT", label: "AI Advisor" },
  ];

  // Stats calculation
  const totalCount = scopedLogs.length;
  const successCount = scopedLogs.filter((l) => l.status === "SUCCESS").length;
  const warningCount = scopedLogs.filter((l) => l.status === "WARNING").length;
  const failedCount = scopedLogs.filter((l) => l.status === "FAILED").length;
  const highSeverityCount = scopedLogs.filter(
    (l) => l.severity === "HIGH" || l.severity === "CRITICAL"
  ).length;

  const currentRoleStr =
    typeof user?.role === "object" && user.role
      ? user.role.name
      : typeof user?.role === "string"
      ? user.role
      : "Owner";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-100 rounded-xl border border-purple-200 text-purple-700 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">Audit Trail & Activity Log</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>LIVE RECORDING</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pencatatan aktivitas terstruktur, transformasional (Before ➔ After), dan immutable di seluruh proses sistem • Outlet:{" "}
                <span className="font-bold text-slate-800">{activeOutlet?.name || "Semua Outlet"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Simulation Trigger Button */}
          <Button
            size="sm"
            onClick={() => setShowSimModal(!showSimModal)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold space-x-1.5 shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Simulasi Event</span>
          </Button>

          {/* Export PDF Button */}
          <Button
            size="sm"
            onClick={() => setIsPdfModalOpen(true)}
            className="text-xs bg-purple-700 hover:bg-purple-800 text-white font-semibold space-x-1 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </Button>

          {/* Export Excel Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="text-xs space-x-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel (.xls)</span>
          </Button>

          {/* Export CSV Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs space-x-1 border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </Button>

          {/* Export JSON Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportJSON}
            className="text-xs space-x-1 border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Code className="w-3.5 h-3.5 text-slate-500" />
            <span>JSON</span>
          </Button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode("TABLE")}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "TABLE"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel</span>
            </button>
            <button
              onClick={() => setViewMode("TIMELINE")}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === "TIMELINE"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Simulation Banner (Expandable) */}
      {showSimModal && (
        <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                Simulasi Aksi & Pengujian Pencatatan Audit Log
              </h4>
            </div>
            <button
              onClick={() => setShowSimModal(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Klik tombol simulasi di bawah untuk menguji penambahan entri log baru secara instan dan melihat visualisasi transformasinya:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                simulateActivity("VOID");
                setShowSimModal(false);
              }}
              className="text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-50 space-x-1"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Void Pesanan Kasir (Warning)</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                simulateActivity("DISCOUNT");
                setShowSimModal(false);
              }}
              className="text-xs bg-white border-purple-300 text-purple-900 hover:bg-purple-50 space-x-1"
            >
              <Tag className="w-3.5 h-3.5 text-purple-600" />
              <span>Redeem Poin Diskon (Loyalty)</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                simulateActivity("STOCK_DIFF");
                setShowSimModal(false);
              }}
              className="text-xs bg-white border-blue-300 text-blue-900 hover:bg-blue-50 space-x-1"
            >
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>Selisih Stok Opname (Inventory)</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                simulateActivity("CONFIG_CHANGE");
                setShowSimModal(false);
              }}
              className="text-xs bg-white border-slate-300 text-slate-900 hover:bg-slate-50 space-x-1"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
              <span>Ubah Ambang Loyalty (Settings)</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                simulateActivity("RESERVATION");
                setShowSimModal(false);
              }}
              className="text-xs bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50 space-x-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Reservasi Meja Baru (Tables)</span>
            </Button>
          </div>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Jejak Audit</p>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{totalCount} Entri</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Tercatat terstruktur & kekal</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Berhasil (Success)</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{successCount}</p>
          <p className="text-[11px] text-emerald-700/80 font-medium mt-0.5">
            {totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0}% integritas sistem
          </p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peringatan / Selisih</p>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{warningCount}</p>
          <p className="text-[11px] text-amber-700/80 font-medium mt-0.5">Void, selisih stok & kas</p>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">High / Critical</p>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-600 mt-2">{highSeverityCount}</p>
          <p className="text-[11px] text-purple-700/80 font-medium mt-0.5">Aksi butuh otorisasi tinggi</p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Row 1: Search & Date Range */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari aksi, nama aktor, record ID, alasan, nilai..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
            />
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center space-x-1.5 w-full md:w-auto overflow-x-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 font-semibold shrink-0">Waktu:</span>
            {[
              { key: "ALL", label: "Semua" },
              { key: "TODAY", label: "Hari Ini" },
              { key: "LAST_7_DAYS", label: "7 Hari" },
              { key: "LAST_30_DAYS", label: "30 Hari" },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setDateFilter(d.key as DateFilterType)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold shrink-0 transition-colors ${
                  dateFilter === d.key
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex items-center space-x-1 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-semibold shrink-0">Status:</span>
            {(["ALL", "SUCCESS", "WARNING", "FAILED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2 py-1 text-[11px] rounded-lg font-bold transition-colors ${
                  selectedStatus === st
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "Semua" : st}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Module Badges */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400 font-bold shrink-0 uppercase text-[10px] mr-1">
            Modul:
          </span>
          {modulesList.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedModule(m.key)}
              className={`px-2.5 py-1 text-[11px] rounded-full font-bold shrink-0 transition-all ${
                selectedModule === m.key
                  ? "bg-purple-100 text-purple-900 border border-purple-300 shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content: View Mode SWITCH */}
      {viewMode === "TABLE" ? (
        /* TABLE VIEW */
        <Card className="shadow-xs border border-slate-200 overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daftar Rekam Jejak Audit ({scopedLogs.length} Entri Ditemukan)
            </CardTitle>
            <span className="text-[11px] font-semibold text-slate-500">
              Menampilkan entri terkini
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {scopedLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">Tidak ada log aktivitas sesuai kriteria</p>
                <p className="text-xs mt-1 text-slate-500">
                  Coba ubah kata kunci pencarian, rentang waktu, atau filter modul di atas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Waktu (Timestamp)</th>
                      <th className="px-4 py-3">Aktor & Role</th>
                      <th className="px-4 py-3">Modul & Aksi</th>
                      <th className="px-4 py-3">Perubahan Nilai / Deskripsi</th>
                      <th className="px-4 py-3">Alasan (Reason)</th>
                      <th className="px-4 py-3 text-center">Severity</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scopedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          <div>
                            {new Date(log.timestamp).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold">
                            {new Date(log.timestamp).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            WITA
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{log.actorName}</div>
                          <div className="text-[10px] text-purple-600 font-bold">{log.actorRole}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-bold mb-0.5">
                            {log.module}
                          </span>
                          <div className="font-bold text-slate-800 text-[11px]">{log.action}</div>
                          {log.recordId && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              #{log.recordId}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-sm">
                          <div className="text-slate-800 line-clamp-1 font-medium">{log.description}</div>
                          {log.previousValue && log.newValue && (
                            <div className="text-[10px] text-slate-600 flex items-center space-x-1 mt-1 font-mono bg-slate-50 p-1 rounded border border-slate-100">
                              <span className="text-red-600 line-through truncate max-w-[120px]">
                                {log.previousValue}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="text-emerald-700 font-bold truncate max-w-[150px]">
                                {log.newValue}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate text-[11px]">
                          {log.reason || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                              log.severity === "CRITICAL"
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : log.severity === "HIGH"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : log.severity === "MEDIUM"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {log.severity || "INFO"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === "SUCCESS"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.status === "WARNING"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLog(log)}
                            className="text-[11px] h-7 px-2.5 text-purple-700 hover:bg-purple-50 border-purple-200"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            <span>Detail</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* TIMELINE STREAM VIEW */
        <div className="space-y-4">
          {scopedLogs.length === 0 ? (
            <Card className="p-12 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">Tidak ada log aktivitas sesuai kriteria</p>
            </Card>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {scopedLogs.map((log) => (
                <div key={log.id} className="relative group">
                  {/* Timeline Dot Icon */}
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                      log.status === "SUCCESS"
                        ? "border-emerald-500 text-emerald-600"
                        : log.status === "WARNING"
                        ? "border-amber-500 text-amber-600"
                        : "border-red-500 text-red-600"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        log.status === "SUCCESS"
                          ? "bg-emerald-500"
                          : log.status === "WARNING"
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                    ></div>
                  </div>

                  {/* Timeline Card */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-800 rounded">
                          {log.module}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{log.action}</h4>
                        {log.recordId && (
                          <span className="text-[10px] font-mono text-slate-400">
                            #{log.recordId}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                        <span className="font-mono">
                          {new Date(log.timestamp).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}{" "}
                          WITA
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : log.status === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-800 font-medium">{log.description}</p>

                    {/* Diff Preview */}
                    {(log.previousValue || log.newValue) && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs font-mono space-y-1">
                        {log.previousValue && (
                          <div className="text-red-600 line-through text-[11px]">
                            <span className="text-slate-400 font-semibold mr-1">SEBELUM:</span>
                            {log.previousValue}
                          </div>
                        )}
                        {log.newValue && (
                          <div className="text-emerald-700 font-bold text-[11px]">
                            <span className="text-slate-400 font-semibold mr-1">SESUDAH:</span>
                            {log.newValue}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 text-xs">
                      <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Oleh:</span>
                        <span className="font-bold text-slate-800">{log.actorName}</span>
                        <span className="text-purple-600 font-semibold">({log.actorRole})</span>
                        {log.outletName && (
                          <>
                            <span>•</span>
                            <span>{log.outletName}</span>
                          </>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                        className="text-[11px] h-6 px-2 text-purple-700 hover:bg-purple-50"
                      >
                        Detail Lengkap
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Detail Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Rincian Rekam Jejak Audit</h3>
                  <p className="text-xs text-slate-400">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Metadata Table */}
            <div className="space-y-2.5 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 font-medium">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Waktu Tercatat:</span>
                <span className="font-mono text-slate-900 font-bold">
                  {new Date(selectedLog.timestamp).toLocaleString("id-ID", {
                    dateStyle: "full",
                    timeStyle: "medium",
                  })}{" "}
                  WITA
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Aktor & Role:</span>
                <span className="font-bold text-slate-900">
                  {selectedLog.actorName}{" "}
                  <span className="text-purple-700">({selectedLog.actorRole})</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Scope Bisnis / Outlet:</span>
                <span className="font-semibold text-slate-800">
                  {selectedLog.organizationName || "Dago Creative Hub"} • {selectedLog.outletName || "Semua"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Modul & Kode Aksi:</span>
                <span className="font-mono font-bold text-purple-800">
                  [{selectedLog.module}] {selectedLog.action}
                </span>
              </div>
              {selectedLog.recordId && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Target Record ID:</span>
                  <span className="font-mono text-slate-900 font-bold bg-slate-200/70 px-2 py-0.5 rounded">
                    {selectedLog.recordId}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Status & Severity:</span>
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedLog.status === "SUCCESS"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedLog.status === "WARNING"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedLog.status}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                    {selectedLog.severity || "INFO"}
                  </span>
                </div>
              </div>
            </div>

            {/* Before vs After Visual Diff */}
            {(selectedLog.previousValue || selectedLog.newValue) && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  Transformasi Data (Before ➔ After):
                </span>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                  {selectedLog.previousValue && (
                    <div className="text-red-700 bg-red-50 p-2 rounded border border-red-100">
                      <strong className="text-red-900 block text-[10px]">NILAI SEBELUMNYA:</strong>
                      {selectedLog.previousValue}
                    </div>
                  )}
                  {selectedLog.newValue && (
                    <div className="text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-100">
                      <strong className="text-emerald-900 block text-[10px]">NILAI SESUDAH:</strong>
                      {selectedLog.newValue}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description & Audit Reason */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Deskripsi & Narasi Aksi:</span>
              <p className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800">
                {selectedLog.description}
              </p>
              {selectedLog.reason && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold">Alasan / Business Reason:</span> {selectedLog.reason}
                </div>
              )}
            </div>

            {/* Raw JSON Payload / Metadata */}
            {selectedLog.metadata && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Payload Metadata (JSON):</span>
                  <button
                    onClick={() => copyLogJson(selectedLog)}
                    className="text-[11px] text-purple-700 hover:text-purple-900 flex items-center space-x-1 font-semibold"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedJson ? "Tersalin!" : "Salin JSON"}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[10px] font-mono overflow-x-auto max-h-36">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Kekal & Terenkripsi</span>
              </div>
              <Button
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      <ActivityLogPDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        logs={scopedLogs}
        outletName={activeOutlet?.name || "Semua Gerai"}
        generatedBy={user?.name || "Hendra Wijaya"}
        generatedRole={currentRoleStr}
        periodLabel={getPeriodLabel()}
      />
    </div>
  );
}
