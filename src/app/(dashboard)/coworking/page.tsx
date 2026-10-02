"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Laptop,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  X,
  CreditCard,
  Building,
  Calendar,
  ShieldCheck,
  UserCheck,
  LogOut,
  Sparkles,
  History,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import { SpaceType } from "@/types/coworking";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { CoworkingReportPDFModal } from "@/features/coworking/CoworkingReportPDFModal";

export default function CoworkingPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const {
    spaces,
    bookings,
    members,
    checkLogs,
    virtualOffices,
    bookSpace,
    checkInBooking,
    checkoutSpace,
    addMember,
    approveVirtualOffice,
    rejectVirtualOffice,
    createVirtualOffice,
  } = useCoworking();

  const [activeTab, setActiveTab] = useState<"SPACES" | "BOOKINGS" | "MEMBERS" | "LOGS" | "VIRTUAL_OFFICE">("SPACES");
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");
  const [toastMessage, setToastMessage] = useState("");
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);

  // Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isNewVOModalOpen, setIsNewVOModalOpen] = useState(false);

  // New VO Form States
  const [voCompanyName, setVoCompanyName] = useState("");
  const [voApplicantName, setVoApplicantName] = useState("");
  const [voPhone, setVoPhone] = useState("");
  const [voEmail, setVoEmail] = useState("");
  const [voPlan, setVoPlan] = useState<"VO Starter (Alamat Bisnis)" | "VO Professional (Alamat + Kuota Meeting)" | "VO Enterprise (Lengkap + Domisili)">("VO Professional (Alamat + Kuota Meeting)");
  const [voBusinessType, setVoBusinessType] = useState("");
  const [voDocName, setVoDocName] = useState("Akta_Perusahaan_NIB.pdf");
  const [voFee, setVoFee] = useState(4200000);

  const getCoworkingExportData = () => {
    if (activeTab === "MEMBERS") {
      const headers = [
        "Member ID",
        "Nama Member",
        "No. WhatsApp / HP",
        "Email",
        "Paket Membership",
        "Tanggal Mulai",
        "Tanggal Berakhir",
        "Total Transaksi (Rp)",
        "Status",
      ];
      const rows = members.map((m) => [
        m.memberId,
        m.name,
        m.contact,
        m.email,
        m.packageName,
        m.startDate,
        m.expiryDate,
        `Rp ${(m.totalSpent || 0).toLocaleString("id-ID")}`,
        m.status,
      ]);
      return { filename: `Member_Coworking_${activeOutlet?.name || "All"}`, sheet: "Member Coworking", headers, rows };
    } else {
      const headers = [
        "ID Booking",
        "Nama Tamu",
        "No. WhatsApp",
        "Ruang / Meja",
        "Tipe Sewa",
        "Durasi",
        "Total Tagihan (Rp)",
        "Metode Pembayaran",
        "Status Sesi",
        "Waktu Check-In",
      ];
      const rows = bookings.map((b) => [
        b.bookingCode || b.id,
        b.guestName,
        b.guestPhone,
        b.spaceName,
        b.bookingType,
        `${b.duration} ${b.bookingType === "HOURLY" ? "Jam" : b.bookingType === "DAILY" ? "Hari" : "Bulan"}`,
        `Rp ${(b.totalAmount || 0).toLocaleString("id-ID")}`,
        b.paymentStatus || "PAID",
        b.checkInStatus,
        `${b.date} ${b.startTime}`,
      ]);
      return { filename: `Booking_Coworking_${activeOutlet?.name || "All"}`, sheet: "Booking & Okupansi", headers, rows };
    }
  };

  const handleExportCSV = () => {
    const { filename, headers, rows } = getCoworkingExportData();
    downloadCSV(`${filename}_${Date.now()}`, headers, rows);
    showToast(`Data Co-working (${activeTab === "MEMBERS" ? "Member" : "Booking"}) berhasil diexport ke CSV!`);
  };

  const handleExportExcel = () => {
    const { filename, sheet, headers, rows } = getCoworkingExportData();
    downloadExcel(`${filename}_${Date.now()}`, sheet, headers, rows);
    showToast(`Data Co-working (${activeTab === "MEMBERS" ? "Member" : "Booking"}) berhasil diexport ke Excel (.xls)!`);
  };

  // New Booking Form States
  const [bookGuestName, setBookGuestName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookEmail, setBookEmail] = useState("");
  const [bookCompany, setBookCompany] = useState("");
  const [bookSpaceId, setBookSpaceId] = useState(spaces[0]?.id || "");
  const [bookType, setBookType] = useState<"HOURLY" | "DAILY" | "MONTHLY">("DAILY");
  const [bookDuration, setBookDuration] = useState<number>(1);
  const [bookPaymentMethod, setBookPaymentMethod] = useState<string>("QRIS DagoPay");

  // New Member Form States
  const [newMemName, setNewMemName] = useState("");
  const [newMemPhone, setNewMemPhone] = useState("");
  const [newMemEmail, setNewMemEmail] = useState("");
  const [newMemPackage, setNewMemPackage] = useState("Dedicated Nomad Monthly");
  const [newMemAmount, setNewMemAmount] = useState(1850000);
  const [newMemPaymentMethod, setNewMemPaymentMethod] = useState("QRIS DagoPay");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const availableSpacesCount = spaces.filter((s) => s.status === "AVAILABLE").length;
  const occupiedSpacesCount = spaces.filter((s) => s.status === "OCCUPIED").length;

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookGuestName.trim() || !bookPhone.trim()) return;

    const selectedSpace = spaces.find((s) => s.id === bookSpaceId);
    if (!selectedSpace) return;

    const rate =
      bookType === "HOURLY"
        ? selectedSpace.hourlyRate
        : bookType === "DAILY"
        ? selectedSpace.dailyRate
        : selectedSpace.monthlyRate || selectedSpace.dailyRate * 20;

    const total = rate * bookDuration;
    const nowTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
    const dateFormatted = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

    bookSpace({
      guestName: bookGuestName.trim(),
      guestPhone: bookPhone.trim(),
      guestEmail: bookEmail.trim() || "guest@nomad.com",
      company: bookCompany.trim() || undefined,
      spaceId: selectedSpace.id,
      spaceName: selectedSpace.name,
      spaceType: selectedSpace.type,
      bookingType: bookType,
      date: dateFormatted,
      startTime: nowTime,
      duration: bookDuration,
      price: total,
      discount: 0,
      totalAmount: total,
      paidAmount: total,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: bookPaymentMethod,
      paymentRef: `PAY-CWK-${Date.now().toString().slice(-6)}`,
      paymentTimestamp: `${dateFormatted} ${nowTime}`,
    });

    setIsNewBookingModalOpen(false);
    setBookGuestName("");
    setBookPhone("");
    setBookEmail("");
    setBookCompany("");
    showToast(`Booking ${selectedSpace.name} atas nama ${bookGuestName} berhasil dan berstatus CHECKED_IN!`);
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemName.trim() || !newMemPhone.trim()) return;

    const today = new Date();
    const expiry = new Date();
    expiry.setDate(today.getDate() + 30);

    const startStr = today.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const expStr = expiry.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

    addMember(
      {
        name: newMemName.trim(),
        contact: newMemPhone.trim(),
        email: newMemEmail.trim() || "member@nomad.com",
        packageName: newMemPackage,
        startDate: startStr,
        expiryDate: expStr,
        status: "ACTIVE",
        totalSpent: newMemAmount,
      },
      {
        amount: newMemAmount,
        paymentMethod: newMemPaymentMethod,
      }
    );

    setIsNewMemberModalOpen(false);
    setNewMemName("");
    setNewMemPhone("");
    setNewMemEmail("");
    showToast(`Member Co-working "${newMemName}" berhasil didaftarkan!`);
  };

  const handleCheckout = (spaceId: string) => {
    checkoutSpace(spaceId);
    showToast("Check-out berhasil! Meja kembali TERSEDIA dan status booking diperbarui menjadi COMPLETED.");
  };

  const handleCreateVO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voCompanyName.trim() || !voApplicantName.trim() || !voPhone.trim()) return;

    const start = new Date();
    const end = new Date();
    end.setFullYear(start.getFullYear() + 1);

    const startStr = start.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const endStr = end.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

    createVirtualOffice({
      companyName: voCompanyName.trim(),
      applicantName: voApplicantName.trim(),
      applicantPhone: voPhone.trim(),
      applicantEmail: voEmail.trim() || "applicant@company.id",
      planName: voPlan,
      businessType: voBusinessType.trim() || "Perdagangan & Jasa",
      startDate: startStr,
      expiryDate: endStr,
      legalDocumentName: voDocName.trim() || "Akta_NIB_KTP.pdf",
      annualFee: voFee,
      paymentStatus: "PAID",
      notes: "Pendaftaran baru melalui Admin Dago Working Space.",
    });

    setIsNewVOModalOpen(false);
    setVoCompanyName("");
    setVoApplicantName("");
    setVoPhone("");
    setVoEmail("");
    setVoBusinessType("");
    showToast(`Pendaftaran Virtual Office "${voCompanyName}" berhasil diajukan & menunggu approval!`);
  };

  const handleApproveVO = (id: string, name: string) => {
    approveVirtualOffice(id);
    showToast(`Virtual Office "${name}" disetujui & Surat Keterangan Domisili telah diterbitkan!`);
  };

  const handleRejectVO = (id: string, name: string) => {
    rejectVirtualOffice(id, "Dokumen legalitas ditolak setelah verifikasi kelurahan/gedung.");
    showToast(`Virtual Office "${name}" telah ditolak.`);
  };

  const filteredMemberList = members.filter((m) => {
    const matchStatus = memberStatusFilter === "ALL" || m.status === memberStatusFilter;
    const matchQuery =
      m.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
      m.contact.includes(searchMemberQuery) ||
      m.memberId.toLowerCase().includes(searchMemberQuery.toLowerCase()) ||
      m.packageName.toLowerCase().includes(searchMemberQuery.toLowerCase());
    return matchStatus && matchQuery;
  });

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
            <Laptop className="w-5 h-5 text-blue-600" />
            <span>Co-working Space & Virtual Office — {activeOutlet?.name || "Singaraja"}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {spaces.length} Ruang/Meja ({availableSpacesCount} Tersedia • {occupiedSpacesCount} Digunakan) • {members.filter((m) => m.status === "ACTIVE").length} Member Aktif • {virtualOffices.length} Virtual Office Klien
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
            <span>Cetak PDF Resmi</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsNewVOModalOpen(true)}
            className="text-xs font-semibold border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <Building className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            + Virtual Office
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsNewMemberModalOpen(true)}
            className="text-xs font-semibold"
          >
            + Member
          </Button>
          <Button
            size="sm"
            onClick={() => setIsNewBookingModalOpen(true)}
            className="text-xs font-bold space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Booking</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("SPACES")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all shrink-0 ${
            activeTab === "SPACES"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Laptop className="w-4 h-4 text-blue-500" />
          <span>Denah Ruang & Meja ({spaces.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("BOOKINGS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all shrink-0 ${
            activeTab === "BOOKINGS"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4 text-brand-orange" />
          <span>Buku Booking & Pembayaran ({bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MEMBERS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all shrink-0 ${
            activeTab === "MEMBERS"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Member Co-working ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("VIRTUAL_OFFICE")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all shrink-0 ${
            activeTab === "VIRTUAL_OFFICE"
              ? "bg-indigo-700 text-white shadow-sm"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          <Building className="w-4 h-4 text-indigo-400" />
          <span>Virtual Office & Domisili ({virtualOffices.length})</span>
          {virtualOffices.filter((v) => v.status === "PENDING_APPROVAL").length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-900 text-[10px] font-black rounded-full">
              {virtualOffices.filter((v) => v.status === "PENDING_APPROVAL").length} New
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOGS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all shrink-0 ${
            activeTab === "LOGS"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <History className="w-4 h-4 text-purple-600" />
          <span>Check-in / Check-out Log ({checkLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: DENAH RUANG & MEJA */}
      {activeTab === "SPACES" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((sp) => {
              const isOccupied = sp.status === "OCCUPIED";

              return (
                <Card
                  key={sp.id}
                  className={`p-4 border transition-all ${
                    isOccupied
                      ? "bg-blue-50/50 border-blue-300 shadow-xs"
                      : "bg-white border-slate-200 shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        {sp.type} • {sp.area}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 mt-0.5">{sp.name}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                        isOccupied ? "bg-blue-600 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {sp.status}
                    </span>
                  </div>

                  <div className="py-2.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Tarif Sewa:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrencyIDR(sp.dailyRate)} / hari
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Kapasitas:</span>
                      <span>{sp.capacity} Orang</span>
                    </div>

                    {/* Active Occupancy Details */}
                    {isOccupied && sp.currentSession && (
                      <div className="mt-2 p-2.5 bg-white rounded-xl border border-blue-200 space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-900">
                          <span>👤 {sp.currentSession.guestName}</span>
                          <span className="text-blue-600 font-mono text-[11px]">{sp.currentSession.checkInTime}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Perusahaan: {sp.currentSession.company} • Kode: {sp.currentSession.bookingCode}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {sp.amenities.slice(0, 2).join(" • ")}
                    </span>
                    {isOccupied ? (
                      <Button
                        size="sm"
                        onClick={() => handleCheckout(sp.id)}
                        className="text-[10px] h-7 px-2.5 font-bold bg-slate-900 hover:bg-slate-800 text-white space-x-1"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Check-out</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBookSpaceId(sp.id);
                          setIsNewBookingModalOpen(true);
                        }}
                        className="text-[10px] h-7 px-2.5 font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        Book Ruang
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BUKU BOOKING & PEMBAYARAN */}
      {activeTab === "BOOKINGS" && (
        <Card className="shadow-sm animate-in fade-in">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                  <tr>
                    <th className="p-3">Kode Booking & Tamu</th>
                    <th className="p-3">Ruang / Meja</th>
                    <th className="p-3">Jadwal & Durasi</th>
                    <th className="p-3">Rincian Pembayaran</th>
                    <th className="p-3">Status Bayar</th>
                    <th className="p-3">Status Check-in</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">
                        <p className="font-mono text-blue-600 font-bold">{b.bookingCode}</p>
                        <p>{b.guestName} {b.company ? `(${b.company})` : ""}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{b.guestPhone}</p>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900">{b.spaceName}</span>
                        <span className="text-[10px] text-slate-400 block">{b.spaceType}</span>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold">{b.date}</p>
                        <p className="text-[10px] text-slate-500">Mulai: {b.startTime} ({b.duration} {b.bookingType === "HOURLY" ? "Jam" : "Hari"})</p>
                      </td>
                      <td className="p-3">
                        <p className="font-bold font-mono text-slate-900">{formatCurrencyIDR(b.totalAmount)}</p>
                        <p className="text-[10px] text-slate-500">{b.paymentMethod}</p>
                        {b.paymentRef && <p className="text-[9px] text-slate-400 font-mono">Ref: {b.paymentRef}</p>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {b.paymentStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.checkInStatus === "CHECKED_IN"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : b.checkInStatus === "COMPLETED"
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {b.checkInStatus === "CHECKED_IN" ? "SEDANG AKTIF" : b.checkInStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {b.checkInStatus === "CHECKED_IN" ? (
                          <Button
                            size="sm"
                            onClick={() => handleCheckout(b.spaceId)}
                            className="text-[10px] h-7 px-2 font-bold bg-slate-900 text-white"
                          >
                            Check-out
                          </Button>
                        ) : b.checkInStatus === "RESERVED" ? (
                          <Button
                            size="sm"
                            onClick={() => checkInBooking(b.id)}
                            className="text-[10px] h-7 px-2 font-bold bg-blue-600 text-white"
                          >
                            Check-in
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
          </CardContent>
        </Card>
      )}

      {/* TAB 3: DAFTAR MEMBER CO-WORKING */}
      {activeTab === "MEMBERS" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchMemberQuery}
                onChange={(e) => setSearchMemberQuery(e.target.value)}
                placeholder="Cari member berdasarkan ID, nama, kontak, atau paket..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              {(["ALL", "ACTIVE", "EXPIRED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setMemberStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    memberStatusFilter === st
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st === "ALL" ? "Semua Status" : st === "ACTIVE" ? "🟢 Member Aktif" : "🔴 Expired"}
                </button>
              ))}
            </div>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                    <tr>
                      <th className="p-3">Member ID & Nama</th>
                      <th className="p-3">Kontak & Email</th>
                      <th className="p-3">Paket Keanggotaan</th>
                      <th className="p-3">Masa Berlaku</th>
                      <th className="p-3">Status Member</th>
                      <th className="p-3 text-right">Total Transaksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredMemberList.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">
                          <p className="font-mono text-blue-600 font-bold">{m.memberId}</p>
                          <p>{m.name}</p>
                        </td>
                        <td className="p-3 text-slate-600">
                          <p className="font-mono">{m.contact}</p>
                          <p className="text-[10px] text-slate-400">{m.email}</p>
                        </td>
                        <td className="p-3 font-semibold text-slate-800">{m.packageName}</td>
                        <td className="p-3 text-slate-600">
                          <p>{m.startDate} — {m.expiryDate}</p>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              m.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {m.status === "ACTIVE" ? "AKTIF" : "EXPIRED"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyIDR(m.totalSpent)}
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

      {/* TAB 4: VIRTUAL OFFICE & LEGALITAS */}
      {activeTab === "VIRTUAL_OFFICE" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500">Total Klien VO</p>
                <p className="text-xl font-black text-indigo-900 mt-0.5">{virtualOffices.length}</p>
              </div>
              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                <Building className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-amber-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500">Menunggu Approval</p>
                <p className="text-xl font-black text-amber-600 mt-0.5">
                  {virtualOffices.filter((v) => v.status === "PENDING_APPROVAL").length}
                </p>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500">Domisili Terbit & Aktif</p>
                <p className="text-xl font-black text-emerald-700 mt-0.5">
                  {virtualOffices.filter((v) => v.status === "ACTIVE" || v.status === "APPROVED").length}
                </p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500">Total ARR Kontrak VO</p>
                <p className="text-base font-black text-blue-950 font-mono mt-0.5">
                  {formatCurrencyIDR(virtualOffices.reduce((sum, v) => sum + (v.annualFee || 0), 0))}
                </p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Virtual Office Applications & Legality Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>🏢 Daftar Klien Virtual Office & Verifikasi Dokumen Legalitas (Pilar A)</span>
                <Button
                  size="sm"
                  onClick={() => setIsNewVOModalOpen(true)}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Daftarkan Klien VO
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                    <tr>
                      <th className="p-3">No. Registrasi & Perusahaan</th>
                      <th className="p-3">PIC / Pemohon</th>
                      <th className="p-3">Paket VO & Bidang Usaha</th>
                      <th className="p-3">Dokumen Legalitas</th>
                      <th className="p-3">Masa Kontrak (1 Thn)</th>
                      <th className="p-3">Status Domisili</th>
                      <th className="p-3">Status Kontrak</th>
                      <th className="p-3 text-right">Aksi Admin Dago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {virtualOffices.map((vo) => (
                      <tr key={vo.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <p className="font-mono text-[10px] text-indigo-700 font-black">{vo.registrationNumber}</p>
                          <p className="font-bold text-slate-900 text-xs">{vo.companyName}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-900">{vo.applicantName}</p>
                          <p className="font-mono text-[10px] text-slate-500">{vo.applicantPhone}</p>
                          <p className="text-[10px] text-slate-400">{vo.applicantEmail}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-indigo-900">{vo.planName}</p>
                          <p className="text-[10px] text-slate-500 italic">{vo.businessType}</p>
                          <p className="font-mono text-[10px] font-bold text-slate-700 mt-0.5">
                            {formatCurrencyIDR(vo.annualFee)} / thn
                          </p>
                        </td>
                        <td className="p-3">
                          <div className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] text-slate-700 font-mono font-medium">
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span className="truncate max-w-[120px]">{vo.legalDocumentName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          <p>{vo.startDate}</p>
                          <p className="text-slate-400">s/d {vo.expiryDate}</p>
                        </td>
                        <td className="p-3">
                          {vo.domicileLetterIssued ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Terbit</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Menunggu Approval</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              vo.status === "ACTIVE" || vo.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : vo.status === "PENDING_APPROVAL"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {vo.status === "PENDING_APPROVAL"
                              ? "MENUNGGU PERSETUJUAN"
                              : vo.status === "ACTIVE" || vo.status === "APPROVED"
                              ? "AKTIF"
                              : vo.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {vo.status === "PENDING_APPROVAL" ? (
                            <div className="flex items-center justify-end space-x-1">
                              <Button
                                size="sm"
                                onClick={() => handleApproveVO(vo.id, vo.companyName)}
                                className="text-[10px] h-7 px-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Approve & Terbitkan Domisili
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectVO(vo.id, vo.companyName)}
                                className="text-[10px] h-7 px-2 font-bold text-rose-600 border-rose-300 hover:bg-rose-50"
                              >
                                Tolak
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic">Verified ✓</span>
                          )}
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

      {/* TAB 5: CHECK-IN / CHECK-OUT AUDIT LOG */}
      {activeTab === "LOGS" && (
        <Card className="shadow-sm animate-in fade-in">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>📋 Log Aktivitas Check-in & Check-out Co-working</span>
              <span className="text-xs text-slate-500 font-normal">Sinkronisasi status meja & waktu riil sistem</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="p-3">Tamu & Booking Code</th>
                  <th className="p-3">Ruang / Meja</th>
                  <th className="p-3">Waktu Check-In & PIC</th>
                  <th className="p-3">Waktu Check-Out & PIC</th>
                  <th className="p-3">Durasi Pemakaian</th>
                  <th className="p-3 text-center">Status Sesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {checkLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">
                      <p>{log.guestName}</p>
                      <p className="font-mono text-blue-600 text-[10px]">{log.bookingCode}</p>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">{log.spaceName}</td>
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{log.checkInDate} — {log.checkInTime}</p>
                      <p className="text-[10px] text-slate-400">Oleh: {log.checkInBy}</p>
                    </td>
                    <td className="p-3">
                      {log.checkoutTime ? (
                        <>
                          <p className="font-bold text-slate-900">{log.checkoutDate} — {log.checkoutTime}</p>
                          <p className="text-[10px] text-slate-400">Oleh: {log.checkoutBy}</p>
                        </>
                      ) : (
                        <span className="text-blue-600 font-semibold italic">Sedang Menggunakan Ruang</span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-800">{log.durationFormatted}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "ACTIVE_IN"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {log.status === "ACTIVE_IN" ? "AKTIF DI LOKASI" : "SELESAI"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: BUAT BOOKING & CHECK-IN */}
      {isNewBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Buat Booking & Check-In Co-working</h3>
              <button
                onClick={() => setIsNewBookingModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Tamu / Penyewa *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sarah Jenkins"
                  value={bookGuestName}
                  onChange={(e) => setBookGuestName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nomor WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="+62 812-xxxx-xxxx"
                    value={bookPhone}
                    onChange={(e) => setBookPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Perusahaan / Afiliasi</label>
                  <input
                    type="text"
                    placeholder="Contoh: Remote Nomad Tech"
                    value={bookCompany}
                    onChange={(e) => setBookCompany(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Pilih Ruang / Meja</label>
                <select
                  value={bookSpaceId}
                  onChange={(e) => setBookSpaceId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status === "AVAILABLE" ? "Tersedia" : "Terisi"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tipe Sewa</label>
                  <select
                    value={bookType}
                    onChange={(e) => setBookType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="DAILY">Harian</option>
                    <option value="HOURLY">Per Jam</option>
                    <option value="MONTHLY">Bulanan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Metode Bayar</label>
                  <select
                    value={bookPaymentMethod}
                    onChange={(e) => setBookPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                  >
                    <option value="QRIS DagoPay">QRIS DagoPay</option>
                    <option value="CASH">Tunai (Cash)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewBookingModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  Simpan, Bayar & Check-In
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DAFTAR MEMBER BARU */}
      {isNewMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Registrasi Member Co-working Baru</h3>
              <button
                onClick={() => setIsNewMemberModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Lengkap Member *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Made Bagus"
                  value={newMemName}
                  onChange={(e) => setNewMemName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kontak WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="+62 812-xxxx-xxxx"
                    value={newMemPhone}
                    onChange={(e) => setNewMemPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Email Member</label>
                  <input
                    type="email"
                    placeholder="email@nomad.com"
                    value={newMemEmail}
                    onChange={(e) => setNewMemEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Pilih Paket Membership</label>
                <select
                  value={newMemPackage}
                  onChange={(e) => {
                    setNewMemPackage(e.target.value);
                    if (e.target.value === "Dedicated Nomad Monthly") setNewMemAmount(1850000);
                    else if (e.target.value === "Flex 10 Days Pass") setNewMemAmount(550000);
                    else setNewMemAmount(3500000);
                  }}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
                >
                  <option value="Dedicated Nomad Monthly">Dedicated Nomad Monthly (Rp 1.850.000 / bln)</option>
                  <option value="Flex 10 Days Pass">Flex 10 Days Pass (Rp 550.000)</option>
                  <option value="Executive Team Pass">Executive Team Pass (Rp 3.500.000 / bln)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Metode Pembayaran</label>
                <select
                  value={newMemPaymentMethod}
                  onChange={(e) => setNewMemPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="QRIS DagoPay">QRIS DagoPay</option>
                  <option value="Bank Transfer">Bank Transfer BCA/Mandiri</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="CASH">Tunai</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewMemberModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  Simpan & Aktifkan Member
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PENDAFTARAN VIRTUAL OFFICE BARU */}
      {isNewVOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>Pendaftaran Virtual Office & Legalitas Baru</span>
                </h3>
                <p className="text-[11px] text-slate-500">Pilar A: Alamat Bisnis & Izin Domisili Gedung Dago</p>
              </div>
              <button
                onClick={() => setIsNewVOModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVO} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Perusahaan / Entitas Bisnis *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Kreasi Solusi Nusantara"
                  value={voCompanyName}
                  onChange={(e) => setVoCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nama PIC / Direktur *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bpk. Budi Santoso"
                    value={voApplicantName}
                    onChange={(e) => setVoApplicantName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">No. HP / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="+62 812-xxxx-xxxx"
                    value={voPhone}
                    onChange={(e) => setVoPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Email Resmi Bisnis</label>
                  <input
                    type="email"
                    placeholder="official@company.id"
                    value={voEmail}
                    onChange={(e) => setVoEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Bidang Usaha</label>
                  <input
                    type="text"
                    placeholder="Contoh: Software House / Konsultan"
                    value={voBusinessType}
                    onChange={(e) => setVoBusinessType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Paket Virtual Office (Durasi Kontrak: 1 Tahun)</label>
                <select
                  value={voPlan}
                  onChange={(e) => {
                    const plan = e.target.value as any;
                    setVoPlan(plan);
                    if (plan === "VO Starter (Alamat Bisnis)") setVoFee(2900000);
                    else if (plan === "VO Professional (Alamat + Kuota Meeting)") setVoFee(4200000);
                    else setVoFee(6500000);
                  }}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-slate-900"
                >
                  <option value="VO Starter (Alamat Bisnis)">VO Starter (Alamat Bisnis & Mailbox) — Rp 2.900.000 / thn</option>
                  <option value="VO Professional (Alamat + Kuota Meeting)">VO Professional (+ Kuota 10 Jam Meeting) — Rp 4.200.000 / thn</option>
                  <option value="VO Enterprise (Lengkap + Domisili)">VO Enterprise (Domisili Resmi + Dedicated Line) — Rp 6.500.000 / thn</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Berkas Legalitas (Akta / NIB / KTP)</label>
                <input
                  type="text"
                  value={voDocName}
                  onChange={(e) => setVoDocName(e.target.value)}
                  placeholder="Akta_NIB_PT_Company.pdf"
                  className="w-full px-3 py-2 border rounded-xl font-mono text-slate-700"
                />
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start space-x-2 text-indigo-900">
                <ShieldCheck className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  Setelah data diajukan, status aplikasi akan menjadi <b>PENDING_APPROVAL</b>. Admin Gedung Dago dapat memverifikasi berkas dan menekan tombol persetujuan untuk menerbitkan Surat Domisili Resmi.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewVOModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  Ajukan Pendaftaran VO
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Official Coworking Report Modal */}
      <CoworkingReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        spaces={spaces}
        bookings={bookings}
        members={members}
        outletName={activeOutlet?.name || "Semua Outlet"}
      />
    </div>
  );
}
