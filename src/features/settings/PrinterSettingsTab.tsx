"use client";

import React, { useState } from "react";
import {
  PrinterDeviceConfig,
  POSPrintingSettings,
  PrinterConnectionType,
  PrinterPaperWidth,
  PrinterRole,
  PrintJob,
  PrintJobStatus,
} from "@/types/printer";
import { usePrinter } from "@/contexts/PrinterContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Printer,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Check,
  X,
  Radio,
  Server,
  Cpu,
  Wifi,
  FileText,
  Clock,
  Sparkles,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PrinterSettingsTab() {
  const { user } = useAuth();
  const { outlets } = useOutlet();
  const {
    devices,
    settings,
    queue,
    addDevice,
    updateDevice,
    deleteDevice,
    updateSettings,
    testPrintDevice,
    retryPrintJob,
    clearQueueHistory,
  } = usePrinter();

  const isManagerOrAdmin =
    user?.role?.slug === "SUPER_ADMIN" ||
    user?.role?.slug === "OWNER" ||
    user?.role?.slug === "MANAGER" ||
    user?.scopeLevel === "ORGANIZATION" ||
    user?.scopeLevel === "PLATFORM";

  // Local Form state for operational settings
  const [localSettings, setLocalSettings] = useState<POSPrintingSettings>(settings);
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  // Device Modal state
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formOutletId, setFormOutletId] = useState("ALL");
  const [formRole, setFormRole] = useState<PrinterRole>("KITCHEN_ORDER");
  const [formConnectionType, setFormConnectionType] = useState<PrinterConnectionType>("BROWSER_SYSTEM");
  const [formBridgeEndpoint, setFormBridgeEndpoint] = useState("http://localhost:8080/print");
  const [formLanIp, setFormLanIp] = useState("");
  const [formLanPort, setFormLanPort] = useState(9100);
  const [formPaperWidth, setFormPaperWidth] = useState<PrinterPaperWidth>("80mm");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefaultKitchen, setFormIsDefaultKitchen] = useState(false);
  const [formIsDefaultCustomer, setFormIsDefaultCustomer] = useState(false);
  const [formNotes, setFormNotes] = useState("");

  // Testing & Action Feedback
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const openAddModal = () => {
    setEditingDeviceId(null);
    setFormName("");
    setFormOutletId("ALL");
    setFormRole("KITCHEN_ORDER");
    setFormConnectionType("BROWSER_SYSTEM");
    setFormBridgeEndpoint("http://localhost:8080/print");
    setFormLanIp("");
    setFormLanPort(9100);
    setFormPaperWidth("80mm");
    setFormIsActive(true);
    setFormIsDefaultKitchen(false);
    setFormIsDefaultCustomer(false);
    setFormNotes("");
    setIsDeviceModalOpen(true);
  };

  const openEditModal = (device: PrinterDeviceConfig) => {
    setEditingDeviceId(device.id);
    setFormName(device.name);
    setFormOutletId(device.outletId);
    setFormRole(device.role);
    setFormConnectionType(device.connectionType);
    setFormBridgeEndpoint(device.bridgeEndpoint || "http://localhost:8080/print");
    setFormLanIp(device.lanIpAddress || "");
    setFormLanPort(device.lanPort || 9100);
    setFormPaperWidth(device.paperWidth);
    setFormIsActive(device.isActive);
    setFormIsDefaultKitchen(device.isDefaultKitchen);
    setFormIsDefaultCustomer(device.isDefaultCustomer);
    setFormNotes(device.notes || "");
    setIsDeviceModalOpen(true);
  };

  const handleSaveDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const matchedOutlet = outlets.find((o) => o.id === formOutletId);
    const outletName = formOutletId === "ALL" ? "Semua Outlet" : matchedOutlet?.name || "Outlet";

    if (editingDeviceId) {
      updateDevice(editingDeviceId, {
        name: formName.trim(),
        outletId: formOutletId,
        outletName,
        role: formRole,
        connectionType: formConnectionType,
        bridgeEndpoint: formConnectionType === "LOCAL_BRIDGE" ? formBridgeEndpoint.trim() : undefined,
        lanIpAddress: formConnectionType === "NETWORK_LAN_VIA_BRIDGE" ? formLanIp.trim() : undefined,
        lanPort: formConnectionType === "NETWORK_LAN_VIA_BRIDGE" ? Number(formLanPort) : undefined,
        paperWidth: formPaperWidth,
        isActive: formIsActive,
        isDefaultKitchen: formIsDefaultKitchen,
        isDefaultCustomer: formIsDefaultCustomer,
        notes: formNotes.trim(),
      });
    } else {
      addDevice({
        name: formName.trim(),
        outletId: formOutletId,
        outletName,
        role: formRole,
        connectionType: formConnectionType,
        bridgeEndpoint: formConnectionType === "LOCAL_BRIDGE" ? formBridgeEndpoint.trim() : undefined,
        lanIpAddress: formConnectionType === "NETWORK_LAN_VIA_BRIDGE" ? formLanIp.trim() : undefined,
        lanPort: formConnectionType === "NETWORK_LAN_VIA_BRIDGE" ? Number(formLanPort) : undefined,
        paperWidth: formPaperWidth,
        isActive: formIsActive,
        isDefaultKitchen: formIsDefaultKitchen,
        isDefaultCustomer: formIsDefaultCustomer,
        notes: formNotes.trim(),
      });
    }

    setIsDeviceModalOpen(false);
  };

  const handleSaveOperationalSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(localSettings);
    setSavedSettingsSuccess(true);
    setTimeout(() => setSavedSettingsSuccess(false), 3000);
  };

  const handleTestPrint = async (deviceId: string) => {
    setTestingDeviceId(deviceId);
    setTestResult(null);
    try {
      const res = await testPrintDevice(deviceId);
      setTestResult({
        id: deviceId,
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        id: deviceId,
        success: false,
        message: err?.message || "Uji coba printer gagal.",
      });
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    setRetryResult(null);
    try {
      const res = await retryPrintJob(jobId);
      setRetryResult({
        id: jobId,
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setRetryResult({
        id: jobId,
        success: false,
        message: err?.message || "Coba lagi gagal.",
      });
    } finally {
      setRetryingJobId(null);
    }
  };

  const getStatusBadge = (status: PrintJobStatus) => {
    switch (status) {
      case "BRIDGE_ACKNOWLEDGED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">BRIDGE ACK</span>;
      case "SENT_TO_SPOOLER":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">SPOOLER DIKIRIM</span>;
      case "PRINTING":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">PROSES</span>;
      case "OFFLINE":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">OFFLINE</span>;
      case "FAILED":
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">GAGAL</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Card */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Konfigurasi Printer & Nota Operasional POS
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kelola printer kasir, printer dapur otomatis, ukuran kertas thermal, dan antrean cetak per outlet.
              </p>
            </div>
          </div>
          {isManagerOrAdmin ? (
            <Button
              type="button"
              size="sm"
              onClick={openAddModal}
              className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl space-x-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Perangkat Printer</span>
            </Button>
          ) : (
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
              Mode Baca (Akses Khusus Manager / Admin)
            </span>
          )}
        </div>

        {/* Quick Diagnostics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Printer Dapur Aktif:</span>
            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
              {devices.find((d) => d.isActive && (d.role === "KITCHEN_ORDER" || d.role === "ALL") && d.isDefaultKitchen)?.name || "Belum Ditetapkan"}
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Printer Kasir Aktif:</span>
            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
              {devices.find((d) => d.isActive && (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL") && d.isDefaultCustomer)?.name || "Belum Ditetapkan"}
            </span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Status Antrean Terakhir:</span>
            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
              {queue.length > 0 ? `${queue.length} Pekerjaan Tercatat` : "Antrean Bersih (Siap Cetak)"}
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Daftar Perangkat Printer (Hardware Devices) */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Daftar Perangkat Printer Terdaftar
            </h4>
            <p className="text-xs text-slate-400">
              Konfigurasi perangkat fisik thermal yang siap menerima payload cetak dari POS.
            </p>
          </div>
        </div>

        {/* Test Result Toast/Banner */}
        {testResult && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center justify-between border ${
              testResult.success
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3">Nama Printer</th>
                <th className="py-3 px-3">Peran / Tujuan</th>
                <th className="py-3 px-3">Outlet</th>
                <th className="py-3 px-3">Jalur Koneksi</th>
                <th className="py-3 px-3 text-center">Kertas</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <span>{d.name}</span>
                      {d.isDefaultKitchen && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                          Default Dapur
                        </span>
                      )}
                      {d.isDefaultCustomer && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
                          Default Kasir
                        </span>
                      )}
                    </p>
                    {d.notes && <p className="text-[10px] text-slate-400">{d.notes}</p>}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {d.role === "KITCHEN_ORDER"
                        ? "Nota Dapur"
                        : d.role === "CUSTOMER_RECEIPT"
                        ? "Struk Kasir"
                        : d.role === "BAR_STATION"
                        ? "Bar / Minuman"
                        : "Semua (Kasir + Dapur)"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">
                    {d.outletId === "ALL" ? "Semua Outlet" : d.outletName || d.outletId}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 block">
                      {d.connectionType === "BROWSER_SYSTEM"
                        ? "System / Browser Spooler"
                        : d.connectionType === "LOCAL_BRIDGE"
                        ? isManagerOrAdmin
                          ? `Bridge Agent (${d.bridgeEndpoint || "localhost:8080"})`
                          : "Bridge Agent Lokal"
                        : isManagerOrAdmin
                        ? `LAN IP (${d.lanIpAddress || "Belum diatur"})`
                        : "LAN Printer Network"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {d.paperWidth}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {d.isActive ? "AKTIF" : "NON-AKTIF"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={testingDeviceId === d.id}
                        onClick={() => handleTestPrint(d.id)}
                        className="h-7 px-2 text-[11px] font-bold border-slate-200 dark:border-slate-700 cursor-pointer"
                        title="Uji koneksi pengiriman tiket ke printer ini"
                      >
                        <Printer className="w-3 h-3 mr-1" />
                        <span>{testingDeviceId === d.id ? "Menguji..." : "Test Print"}</span>
                      </Button>
                      {isManagerOrAdmin && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(d)}
                            className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                            title="Ubah Konfigurasi Printer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Hapus konfigurasi printer '${d.name}'?`)) {
                                deleteDevice(d.id);
                              }
                            }}
                            className="h-7 w-7 p-0 rounded-lg text-rose-500 hover:text-rose-700 dark:hover:text-rose-400"
                            title="Hapus Printer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3. Aturan Operasional Pencetakan POS & Dapur */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
        <form onSubmit={handleSaveOperationalSettings} className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Aturan & Otomatisasi Pencetakan Operasional
              </h4>
              <p className="text-xs text-slate-400">
                Tentukan kapan nota dapur dan struk kasir dicetak otomatis tanpa intervensi manual.
              </p>
            </div>
            {isManagerOrAdmin ? (
              <Button
                type="submit"
                size="sm"
                className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl space-x-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Aturan</span>
              </Button>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                Hanya Dapat Diubah Manager
              </span>
            )}
          </div>

          {savedSettingsSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan pencetakan operasional berhasil disimpan dan aktif!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Toggle 1: Auto Print Kitchen */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Cetak Otomatis Nota Dapur</p>
                <p className="text-[11px] text-slate-500">
                  Kirim nota pesanan langsung ke printer dapur saat transaksi POS dikonfirmasi.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoPrintKitchenOrder}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, autoPrintKitchenOrder: e.target.checked }))
                }
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Toggle 2: Auto Print Customer */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Cetak Otomatis Struk Pelanggan</p>
                <p className="text-[11px] text-slate-500">
                  Buka dialog/spooler struk kasir segera setelah pembayaran dinyatakan lunas.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoPrintCustomerReceipt}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, autoPrintCustomerReceipt: e.target.checked }))
                }
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Toggle 3: Include Notes */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Cetak Catatan Khusus di Dapur</p>
                <p className="text-[11px] text-slate-500">
                  Tampilkan instruksi menu (misal: pedas, tanpa daun bawang) di nota dapur.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.includeNotesOnKitchenTicket}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, includeNotesOnKitchenTicket: e.target.checked }))
                }
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Toggle 4: Additional Orders */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Tiket Pesanan Tambahan</p>
                <p className="text-[11px] text-slate-500">
                  Otomatis cetak tiket penambahan menu dengan label 'PESANAN TAMBAHAN'.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoPrintAdditionalOrder}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, autoPrintAdditionalOrder: e.target.checked }))
                }
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Toggle 5: Cancellation Notice */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Tiket Pembatalan Pesanan</p>
                <p className="text-[11px] text-slate-500">
                  Kirim slip pembatalan ke dapur jika pesanan yang telah tercetak dibatalkan.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoPrintCancellationNotice}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, autoPrintCancellationNotice: e.target.checked }))
                }
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Toggle 6: Reprint Watermark */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Watermark Cetak Ulang (Reprint)</p>
                <p className="text-[11px] text-slate-500">
                  Wajib beri stempel 'SALINAN / REPRINT' pada cetak ulang agar dapur tidak memasak dobel.
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.reprintWatermarkEnabled}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, reprintWatermarkEnabled: e.target.checked }))
                }
                className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Additional text parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Catatan Footer Nota Dapur:
              </label>
              <input
                type="text"
                value={localSettings.kitchenFooterNote || ""}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, kitchenFooterNote: e.target.value }))
                }
                placeholder="MOHON DIPROSES"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Batas Percobaan Ulang Gagal (Max Retries):
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={localSettings.maxRetryAttempts}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, maxRetryAttempts: Number(e.target.value) || 3 }))
                }
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>
        </form>
      </Card>

      {/* 4. Live Print Queue Monitor (Antrean Cetak Persisten) */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Pemantau Antrean & Riwayat Cetak (Persistent Queue)</span>
            </h4>
            <p className="text-xs text-slate-400">
              Riwayat pengiriman tiket cetak ke printer kasir & dapur pada workstation ini.
            </p>
          </div>
          {queue.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearQueueHistory}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 border-slate-200 dark:border-slate-700"
            >
              Bersihkan Riwayat
            </Button>
          )}
        </div>

        {retryResult && (
          <div
            className={`p-3 rounded-xl mb-3 text-xs font-semibold flex items-center justify-between border ${
              retryResult.success
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200"
            }`}
          >
            <span>{retryResult.message}</span>
            <button
              type="button"
              onClick={() => setRetryResult(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {queue.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold">Belum ada antrean cetak dalam sesi ini.</p>
            <p className="text-[11px] mt-0.5">Seluruh pesanan baru dari POS akan dicatat secara transparan di sini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">No. Pesanan</th>
                  <th className="py-2.5 px-3">Tipe Nota</th>
                  <th className="py-2.5 px-3">Tujuan</th>
                  <th className="py-2.5 px-3">Printer</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Percobaan</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {queue.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(job.createdAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {job.orderNumber || "-"}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {job.receiptType === "KITCHEN_ORDER" ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">Nota Dapur</span>
                      ) : (
                        <span className="text-blue-700 dark:text-blue-400 font-bold">Struk Kasir</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 font-semibold">
                        {job.purpose}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      {job.printerName}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {getStatusBadge(job.status)}
                      {job.errorInfo && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 max-w-[200px] truncate mx-auto mt-0.5" title={job.errorInfo}>
                          {job.errorInfo}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {job.attempts}x
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {job.status === "FAILED" || job.status === "OFFLINE" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={retryingJobId === job.id}
                          onClick={() => handleRetryJob(job.id)}
                          className="h-6 px-2 text-[10px] font-bold text-amber-700 border-amber-300 hover:bg-amber-50 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          <span>{retryingJobId === job.id ? "Mengirim..." : "Coba Lagi"}</span>
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 5. Panduan Koneksi Hardware & Keterbatasan Browser */}
      <Card className="p-4 border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl text-xs space-y-2 text-slate-700 dark:text-slate-300">
        <div className="flex items-center space-x-2 font-bold text-blue-900 dark:text-blue-300">
          <Info className="w-4 h-4 text-blue-600" />
          <span>Informasi Teknis & Keterbatasan Lingkungan Web POS</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          1. <strong>System / Browser Spooler (Default Universal)</strong>: Menggunakan driver printer OS yang sudah terpasang. Karena keterbatasan sandbox browser, sistem mencatat status <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">SENT_TO_SPOOLER</code> saat dialog cetak berhasil dipanggil.
        </p>
        <p className="leading-relaxed text-[11px]">
          2. <strong>Local Print Bridge (Silent Printing Nyata)</strong>: Untuk mencetak langsung tanpa pop-up browser, jalankan service agent lokal (misal di <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">http://localhost:8080/print</code> atau RawBT untuk tablet Android kasir). Sistem akan menerima sinyal <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">BRIDGE_ACKNOWLEDGED</code> saat data diterima agent.
        </p>
        <p className="leading-relaxed text-[11px]">
          3. <strong>Printer Jaringan / LAN ESC/POS (Port 9100)</strong>: Karena browser tidak diizinkan membuka koneksi raw TCP socket langsung ke alamat IP lokal, koneksi LAN memerlukan perantara Local Print Agent atau server relay terkonfigurasi.
        </p>
      </Card>

      {/* MODAL TAMBAH / UBAH PRINTER */}
      {isDeviceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <Card className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {editingDeviceId ? "Ubah Konfigurasi Printer" : "Tambah Perangkat Printer"}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDeviceModalOpen(false)}
                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Printer (e.g. Printer Dapur Utama 80mm):
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Printer Dapur Thermal..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Outlet Penempatan:
                  </label>
                  <select
                    value={formOutletId}
                    onChange={(e) => setFormOutletId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="ALL">Semua Outlet (Global)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Peran / Tujuan Dokumen:
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as PrinterRole)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="KITCHEN_ORDER">Nota Dapur (Kitchen)</option>
                    <option value="CUSTOMER_RECEIPT">Struk Kasir (Customer)</option>
                    <option value="BAR_STATION">Bar / Minuman</option>
                    <option value="ALL">Semua Dokumen</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Jalur Koneksi Printer:
                  </label>
                  <select
                    value={formConnectionType}
                    onChange={(e) => setFormConnectionType(e.target.value as PrinterConnectionType)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="BROWSER_SYSTEM">Browser / System Spooler (Default)</option>
                    <option value="LOCAL_BRIDGE">Local Print Bridge (Silent)</option>
                    <option value="NETWORK_LAN_VIA_BRIDGE">LAN ESC/POS via Bridge Relay</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Lebar Kertas Thermal:
                  </label>
                  <select
                    value={formPaperWidth}
                    onChange={(e) => setFormPaperWidth(e.target.value as PrinterPaperWidth)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="80mm">80mm (Standar Dapur / Kasir Besar)</option>
                    <option value="58mm">58mm (Thermal Mini Kasir)</option>
                  </select>
                </div>
              </div>

              {/* Conditional Connection Details */}
              {formConnectionType === "LOCAL_BRIDGE" && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    Endpoint Agen Print Lokal:
                  </label>
                  <input
                    type="url"
                    value={formBridgeEndpoint}
                    onChange={(e) => setFormBridgeEndpoint(e.target.value)}
                    placeholder="http://localhost:8080/print"
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-400">
                    Aplikasi agent lokal (QZ Tray / RawBT / custom script) menerima JSON payload untuk cetak hening.
                  </p>
                </div>
              )}

              {formConnectionType === "NETWORK_LAN_VIA_BRIDGE" && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Alamat IP Printer LAN:
                      </label>
                      <input
                        type="text"
                        value={formLanIp}
                        onChange={(e) => setFormLanIp(e.target.value)}
                        placeholder="192.168.1.200"
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Port Raw (Default 9100):
                      </label>
                      <input
                        type="number"
                        value={formLanPort}
                        onChange={(e) => setFormLanPort(Number(e.target.value) || 9100)}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Browser meneruskan payload raw ESC/POS ke relai lokal untuk diteruskan via TCP socket port 9100.
                  </p>
                </div>
              )}

              {/* Defaults & Status Toggles */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-slate-300"
                  />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Aktifkan Perangkat Printer Ini
                  </span>
                </label>

                {(formRole === "KITCHEN_ORDER" || formRole === "ALL") && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsDefaultKitchen}
                      onChange={(e) => setFormIsDefaultKitchen(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-slate-300"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Jadikan Printer Default untuk Nota Dapur
                    </span>
                  </label>
                )}

                {(formRole === "CUSTOMER_RECEIPT" || formRole === "ALL") && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsDefaultCustomer}
                      onChange={(e) => setFormIsDefaultCustomer(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Jadikan Printer Default untuk Struk Kasir
                    </span>
                  </label>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Catatan / Lokasi Fisik:
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Misal: Dapur belakang dekat station wok..."
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="text-xs h-9"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold h-9 px-4 rounded-xl"
                >
                  {editingDeviceId ? "Simpan Perubahan" : "Tambahkan Printer"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

