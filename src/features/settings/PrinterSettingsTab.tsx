"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Info,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { notify } from "@/components/app/notify";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { usePrinter } from "@/contexts/PrinterContext";
import {
  CONFIGURABLE_RECEIPT_ROLES,
  DEFAULT_RECEIPT_ROLE_POLICY,
  canManageSettlementAndReceiptPolicy,
} from "@/lib/settlement-receipt-policy";
import type { RoleSlug } from "@/types/auth";
import type {
  POSPrintingSettings,
  PrinterConnectionType,
  PrinterDeviceConfig,
  PrinterPaperWidth,
  PrinterRole,
} from "@/types/printer";

import {
  printerConnectionLabel,
  printerRoleLabel,
  printJobStatusLabel,
  printJobStatusTone,
} from "./settings-domain";

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
  const canManageReceiptRoles = canManageSettlementAndReceiptPolicy(user);

  // Local Form state for operational settings
  const [localSettings, setLocalSettings] = useState<POSPrintingSettings>(settings);
  const [savedSettingsSuccess, setSavedSettingsSuccess] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const cashierReceiptRoles =
    localSettings.cashierReceiptRoles ?? DEFAULT_RECEIPT_ROLE_POLICY.cashierReceiptRoles;
  const kitchenReceiptRoles =
    localSettings.kitchenReceiptRoles ?? DEFAULT_RECEIPT_ROLE_POLICY.kitchenReceiptRoles;

  const toggleReceiptRole = (
    kind: "cashierReceiptRoles" | "kitchenReceiptRoles",
    role: RoleSlug,
    enabled: boolean
  ) => {
    if (!canManageReceiptRoles) return;
    setLocalSettings((prev) => {
      const current = prev[kind] ?? DEFAULT_RECEIPT_ROLE_POLICY[kind];
      const nextSet = new Set<RoleSlug>(current);
      nextSet.add("SUPER_ADMIN");
      if (enabled) {
        nextSet.add(role);
      } else {
        nextSet.delete(role);
      }
      return {
        ...prev,
        [kind]: Array.from(nextSet),
      };
    });
  };

  // Device Modal state
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
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
    setFormOutletId("outlet-sgr");
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
    setFormOutletId(device.outletId === "ALL" ? "outlet-sgr" : device.outletId);
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

    const payload: Omit<PrinterDeviceConfig, "id" | "createdAt" | "updatedAt"> = {
      name: formName.trim(),
      outletId: formOutletId,
      outletName: outlets.find((o) => o.id === formOutletId)?.name || "Semua Outlet",
      role: formRole,
      connectionType: formConnectionType,
      bridgeEndpoint: formConnectionType !== "BROWSER_SYSTEM" ? formBridgeEndpoint.trim() : undefined,
      lanIpAddress: formConnectionType === "NETWORK_LAN_VIA_BRIDGE" ? formLanIp.trim() : undefined,
      lanPort: formConnectionType === "NETWORK_LAN_VIA_BRIDGE" ? Number(formLanPort) || 9100 : undefined,
      paperWidth: formPaperWidth,
      isActive: formIsActive,
      isDefaultKitchen: formIsDefaultKitchen,
      isDefaultCustomer: formIsDefaultCustomer,
      notes: formNotes.trim() || undefined,
    };

    if (editingDeviceId) {
      updateDevice(editingDeviceId, payload);
    } else {
      addDevice(payload);
    }

    setIsDeviceModalOpen(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(
      canManageReceiptRoles
        ? localSettings
        : {
            ...localSettings,
            cashierReceiptRoles: settings.cashierReceiptRoles,
            kitchenReceiptRoles: settings.kitchenReceiptRoles,
          }
    );
    setSavedSettingsSuccess(true);
    notify.success(
      "Aturan cetak disimpan",
      "Preferensi cetak dan distribusi role struk diperbarui."
    );
    setTimeout(() => setSavedSettingsSuccess(false), 3000);
  };

  const handleTestPrint = async (device: PrinterDeviceConfig) => {
    try {
      setTestingDeviceId(device.id);
      setTestResult(null);
      const res = await testPrintDevice(device.id);
      setTestResult({
        id: device.id,
        success: res.success,
        message: res.message,
      });
    } catch (err: unknown) {
      setTestResult({
        id: device.id,
        success: false,
        message: err instanceof Error ? err.message : "Gagal menguji cetak.",
      });
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      setRetryingJobId(jobId);
      setRetryResult(null);
      const res = await retryPrintJob(jobId);
      setRetryResult({
        id: jobId,
        success: res.success,
        message: res.message,
      });
    } catch (err: unknown) {
      setRetryResult({
        id: jobId,
        success: false,
        message: err instanceof Error ? err.message : "Coba lagi gagal.",
      });
    } finally {
      setRetryingJobId(null);
    }
  };

  const activeKitchenDevice = devices.find(
    (d) => d.isActive && (d.role === "KITCHEN_ORDER" || d.role === "ALL") && d.isDefaultKitchen,
  );
  const activeCustomerDevice = devices.find(
    (d) => d.isActive && (d.role === "CUSTOMER_RECEIPT" || d.role === "ALL") && d.isDefaultCustomer,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Ringkasan Diagnostik */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Printer className="size-5" />
            </div>
            <div>
              <CardTitle>Printer dan nota POS</CardTitle>
              <CardDescription>
                Kelola printer kasir, printer dapur, ukuran kertas, dan antrean cetak.
              </CardDescription>
            </div>
          </div>

          <div>
            {isManagerOrAdmin ? (
              <Button type="button" size="lg" onClick={openAddModal}>
                <Plus />
                <span>Tambah printer</span>
              </Button>
            ) : (
              <Badge variant="outline">Mode baca (akses manajer / admin)</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border bg-muted/30 p-3">
            <span className="text-muted-foreground">Printer dapur aktif</span>
            <p className="font-medium text-foreground mt-0.5">{activeKitchenDevice?.name || "Belum ada"}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <span className="text-muted-foreground">Printer kasir aktif</span>
            <p className="font-medium text-foreground mt-0.5">{activeCustomerDevice?.name || "Belum ada"}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <span className="text-muted-foreground">Antrean cetak</span>
            <p className="font-medium text-foreground mt-0.5">
              {queue.length > 0 ? `${queue.length} pekerjaan` : "Antrean bersih"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Daftar Perangkat Printer */}
      <Card>
        <CardHeader>
          <CardTitle>Perangkat printer terdaftar</CardTitle>
          <CardDescription>
            Perangkat printer thermal yang siap menerima cetakan dari kasir POS.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {testResult ? (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? <CheckCircle2 /> : <AlertTriangle />}
              <AlertDescription className="flex items-center justify-between">
                <span>{testResult.message}</span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setTestResult(null)}
                  aria-label="Tutup notifikasi"
                >
                  <X />
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {devices.length === 0 ? (
            <EmptyState
              className="border"
              icon={<Printer />}
              title="Belum ada printer"
              description="Tambahkan printer kasir atau dapur untuk mulai mencetak nota."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama printer</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead className="hidden md:table-cell">Outlet</TableHead>
                    <TableHead className="hidden sm:table-cell">Koneksi & kertas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground">{d.name}</span>
                            {d.isDefaultKitchen ? (
                              <Badge variant="secondary">Dapur</Badge>
                            ) : null}
                            {d.isDefaultCustomer ? (
                              <Badge variant="secondary">Kasir</Badge>
                            ) : null}
                          </div>
                          {d.notes ? <p className="text-xs text-muted-foreground">{d.notes}</p> : null}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-foreground font-medium">
                        {printerRoleLabel(d.role)}
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {d.outletId === "ALL" ? "Semua outlet" : d.outletName || d.outletId}
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {printerConnectionLabel(d.connectionType)} · {d.paperWidth}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={d.isActive ? "success" : "neutral"}>
                          {d.isActive ? "Aktif" : "Nonaktif"}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={testingDeviceId === d.id}
                            onClick={() => handleTestPrint(d)}
                          >
                            <span>{testingDeviceId === d.id ? "Menguji..." : "Uji"}</span>
                          </Button>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => openEditModal(d)}
                            aria-label={`Edit ${d.name}`}
                          >
                            <Edit2 />
                          </Button>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setDeletingDeviceId(d.id)}
                            aria-label={`Hapus ${d.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Aturan Operasional Pencetakan */}
      <Card>
        <CardHeader>
          <CardTitle>Aturan operasional cetak</CardTitle>
          <CardDescription>
            Pilih dokumen mana yang dicetak otomatis saat transaksi kasir diselesaikan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-4 text-xs">
            {savedSettingsSuccess ? (
              <Alert>
                <CheckCircle2 />
                <AlertDescription>Aturan operasional cetak dan distribusi role disimpan.</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-foreground">Cetak nota dapur otomatis</p>
                  <p className="text-muted-foreground">Mencetak tiket pesanan dapur saat transaksi dibayar.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoPrintKitchenOrder}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, autoPrintKitchenOrder: e.target.checked }))
                  }
                  className="mt-1 rounded border"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-foreground">Cetak senyap dapur tanpa dialog</p>
                  <p className="text-muted-foreground">Mencetak nota dapur via print agent (QZ/PrintNode) atau Chrome kiosk tanpa membuka dialog.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.silentKitchenPrint}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, silentKitchenPrint: e.target.checked }))
                  }
                  className="mt-1 rounded border"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-foreground">Pisahkan nota dapur per mitra</p>
                  <p className="text-muted-foreground">Memecah tiket dapur multi-tenant agar tiap tenant hanya menerima item miliknya tanpa harga.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.splitKitchenTicketPerTenant}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, splitKitchenTicketPerTenant: e.target.checked }))
                  }
                  className="mt-1 rounded border"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-foreground">Cetak struk kasir otomatis</p>
                  <p className="text-muted-foreground">Mencetak struk pembayaran untuk pelanggan.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoPrintCustomerReceipt}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, autoPrintCustomerReceipt: e.target.checked }))
                  }
                  className="mt-1 rounded border"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-foreground">Sertakan catatan khusus di dapur</p>
                  <p className="text-muted-foreground">Mencetak instruksi khusus pesanan tamu.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.includeNotesOnKitchenTicket}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, includeNotesOnKitchenTicket: e.target.checked }))
                  }
                  className="mt-1 rounded border"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-foreground">Watermark cetak ulang</p>
                  <p className="text-muted-foreground">Menampilkan tanda REPRINT pada cetakan kedua.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.reprintWatermarkEnabled}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, reprintWatermarkEnabled: e.target.checked }))
                  }
                  className="mt-1 rounded border"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Header nota dapur</Label>
                <Input
                  type="text"
                  value={localSettings.kitchenHeaderNote || ""}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, kitchenHeaderNote: e.target.value }))
                  }
                  placeholder="Contoh: DAGO CREATIVE HUB — TIKET PESANAN"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Footer nota dapur</Label>
                <Input
                  type="text"
                  value={localSettings.kitchenFooterNote || ""}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, kitchenFooterNote: e.target.value }))
                  }
                  placeholder="Contoh: Harap segera disiapkan sesuai antrean"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium text-foreground">
                  Distribusi role struk kasir dan nota dapur
                </h3>
                <p className="text-xs text-muted-foreground">
                  Atur peran staf yang berhak melihat atau mencetak struk kasir dan nota dapur. Super Admin selalu memiliki akses penuh.
                </p>
                {!canManageReceiptRoles ? (
                  <p className="text-xs text-muted-foreground">
                    Hanya Owner organisasi atau Super Admin yang dapat mengubah distribusi role struk.
                  </p>
                ) : null}
              </div>

              <div className="divide-y rounded-md border bg-card">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Peran</span>
                  <span className="w-20 text-center">Struk kasir</span>
                  <span className="w-20 text-center">Nota dapur</span>
                </div>
                {CONFIGURABLE_RECEIPT_ROLES.map((item) => {
                  const hasCashier = cashierReceiptRoles.includes(item.role);
                  const hasKitchen = kitchenReceiptRoles.includes(item.role);
                  return (
                    <div
                      key={item.role}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="flex w-20 justify-center">
                        <Checkbox
                          checked={hasCashier}
                          disabled={!canManageReceiptRoles}
                          aria-label={`Struk kasir ${item.label}`}
                          onCheckedChange={(checked) =>
                            toggleReceiptRole("cashierReceiptRoles", item.role, checked === true)
                          }
                        />
                      </div>
                      <div className="flex w-20 justify-center">
                        <Checkbox
                          checked={hasKitchen}
                          disabled={!canManageReceiptRoles}
                          aria-label={`Nota dapur ${item.label}`}
                          onCheckedChange={(checked) =>
                            toggleReceiptRole("kitchenReceiptRoles", item.role, checked === true)
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm">
                Simpan aturan cetak
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 4. Pemantau Antrean Cetak */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span>Antrean dan riwayat cetak</span>
            </CardTitle>
            <CardDescription>Pekerjaan cetak yang dikirim ke printer pada sesi ini.</CardDescription>
          </div>
          {queue.length > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={clearQueueHistory}>
              Bersihkan riwayat
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {retryResult ? (
            <Alert variant={retryResult.success ? "default" : "destructive"}>
              <AlertDescription className="flex items-center justify-between">
                <span>{retryResult.message}</span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setRetryResult(null)}
                  aria-label="Tutup notifikasi"
                >
                  <X />
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {queue.length === 0 ? (
            <EmptyState
              className="border"
              icon={<Clock />}
              title="Antrean cetak kosong"
              description="Pekerjaan cetak dari POS akan tercatat secara otomatis di sini."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>No. pesanan</TableHead>
                    <TableHead>Tipe nota</TableHead>
                    <TableHead className="hidden md:table-cell">Printer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                        {new Date(job.createdAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {job.orderNumber || "—"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {job.receiptType === "KITCHEN_ORDER" ? "Nota dapur" : "Struk kasir"}
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {job.printerName}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={printJobStatusTone(job.status)}>
                          {printJobStatusLabel(job.status)}
                        </StatusBadge>
                      </TableCell>

                      <TableCell className="text-right">
                        {job.status === "FAILED" || job.status === "OFFLINE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={retryingJobId === job.id}
                            onClick={() => handleRetryJob(job.id)}
                          >
                            <RotateCcw />
                            <span>{retryingJobId === job.id ? "Mengirim..." : "Coba lagi"}</span>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Catatan Integrasi */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            <CardTitle>Panduan koneksi printer</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            Mode <strong>Dialog cetak browser</strong> menggunakan dialog cetak bawaan sistem operasi.
          </p>
          <p>
            Untuk pencetakan langsung tanpa dialog popup (direct raw thermal printing ESC/POS), gunakan perangkat perantara <strong>Local Bridge</strong> pada port lokal POS workstation.
          </p>
        </CardContent>
      </Card>

      {/* Dialog Tambah/Edit Printer */}
      <Dialog open={isDeviceModalOpen} onOpenChange={setIsDeviceModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDeviceId ? "Edit perangkat printer" : "Tambah perangkat printer"}</DialogTitle>
            <DialogDescription>Konfigurasikan peran dan alamat printer kasir atau dapur.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveDevice} className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label>Nama printer</Label>
              <Input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Epson TM-T82X Dapur"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Peran / Tujuan</Label>
                <NativeSelect
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as PrinterRole)}
                >
                  <NativeSelectOption value="KITCHEN_ORDER">Nota dapur</NativeSelectOption>
                  <NativeSelectOption value="CUSTOMER_RECEIPT">Struk kasir</NativeSelectOption>
                  <NativeSelectOption value="BAR_STATION">Bar / minuman</NativeSelectOption>
                  <NativeSelectOption value="ALL">Kasir + dapur</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Lebar kertas</Label>
                <NativeSelect
                  value={formPaperWidth}
                  onChange={(e) => setFormPaperWidth(e.target.value as PrinterPaperWidth)}
                >
                  <NativeSelectOption value="80mm">80 mm (Standar)</NativeSelectOption>
                  <NativeSelectOption value="58mm">58 mm (Kecil)</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Jalur koneksi</Label>
              <NativeSelect
                value={formConnectionType}
                onChange={(e) => setFormConnectionType(e.target.value as PrinterConnectionType)}
              >
                <NativeSelectOption value="BROWSER_SYSTEM">Dialog cetak browser / Kiosk</NativeSelectOption>
                <NativeSelectOption value="LOCAL_BRIDGE">Bridge lokal (HTTP daemon)</NativeSelectOption>
                <NativeSelectOption value="NETWORK_LAN_VIA_BRIDGE">LAN via bridge</NativeSelectOption>
                <NativeSelectOption value="QZ_TRAY">QZ Tray agent (Senyap)</NativeSelectOption>
                <NativeSelectOption value="PRINTNODE">PrintNode cloud agent</NativeSelectOption>
              </NativeSelect>
            </div>

            {formConnectionType !== "BROWSER_SYSTEM" ? (
              <div className="flex flex-col gap-1.5">
                <Label>Endpoint bridge</Label>
                <Input
                  type="text"
                  value={formBridgeEndpoint}
                  onChange={(e) => setFormBridgeEndpoint(e.target.value)}
                  placeholder="http://localhost:8080/print"
                  className="font-mono"
                />
              </div>
            ) : null}

            {formConnectionType === "NETWORK_LAN_VIA_BRIDGE" ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label>IP printer LAN</Label>
                  <Input
                    type="text"
                    value={formLanIp}
                    onChange={(e) => setFormLanIp(e.target.value)}
                    placeholder="192.168.1.200"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={formLanPort}
                    onChange={(e) => setFormLanPort(Number(e.target.value))}
                    className="font-mono"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 pt-1 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border"
                />
                <span>Printer aktif</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefaultKitchen}
                  onChange={(e) => setFormIsDefaultKitchen(e.target.checked)}
                  className="rounded border"
                />
                <span>Jadikan default cetak dapur</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefaultCustomer}
                  onChange={(e) => setFormIsDefaultCustomer(e.target.checked)}
                  className="rounded border"
                />
                <span>Jadikan default cetak kasir</span>
              </label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setIsDeviceModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="lg">Simpan printer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingDeviceId)}
        onOpenChange={(open) => !open && setDeletingDeviceId(null)}
        title="Hapus printer?"
        description="Printer ini tidak akan lagi menerima pekerjaan cetak dari kasir."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => {
          if (deletingDeviceId) {
            deleteDevice(deletingDeviceId);
            setDeletingDeviceId(null);
          }
        }}
      />
    </div>
  );
}
