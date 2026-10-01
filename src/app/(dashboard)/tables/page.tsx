"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useOutlet } from "@/contexts/OutletContext";
import { useTables, TableItem, AreaItem, ScheduledReservation } from "@/contexts/TableContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Grid,
  Plus,
  Users,
  Utensils,
  Clock,
  X,
  CheckCircle2,
  ArrowRight,
  CalendarCheck,
  Phone,
  Search,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";

export default function TablesPage() {
  const router = useRouter();
  const { activeOutlet, activeOutletId } = useOutlet();
  const {
    filteredAreas,
    filteredReservations,
    updateTableStatus,
    releaseTableToAvailable,
    seatReservation,
    cancelReservation,
    addReservation,
    addArea,
    addTable,
  } = useTables();

  const [activeTab, setActiveTab] = useState<"FLOOR_PLAN" | "RESERVATIONS">("FLOOR_PLAN");
  const [resFilter, setResFilter] = useState<string>("ALL");
  const [searchResQuery, setSearchResQuery] = useState("");

  // Modals
  const [selectedTableDetails, setSelectedTableDetails] = useState<{ areaId: string; table: TableItem } | null>(null);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
  const [isAddReservationModalOpen, setIsAddReservationModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Add Table Form States
  const [newTableName, setNewTableName] = useState("");
  const [newTableCap, setNewTableCap] = useState(4);
  const [newTableAreaId, setNewTableAreaId] = useState(filteredAreas[0]?.id || "");
  const [newAreaName, setNewAreaName] = useState("");

  // Add Reservation Form States
  const [resCustomerName, setResCustomerName] = useState("");
  const [resPhone, setResPhone] = useState("");
  const [resTableId, setResTableId] = useState(filteredAreas[0]?.tables[0]?.id || "T-01");
  const [resDate, setResDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [resTime, setResTime] = useState("19:00");
  const [resPax, setResPax] = useState(4);
  const [resDP, setResDP] = useState(100000);
  const [resNotes, setResNotes] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleTableClick = (areaId: string, table: TableItem) => {
    setSelectedTableDetails({ areaId, table });
  };

  const handleUpdateTableStatus = (newStatus: TableItem["status"]) => {
    if (!selectedTableDetails) return;
    const { table } = selectedTableDetails;
    if (newStatus === "AVAILABLE") {
      releaseTableToAvailable(table.id);
    } else {
      updateTableStatus(table.id, newStatus);
    }
    setSelectedTableDetails((prev) => (prev ? { ...prev, table: { ...prev.table, status: newStatus } } : null));
    showToast(`Status Meja ${table.number || table.id} diubah menjadi ${newStatus}`);
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || !newTableAreaId) return;
    addTable(newTableAreaId, newTableName, newTableCap);
    setIsAddTableModalOpen(false);
    setNewTableName("");
    showToast(`Meja ${newTableName} berhasil ditambahkan!`);
  };

  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    addArea(newAreaName, activeOutletId !== "ALL" ? activeOutletId : undefined);
    setIsAddAreaModalOpen(false);
    setNewAreaName("");
    showToast(`Area ${newAreaName} berhasil ditambahkan ke ${activeOutlet?.name || "Singaraja"}!`);
  };

  const handleAddReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resCustomerName.trim()) return;

    let assignedArea = filteredAreas[0]?.name || "Indoor AC Main Hall";
    for (const a of filteredAreas) {
      if (a.tables.some((t) => t.id === resTableId || t.number === resTableId)) {
        assignedArea = a.name;
        break;
      }
    }
    // Helper to format date label
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    let formattedDateLabel = "";
    if (resDate === todayStr) {
      formattedDateLabel = "Hari Ini";
    } else if (resDate === tomorrowStr) {
      formattedDateLabel = "Besok";
    } else {
      const d = new Date(resDate);
      formattedDateLabel = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    }

    const finalDateTime = `${formattedDateLabel}, ${resTime} WITA`;

    addReservation({
      customerName: resCustomerName.trim(),
      phone: resPhone.trim() || "+62 812-xxxx-xxxx",
      tableId: resTableId,
      areaName: assignedArea,
      outletId: activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr",
      outletName: activeOutlet?.name || "Singaraja",
      dateTime: finalDateTime,
      pax: Number(resPax),
      downPayment: Number(resDP),
      notes: resNotes.trim() || undefined,
      status: "CONFIRMED",
    });

    setIsAddReservationModalOpen(false);
    setResCustomerName("");
    setResPhone("");
    setResNotes("");
    showToast(`Reservasi atas nama ${resCustomerName} (Meja ${resTableId} - ${finalDateTime}) berhasil dibuat!`);
  };

  const handleSeatReservation = (res: ScheduledReservation) => {
    seatReservation(res.id);
    showToast(`Tamu ${res.customerName} telah didudukkan di Meja ${res.tableId}! Status meja kini OCCUPIED.`);
  };

  const handleCancelReservation = (resId: string, tableId: string) => {
    cancelReservation(resId);
    showToast(`Reservasi telah dibatalkan dan Meja ${tableId} kembali berstatus TERSEDIA.`);
  };

  const totalTables = filteredAreas.reduce((s, a) => s + a.tables.length, 0);
  const occupiedCount = filteredAreas.reduce((s, a) => s + a.tables.filter((t) => t.status === "OCCUPIED").length, 0);
  const reservedCount = filteredAreas.reduce((s, a) => s + a.tables.filter((t) => t.status === "RESERVED").length, 0);
  const availableCount = filteredAreas.reduce((s, a) => s + a.tables.filter((t) => t.status === "AVAILABLE").length, 0);

  const searchedReservations = filteredReservations.filter((r) => {
    const matchStatus = resFilter === "ALL" || r.status === resFilter;
    const matchSearch =
      r.customerName.toLowerCase().includes(searchResQuery.toLowerCase()) ||
      r.phone.includes(searchResQuery) ||
      r.tableId.toLowerCase().includes(searchResQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Grid className="w-5 h-5 text-brand-green" />
            <span>Manajemen Meja & Area — {activeOutlet?.name || "Singaraja"}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Total {totalTables} Meja ({availableCount} Tersedia • {occupiedCount} Terisi • {reservedCount} Reserved) • Scope: <strong>{activeOutlet?.name || "Singaraja"}</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {activeTab === "FLOOR_PLAN" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddAreaModalOpen(true)}
                className="text-xs font-semibold"
              >
                + Tambah Area
              </Button>
              <Button
                size="sm"
                onClick={() => setIsAddTableModalOpen(true)}
                className="text-xs font-bold space-x-1.5 bg-brand-orange hover:bg-orange-600 text-white shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Meja</span>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setIsAddReservationModalOpen(true)}
              className="text-xs font-bold space-x-1.5 bg-brand-orange hover:bg-orange-600 text-white shadow-sm"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Buat Reservasi Baru</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("FLOOR_PLAN")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all ${
            activeTab === "FLOOR_PLAN"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Grid className="w-4 h-4 text-brand-green" />
          <span>Denah Meja Visual (Floor Plan)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RESERVATIONS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all ${
            activeTab === "RESERVATIONS"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <CalendarCheck className="w-4 h-4 text-brand-orange" />
          <span>Buku Reservasi Terjadwal ({filteredReservations.filter((r) => r.status === "CONFIRMED").length})</span>
        </button>
      </div>

      {/* TAB 1: DENAH MEJA VISUAL (FLOOR PLAN) */}
      {activeTab === "FLOOR_PLAN" && (
        <div className="space-y-6 animate-in fade-in">
          {filteredAreas.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              Belum ada area meja untuk outlet {activeOutlet?.name || "terpilih"}.
            </div>
          ) : (
            filteredAreas.map((area) => (
              <Card key={area.id} className="shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                    <span>📍 {area.name}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {area.tables.filter((t) => t.status === "OCCUPIED").length} / {area.tables.length} Terisi
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {area.tables.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Belum ada meja di area ini.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {area.tables.map((t) => {
                        const isOccupied = t.status === "OCCUPIED";
                        const isReserved = t.status === "RESERVED";
                        const isCleaning = t.status === "CLEANING";

                        return (
                          <div
                            key={t.id}
                            onClick={() => handleTableClick(area.id, t)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between h-32 ${
                              isOccupied
                                ? "bg-orange-50/70 border-brand-orange text-slate-900 ring-1 ring-brand-orange"
                                : isReserved
                                ? "bg-amber-50/70 border-amber-400 text-slate-900"
                                : isCleaning
                                ? "bg-slate-100 border-slate-300 text-slate-600"
                                : "bg-white border-slate-200 hover:border-slate-400 text-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm">{t.number || t.id}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  isOccupied
                                    ? "bg-brand-orange text-white"
                                    : isReserved
                                    ? "bg-amber-500 text-white"
                                    : isCleaning
                                    ? "bg-slate-300 text-slate-700"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>

                            <div className="text-[11px] flex items-center space-x-1 text-slate-500">
                              <Users className="w-3 h-3" />
                              <span>Kapasitas: {t.cap} Org</span>
                            </div>

                            {isOccupied ? (
                              <div className="pt-1.5 border-t border-brand-orange/20 text-[10px] space-y-0.5">
                                <p className="font-bold text-slate-900 truncate">{t.customer || "Tamu Aktif"}</p>
                                <p className="text-brand-orange font-bold font-mono">{t.total || "-"}</p>
                              </div>
                            ) : isReserved ? (
                              <div className="pt-1.5 border-t border-amber-300 text-[10px] space-y-0.5">
                                <p className="font-bold text-slate-900 truncate">{t.customer}</p>
                                <p className="text-amber-800 font-medium font-mono">{t.time}</p>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                                Klik untuk aksi meja
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 2: BUKU RESERVASI TERJADWAL */}
      {activeTab === "RESERVATIONS" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Filter & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchResQuery}
                onChange={(e) => setSearchResQuery(e.target.value)}
                placeholder="Cari reservasi nama tamu, nomor WhatsApp, atau meja..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
              />
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              {[
                { key: "ALL", label: "Semua Reservasi" },
                { key: "CONFIRMED", label: "Menunggu Kedatangan 🟡" },
                { key: "SEATED", label: "Sudah Duduk (Seated) 🟢" },
                { key: "CANCELLED", label: "Dibatalkan ⚪" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setResFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    resFilter === tab.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reservation Table */}
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                    <tr>
                      <th className="p-3">Nama Tamu & Kontak</th>
                      <th className="p-3">Meja & Area</th>
                      <th className="p-3">Jadwal Kedatangan</th>
                      <th className="p-3">Pax & DP Masuk</th>
                      <th className="p-3">Catatan Khusus</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi Reservasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {searchedReservations.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">
                          <p>{res.customerName}</p>
                          <p className="text-[10px] text-slate-400 font-mono flex items-center space-x-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{res.phone}</span>
                          </p>
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-brand-orange bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                            Meja {res.tableId}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {res.areaName}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          {res.dateTime}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold">{res.pax} Orang</p>
                          <p className="text-[10px] text-emerald-700 font-mono font-bold">
                            DP: {formatCurrencyIDR(res.downPayment)}
                          </p>
                        </td>
                        <td className="p-3 text-slate-600 max-w-[180px] truncate">
                          {res.notes || "-"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.status === "CONFIRMED"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : res.status === "SEATED"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {res.status === "CONFIRMED"
                              ? "MENUNGGU KEDATANGAN"
                              : res.status === "SEATED"
                              ? "SUDAH DUDUK (SEATED)"
                              : "DIBATALKAN"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {res.status === "CONFIRMED" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleSeatReservation(res)}
                                  className="text-[10px] h-7 px-2.5 font-bold bg-brand-orange hover:bg-orange-600 text-white space-x-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Dudukkan (Seat)</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelReservation(res.id, res.tableId)}
                                  className="text-[10px] h-7 px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                  Batal
                                </Button>
                              </>
                            )}
                            {res.status === "SEATED" && (
                              <Button
                                size="sm"
                                onClick={() => router.push("/pos")}
                                className="text-[10px] h-7 px-2 font-bold bg-slate-900 text-white space-x-1"
                              >
                                <Utensils className="w-3 h-3 text-brand-orange" />
                                <span>Buka POS</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 1: DETAIL & AKSI MEJA */}
      {selectedTableDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base text-slate-900">
                  Meja {selectedTableDetails.table.number || selectedTableDetails.table.id}
                </span>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                  Kapasitas {selectedTableDetails.table.cap} Orang
                </span>
              </div>
              <button
                onClick={() => setSelectedTableDetails(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Active Occupancy Details */}
              {selectedTableDetails.table.status === "OCCUPIED" && (
                <div className="p-3 bg-orange-50 rounded-xl border border-brand-orange/30 space-y-1.5">
                  <span className="text-[10px] font-bold text-brand-orange uppercase">
                    Informasi Tagihan Aktif:
                  </span>
                  <div className="flex justify-between font-bold text-sm text-slate-900">
                    <span>{selectedTableDetails.table.customer || "Tamu Aktif"}</span>
                    <span className="text-brand-orange font-mono">
                      {selectedTableDetails.table.total || "-"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Durasi: {selectedTableDetails.table.time || "Baru saja"} • {selectedTableDetails.table.itemsCount || 2} Menu
                  </p>
                </div>
              )}

              {/* Status Switcher Buttons */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700">Ubah Status Meja Langsung:</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedTableDetails.table.status === "AVAILABLE" ? "default" : "outline"}
                    onClick={() => handleUpdateTableStatus("AVAILABLE")}
                    className={selectedTableDetails.table.status === "AVAILABLE" ? "bg-emerald-600 text-white" : ""}
                  >
                    🟢 Kosongkan (Tersedia)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedTableDetails.table.status === "OCCUPIED" ? "default" : "outline"}
                    onClick={() => handleUpdateTableStatus("OCCUPIED")}
                    className={selectedTableDetails.table.status === "OCCUPIED" ? "bg-brand-orange text-white" : ""}
                  >
                    🟠 Terisi (Occupied)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedTableDetails.table.status === "RESERVED" ? "default" : "outline"}
                    onClick={() => handleUpdateTableStatus("RESERVED")}
                    className={selectedTableDetails.table.status === "RESERVED" ? "bg-amber-600 text-white" : ""}
                  >
                    🟡 Reserved
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedTableDetails.table.status === "CLEANING" ? "default" : "outline"}
                    onClick={() => handleUpdateTableStatus("CLEANING")}
                    className={selectedTableDetails.table.status === "CLEANING" ? "bg-slate-700 text-white" : ""}
                  >
                    ⚪ Perlu Dibersihkan
                  </Button>
                </div>
              </div>

              {/* Action Button to Open POS */}
              <div className="pt-3 border-t border-slate-100 flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTableDetails(null)}
                >
                  Tutup
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => router.push("/pos")}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold space-x-1.5"
                >
                  <Utensils className="w-3.5 h-3.5 text-brand-orange" />
                  <span>Buka POS Kasir Meja Ini</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BUAT RESERVASI */}
      {isAddReservationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <CalendarCheck className="w-5 h-5 text-brand-orange" />
                <h3 className="font-bold text-sm text-slate-900">Buat Reservasi Meja Terjadwal</h3>
              </div>
              <button
                onClick={() => setIsAddReservationModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddReservation} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nama Lengkap Tamu</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ibu Maya Santika"
                    value={resCustomerName}
                    onChange={(e) => setResCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nomor WhatsApp</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: +62 812-3456-7890"
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Pilih Meja</label>
                  <select
                    value={resTableId}
                    onChange={(e) => setResTableId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
                  >
                    {filteredAreas.flatMap((a) =>
                      a.tables.map((t) => (
                        <option key={t.id} value={t.number || t.id}>
                          {t.number || t.id} ({a.name} - Cap {t.cap})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Jumlah Tamu (Pax)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={resPax}
                    onChange={(e) => setResPax(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Uang Muka / DP (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={resDP}
                    onChange={(e) => setResDP(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="font-bold text-slate-800 block text-xs">Jadwal Kedatangan Tamu</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Pilih Tanggal</label>
                    <input
                      type="date"
                      required
                      value={resDate}
                      onChange={(e) => setResDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Pilih Jam (WITA)</label>
                    <input
                      type="time"
                      required
                      value={resTime}
                      onChange={(e) => setResTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                    />
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                  <span className="text-slate-400 font-semibold">Shortcut:</span>
                  <button
                    type="button"
                    onClick={() => setResDate(new Date().toISOString().split("T")[0])}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setResDate(d.toISOString().split("T")[0]);
                    }}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                  >
                    Besok
                  </button>
                  <span className="text-slate-300">|</span>
                  {["12:00", "18:30", "19:00", "20:00"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setResTime(t)}
                      className={`px-1.5 py-0.5 rounded font-mono ${
                        resTime === t ? "bg-brand-orange text-white font-bold" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Catatan Khusus / Permintaan Khusus</label>
                <input
                  type="text"
                  placeholder="Contoh: Family dinner, siapkan baby high chair, meja sudut..."
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddReservationModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-brand-orange text-white font-bold">
                  Simpan Reservasi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH MEJA */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Tambah Meja Baru</h3>
              <button
                onClick={() => setIsAddTableModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Area Meja</label>
                <select
                  value={newTableAreaId}
                  onChange={(e) => setNewTableAreaId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  {filteredAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nomor Meja</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: T-06"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kapasitas (Orang)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newTableCap}
                    onChange={(e) => setNewTableCap(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddTableModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-brand-orange text-white font-bold">
                  Simpan Meja
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: TAMBAH AREA */}
      {isAddAreaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Tambah Area Baru ({activeOutlet?.name || "Singaraja"})</h3>
              <button
                onClick={() => setIsAddAreaModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddArea} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Area Baru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rooftop Sunset Lounge"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAreaModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-brand-orange text-white font-bold">
                  Simpan Area
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
