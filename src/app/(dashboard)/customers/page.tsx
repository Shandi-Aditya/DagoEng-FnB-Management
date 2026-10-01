"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { LoyaltyMember, LoyaltyTier } from "@/types/loyalty";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Users,
  Award,
  Search,
  Plus,
  X,
  Star,
  Phone,
  CheckCircle2,
  History,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { CustomersReportPDFModal } from "@/features/customers/CustomersReportPDFModal";

export default function CustomersPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const { filteredMembers, createMember, addPoints, manualOverrideTier } = useLoyalty();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [selectedMemberForHistory, setSelectedMemberForHistory] = useState<LoyaltyMember | null>(null);
  const [selectedMemberForOverride, setSelectedMemberForOverride] = useState<LoyaltyMember | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const getCustomerExportData = () => {
    const headers = [
      "ID Pelanggan",
      "Nama Pelanggan",
      "No. Telepon / WA",
      "Email",
      "No. Identitas (KTP/Passport)",
      "Tier Loyalty",
      "Poin Aktif",
      "Total Belanja (Rp)",
      "Jumlah Kunjungan",
      "Status Akun",
      "Terdaftar Sejak",
    ];
    const rows = filteredMembers.map((c) => [
      c.id,
      c.name,
      c.phone,
      c.email || "-",
      c.identityNo || "-",
      c.tier,
      c.points,
      `Rp ${(c.totalSpend || 0).toLocaleString("id-ID")}`,
      c.totalVisits || 0,
      c.status || "ACTIVE",
      c.joinedDate || "-",
    ]);
    return { headers, rows };
  };

  const handleExportCSV = () => {
    const { headers, rows } = getCustomerExportData();
    downloadCSV(`Data_Pelanggan_CRM_${activeOutlet?.name || "All"}_${Date.now()}`, headers, rows);
    showToast("Data member & pelanggan berhasil di-export ke CSV!");
  };

  const handleExportExcel = () => {
    const { headers, rows } = getCustomerExportData();
    downloadExcel(
      `Data_Pelanggan_CRM_${activeOutlet?.name || "All"}_${Date.now()}`,
      "Database Pelanggan CRM",
      headers,
      rows
    );
    showToast("Data member & pelanggan berhasil di-export ke Excel (.xls)!");
  };

  // Form State (Only Identity Required, Tier auto-calculated!)
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newIdentity, setNewIdentity] = useState("");
  const [initialPoints, setInitialPoints] = useState(0);

  // Override Form State
  const [overrideTier, setOverrideTier] = useState<LoyaltyTier>("Gold");
  const [overrideReason, setOverrideReason] = useState("");

  const isOwnerOrAdmin = user?.role.slug === "OWNER" || user?.role.slug === "SUPER_ADMIN" || user?.role.slug === "MANAGER";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const displayedMembers = filteredMembers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.tier.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const newMem = createMember({
      name: newName,
      phone: newPhone,
      email: newEmail || undefined,
      identityNo: newIdentity || undefined,
      initialPoints: Number(initialPoints) || 0,
    });

    setIsAddModalOpen(false);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewIdentity("");
    setInitialPoints(0);
    showToast(`Member "${newMem.name}" berhasil didaftarkan dengan tier otomatis ${newMem.tier}!`);
  };

  const handleAddPointsQuick = (id: string, name: string) => {
    addPoints(id, 20, `Penambahan 20 Poin Manual untuk ${name}`);
    showToast(`+20 Poin berhasil ditambahkan untuk ${name}!`);
  };

  const handleManualOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForOverride || !overrideReason.trim()) return;

    manualOverrideTier(selectedMemberForOverride.id, overrideTier, overrideReason);
    setSelectedMemberForOverride(null);
    setOverrideReason("");
    showToast(`Tier ${selectedMemberForOverride.name} berhasil diubah menjadi ${overrideTier}!`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand-cyan" />
            <span>Pelanggan, CRM & Loyalty Tier — {activeOutlet?.name || "Singaraja"}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Database {filteredMembers.length} Pelanggan • Tier ditentukan otomatis berbasis poin (Bronze 0–499, Silver 500–1.499, Gold 1.500–2.999, Platinum 3.000+)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="text-xs space-x-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs space-x-1.5 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsPDFModalOpen(true)}
            className="text-xs space-x-1.5 bg-brand-orange hover:bg-orange-600 text-white font-bold shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-white" />
            <span>Cetak PDF CRM</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-bold space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pelanggan</span>
          </Button>
        </div>
      </div>

      {/* System Explanation Banner */}
      <div className="p-4 bg-gradient-to-r from-cyan-50 via-blue-50 to-orange-50 border border-cyan-200 rounded-2xl text-xs space-y-2">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-brand-cyan/20 text-cyan-800 flex items-center justify-center font-bold">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-900 text-sm">
            Cara Kerja Sistem CRM Pelanggan & Deteksi Otomatis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-600 pt-1">
          <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 space-y-1">
            <p className="font-bold text-slate-800 flex items-center space-x-1.5">
              <span>📱 1. Pendaftaran Otomatis</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Saat pelanggan login di QR Self-Order atau kasir memasukkan No. WhatsApp di POS, akun member langsung otomatis terbuat tanpa perlu registrasi manual.
            </p>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 space-y-1">
            <p className="font-bold text-slate-800 flex items-center space-x-1.5">
              <span>⭐ 2. Akumulasi Poin & Tier Real-Time</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Setiap transaksi selesai otomatis menambah 1 Poin / Rp 1.000 belanja. Tier (Bronze ➔ Platinum) naik otomatis & voucher langsung memotong poin saat checkout.
            </p>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 space-y-1">
            <p className="font-bold text-slate-800 flex items-center space-x-1.5">
              <span>🛡️ 3. Aksi Khusus Manager (Opsional)</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tombol aksi di tabel khusus untuk skenario luar biasa: memberi poin kompensasi komplain, penyesuaian VIP offline, atau audit riwayat loyalty.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase">Total Member Terdaftar</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{filteredMembers.length} Tamu</p>
        </Card>
        <Card className="p-4 bg-white shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase">Platinum / Gold Member</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">
            {filteredMembers.filter((c) => c.tier === "Platinum" || c.tier === "Gold").length} Member
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase">Silver Member</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">
            {filteredMembers.filter((c) => c.tier === "Silver").length} Member
          </p>
        </Card>
        <Card className="p-4 bg-white shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase">Bronze Member</p>
          <p className="text-2xl font-bold text-brand-orange mt-1">
            {filteredMembers.filter((c) => c.tier === "Bronze").length} Member
          </p>
        </Card>
      </div>

      {/* Search Input */}
      <div className="flex items-center space-x-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <Search className="w-4 h-4 text-slate-400 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari pelanggan berdasarkan nama, nomor telepon, email, atau tier..."
          className="w-full text-xs bg-transparent border-none focus:outline-none"
        />
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="p-3">Nama Pelanggan & Kontak</th>
                  <th className="p-3">Loyalty Tier (Otomatis)</th>
                  <th className="p-3 text-right">Saldo Poin</th>
                  <th className="p-3">Total Belanja & Kunjungan</th>
                  <th className="p-3">Tgl Bergabung</th>
                  <th className="p-3 text-center">Riwayat & Log</th>
                  <th className="p-3 text-right">Aksi Khusus Manager</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedMembers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">
                      <p>{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{c.phone}</p>
                      {c.email && <p className="text-[10px] text-slate-400">{c.email}</p>}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center space-x-1 ${
                          c.tier === "Platinum"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : c.tier === "Gold"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : c.tier === "Silver"
                            ? "bg-slate-200 text-slate-800 border border-slate-300"
                            : "bg-orange-100 text-orange-800 border border-orange-200"
                        }`}
                      >
                        <Crown className="w-3 h-3 mr-0.5" />
                        <span>{c.tier}</span>
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-sm text-brand-orange">
                      {c.points} Pts
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-900">{formatCurrencyIDR(c.totalSpend)}</p>
                      <p className="text-[10px] text-slate-400">{c.totalVisits} Kunjungan</p>
                    </td>
                    <td className="p-3 text-slate-500 font-medium">{c.joinedDate}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedMemberForHistory(c)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold inline-flex items-center space-x-1"
                        title="Lihat Riwayat Poin & Perubahan Tier"
                      >
                        <History className="w-3.5 h-3.5 text-slate-600" />
                        <span>Riwayat ({c.pointHistory.length + c.tierHistory.length})</span>
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddPointsQuick(c.id, c.name)}
                          className="text-[10px] h-7 px-2 font-bold text-brand-orange border-brand-orange/30 hover:bg-orange-50"
                        >
                          + 20 Pts
                        </Button>
                        {isOwnerOrAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedMemberForOverride(c);
                              setOverrideTier(c.tier);
                            }}
                            className="text-[10px] h-7 px-2 font-bold text-purple-700 border-purple-200 hover:bg-purple-50"
                            title="Manual Override Tier dengan Permission Owner/Admin"
                          >
                            Override Tier
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

      {/* MODAL 1: TAMBAH MEMBER (IDENTITAS SAJA, TIER OTOMATIS) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-brand-orange" />
                <h3 className="font-bold text-sm text-slate-900">Registrasi Member Baru</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                <p className="font-bold">Perhitungan Tier Otomatis:</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Tier member tidak diinput manual. Sistem akan secara otomatis menentukan tier berdasarkan jumlah poin (Default awal: 0 Poin ➔ Tier Bronze).
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gusti Ngurah Bagus"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nomor WhatsApp / Telepon *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: +62 812-3456-7890"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Email (Opsional)</label>
                  <input
                    type="email"
                    placeholder="nama@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nomor KTP / ID (Opsional)</label>
                  <input
                    type="text"
                    placeholder="510801xxxxxx"
                    value={newIdentity}
                    onChange={(e) => setNewIdentity(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Poin Awal Pendaftaran</label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={initialPoints}
                  onChange={(e) => setInitialPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl font-mono font-bold text-brand-orange"
                />
                <span className="text-[10px] text-slate-400">
                  {initialPoints >= 3000
                    ? "➔ Otomatis masuk Tier Platinum (>= 3.000 Pts)"
                    : initialPoints >= 1500
                    ? "➔ Otomatis masuk Tier Gold (>= 1.500 Pts)"
                    : initialPoints >= 500
                    ? "➔ Otomatis masuk Tier Silver (>= 500 Pts)"
                    : "➔ Otomatis masuk Tier Bronze (0 - 499 Pts)"}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-brand-orange text-white font-bold">
                  Simpan & Daftarkan Member
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RIWAYAT POIN & TIER */}
      {selectedMemberForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <History className="w-4 h-4 text-brand-orange" />
                  <span>Riwayat Poin & Tier — {selectedMemberForHistory.name}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tier Saat Ini: <strong className="text-brand-orange">{selectedMemberForHistory.tier}</strong> ({selectedMemberForHistory.points} Poin)
                </p>
              </div>
              <button
                onClick={() => setSelectedMemberForHistory(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Tier Changes */}
              <div className="space-y-2">
                <p className="font-bold text-slate-800 flex items-center space-x-1">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>Riwayat Perubahan Tier:</span>
                </p>
                {selectedMemberForHistory.tierHistory.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg">
                    Belum ada perubahan tier (Member berada pada tier awal).
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedMemberForHistory.tierHistory.map((th) => (
                      <div key={th.id} className="p-2 bg-amber-50/50 rounded-lg border border-amber-200 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900">
                            {th.previousTier} ➔ <span className="text-amber-800">{th.newTier}</span>
                          </p>
                          <p className="text-[10px] text-slate-500">{th.reason}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{th.timestamp.slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Point Ledger */}
              <div className="space-y-2">
                <p className="font-bold text-slate-800 flex items-center space-x-1">
                  <Star className="w-3.5 h-3.5 text-brand-orange" />
                  <span>Riwayat Transaksi Poin:</span>
                </p>
                {selectedMemberForHistory.pointHistory.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg">
                    Belum ada riwayat transaksi poin.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {selectedMemberForHistory.pointHistory.map((ptx) => (
                      <div key={ptx.id} className="pt-1.5 first:pt-0 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{ptx.reason}</p>
                          <p className="text-[10px] text-slate-400">{ptx.actorName}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold font-mono ${ptx.points >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {ptx.points >= 0 ? `+${ptx.points}` : ptx.points} Pts
                          </p>
                          <p className="text-[9px] text-slate-400">Saldo: {ptx.balanceAfter} Pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedMemberForHistory(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL TIER OVERRIDE (OWNER / ADMIN) */}
      {selectedMemberForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-purple-700">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900">Manual Override Tier Member</h3>
              </div>
              <button
                onClick={() => setSelectedMemberForOverride(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualOverride} className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900">
                <p className="font-bold">Audit Trail Enforcement:</p>
                <p className="text-[11px] text-purple-800 mt-0.5">
                  Setiap perubahan tier manual akan dicatat secara permanen di Global Activity Log beserta nama aktor dan alasan perubahan.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-slate-700">
                  Member: <strong className="text-slate-900">{selectedMemberForOverride.name}</strong> (Tier saat ini: {selectedMemberForOverride.tier})
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Pilih Tier Baru</label>
                <select
                  value={overrideTier}
                  onChange={(e) => setOverrideTier(e.target.value as LoyaltyTier)}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
                >
                  <option value="Bronze">Bronze (0 - 499 Pts)</option>
                  <option value="Silver">Silver (500 - 1.499 Pts)</option>
                  <option value="Gold">Gold (1.500 - 2.999 Pts)</option>
                  <option value="Platinum">Platinum (3.000+ Pts)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Alasan Manual Override (Wajib) *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Promosi VIP Dago Hub / Penyesuaian keanggotaan investor..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMemberForOverride(null)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                  Simpan & Catat ke Audit Log
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Official CRM Report Modal */}
      <CustomersReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        members={filteredMembers}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />
    </div>
  );
}
