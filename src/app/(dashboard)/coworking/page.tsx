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
  Printer,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Upload,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyIDR } from "@/lib/utils";
import { SpaceType, CoworkingSpaceItem } from "@/types/coworking";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { CoworkingReportPDFModal } from "@/features/coworking/CoworkingReportPDFModal";
import { CoworkingReceiptModal, CoworkingReceiptData } from "@/features/coworking/CoworkingReceiptModal";

export default function CoworkingPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const {
    spaces,
    bookings,
    members,
    checkLogs,
    addSpace,
    updateSpace,
    deleteSpace,
    bookSpace,
    checkInBooking,
    checkoutSpace,
    addMember,
  } = useCoworking();

  const [activeTab, setActiveTab] = useState<"SPACES" | "BOOKINGS" | "MEMBERS" | "LOGS">("SPACES");
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [selectedBookingForReceipt, setSelectedBookingForReceipt] = useState<CoworkingReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [isAddSpaceModalOpen, setIsAddSpaceModalOpen] = useState(false);
  const [isEditSpaceModalOpen, setIsEditSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<CoworkingSpaceItem | null>(null);

  // Add Space Form States
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceType, setNewSpaceType] = useState<SpaceType>("HOT_DESK");
  const [newSpaceArea, setNewSpaceArea] = useState<"Ground Floor Main" | "Mezzanine Quiet Zone" | "VIP Meeting Wing">("Ground Floor Main");
  const [newSpaceCapacity, setNewSpaceCapacity] = useState<number>(1);
  const [newSpaceHourlyRate, setNewSpaceHourlyRate] = useState<number>(20000);
  const [newSpaceDailyRate, setNewSpaceDailyRate] = useState<number>(90000);
  const [newSpaceMonthlyRate, setNewSpaceMonthlyRate] = useState<number>(0);
  const [newSpaceAmenities, setNewSpaceAmenities] = useState("High-speed Fiber WiFi, Power Outlet, Free Flow Coffee/Tea");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");
  const [newSpaceImageUrl, setNewSpaceImageUrl] = useState("");

  // Edit Space Form States
  const [editSpaceName, setEditSpaceName] = useState("");
  const [editSpaceType, setEditSpaceType] = useState<SpaceType>("HOT_DESK");
  const [editSpaceArea, setEditSpaceArea] = useState<"Ground Floor Main" | "Mezzanine Quiet Zone" | "VIP Meeting Wing">("Ground Floor Main");
  const [editSpaceCapacity, setEditSpaceCapacity] = useState<number>(1);
  const [editSpaceHourlyRate, setEditSpaceHourlyRate] = useState<number>(0);
  const [editSpaceDailyRate, setEditSpaceDailyRate] = useState<number>(0);
  const [editSpaceMonthlyRate, setEditSpaceMonthlyRate] = useState<number>(0);
  const [editSpaceAmenities, setEditSpaceAmenities] = useState("");
  const [editSpaceDesc, setEditSpaceDesc] = useState("");
  const [editSpaceImageUrl, setEditSpaceImageUrl] = useState("");

  const handleSpaceImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Format file tidak valid. Harap pilih gambar (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ukuran foto maksimal 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEditSpace = (sp: CoworkingSpaceItem) => {
    setEditingSpace(sp);
    setEditSpaceName(sp.name);
    setEditSpaceType(sp.type);
    setEditSpaceArea(sp.area);
    setEditSpaceCapacity(sp.capacity);
    setEditSpaceHourlyRate(sp.hourlyRate);
    setEditSpaceDailyRate(sp.dailyRate);
    setEditSpaceMonthlyRate(sp.monthlyRate || 0);
    setEditSpaceAmenities(sp.amenities.join(", "));
    setEditSpaceDesc(sp.description || "");
    setEditSpaceImageUrl(sp.imageUrl || "");
    setIsEditSpaceModalOpen(true);
  };

  const handleAddSpaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    const parsedAmenities = newSpaceAmenities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const created = addSpace({
      name: newSpaceName.trim(),
      type: newSpaceType,
      area: newSpaceArea,
      capacity: Number(newSpaceCapacity),
      hourlyRate: Number(newSpaceHourlyRate),
      dailyRate: Number(newSpaceDailyRate),
      monthlyRate: newSpaceMonthlyRate ? Number(newSpaceMonthlyRate) : undefined,
      status: "AVAILABLE",
      amenities: parsedAmenities.length > 0 ? parsedAmenities : ["WiFi 100Mbps", "Power Outlet"],
      description: newSpaceDesc.trim() || undefined,
      imageUrl: newSpaceImageUrl.trim() || undefined,
    });

    setIsAddSpaceModalOpen(false);
    setNewSpaceName("");
    setNewSpaceDesc("");
    setNewSpaceImageUrl("");
    showToast(`Workspace "${created.name}" berhasil ditambahkan & otomatis tersedia di POS dan Portal!`);
  };

  const handleUpdateSpaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpace || !editSpaceName.trim()) return;

    const parsedAmenities = editSpaceAmenities
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    updateSpace(editingSpace.id, {
      name: editSpaceName.trim(),
      type: editSpaceType,
      area: editSpaceArea,
      capacity: Number(editSpaceCapacity),
      hourlyRate: Number(editSpaceHourlyRate),
      dailyRate: Number(editSpaceDailyRate),
      monthlyRate: editSpaceMonthlyRate ? Number(editSpaceMonthlyRate) : undefined,
      amenities: parsedAmenities.length > 0 ? parsedAmenities : editingSpace.amenities,
      description: editSpaceDesc.trim() || undefined,
      imageUrl: editSpaceImageUrl.trim() || undefined,
    });

    setIsEditSpaceModalOpen(false);
    setEditingSpace(null);
    showToast(`Workspace "${editSpaceName}" berhasil diperbarui!`);
  };

  const handleDeleteSpace = (id: string) => {
    deleteSpace(id);
    showToast("Workspace berhasil diarsipkan dari katalog.");
  };

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

  // New Booking Form States (Unified & Consistent with Customer Portal)
  const todayStr = new Date().toISOString().split("T")[0];
  const [bookGuestName, setBookGuestName] = useState("");
  const [bookPhone, setBookPhone] = useState("");
  const [bookEmail, setBookEmail] = useState("");
  const [bookCompany, setBookCompany] = useState("");
  const [bookSpaceId, setBookSpaceId] = useState(spaces[0]?.id || "");
  const [bookType, setBookType] = useState<"HOURLY" | "DAILY" | "MONTHLY">("HOURLY");
  const [bookDurationHours, setBookDurationHours] = useState<number>(2); // Min 2 hours
  const [bookDailyPreset, setBookDailyPreset] = useState<"1_DAY" | "3_DAYS" | "7_DAYS" | "14_DAYS" | "CUSTOM_RANGE">("1_DAY");
  const [bookStartDate, setBookStartDate] = useState(todayStr);
  const [bookEndDate, setBookEndDate] = useState(todayStr);
  const [bookStartTime, setBookStartTime] = useState("09:00");
  const [bookPaymentMethod, setBookPaymentMethod] = useState<string>("QRIS DagoPay");
  const [bookIsImmediateCheckIn, setBookIsImmediateCheckIn] = useState<boolean>(true);
  const [isMasterManageMode, setIsMasterManageMode] = useState(false);

  const OPERATIONAL_TIME_SLOTS = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
  ];

  const calculateDaysCount = (start: string, end: string) => {
    if (!start || !end) return 1;
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, isNaN(diffDays) ? 1 : diffDays);
  };

  const calculateHourlyEndTime = (startTime: string, hours: number) => {
    const [h, m] = (startTime || "09:00").split(":").map(Number);
    const endH = Math.min(23, (h || 9) + (hours || 2));
    return `${endH.toString().padStart(2, "0")}:${(m || 0).toString().padStart(2, "0")}`;
  };

  // New Member Form States
  const [newMemName, setNewMemName] = useState("");
  const [newMemPhone, setNewMemPhone] = useState("");
  const [newMemEmail, setNewMemEmail] = useState("");
  const [newMemPackage, setNewMemPackage] = useState("Dedicated Nomad Monthly");
  const [newMemAmount, setNewMemAmount] = useState(1850000);
  const [newMemPaymentMethod, setNewMemPaymentMethod] = useState("QRIS DagoPay");
  const [toastMessage, setToastMessage] = useState("");
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

    let computedDuration = 1;
    let computedTotal = 0;
    let computedEndDate: string | undefined = undefined;
    let computedEndTime: string | undefined = undefined;

    if (bookType === "HOURLY") {
      computedDuration = Math.max(2, Number(bookDurationHours));
      computedTotal = selectedSpace.hourlyRate * computedDuration;
      computedEndTime = `${calculateHourlyEndTime(bookStartTime, computedDuration)} WITA`;
    } else if (bookType === "DAILY") {
      if (bookDailyPreset === "1_DAY") {
        computedDuration = 1;
        computedEndDate = bookStartDate;
      } else if (bookDailyPreset === "3_DAYS") {
        computedDuration = 3;
        const d = new Date(bookStartDate);
        d.setDate(d.getDate() + 2);
        computedEndDate = d.toISOString().split("T")[0];
      } else if (bookDailyPreset === "7_DAYS") {
        computedDuration = 7;
        const d = new Date(bookStartDate);
        d.setDate(d.getDate() + 6);
        computedEndDate = d.toISOString().split("T")[0];
      } else if (bookDailyPreset === "14_DAYS") {
        computedDuration = 14;
        const d = new Date(bookStartDate);
        d.setDate(d.getDate() + 13);
        computedEndDate = d.toISOString().split("T")[0];
      } else {
        // CUSTOM_RANGE
        computedDuration = calculateDaysCount(bookStartDate, bookEndDate);
        computedEndDate = bookEndDate;
      }
      computedTotal = selectedSpace.dailyRate * computedDuration;
      computedEndTime = "18:00 WITA";
    } else {
      // MONTHLY
      computedDuration = 30;
      const d = new Date(bookStartDate);
      d.setDate(d.getDate() + 29);
      computedEndDate = d.toISOString().split("T")[0];
      computedTotal = selectedSpace.monthlyRate || selectedSpace.dailyRate * 20;
      computedEndTime = "Akses Penuh 30 Hari";
    }

    const nowTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WITA";
    const dateFormatted = new Date(bookStartDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const endDateFormatted = computedEndDate
      ? new Date(computedEndDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
      : undefined;

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
      endDate: endDateFormatted,
      startTime: bookType === "HOURLY" ? `${bookStartTime} WITA` : "09:00 WITA",
      endTime: computedEndTime,
      duration: computedDuration,
      price: computedTotal,
      discount: 0,
      totalAmount: computedTotal,
      paidAmount: computedTotal,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: bookPaymentMethod,
      paymentRef: `PAY-CWK-${Date.now().toString().slice(-6)}`,
      paymentTimestamp: `${dateFormatted} ${nowTime}`,
      checkInStatus: bookIsImmediateCheckIn ? "CHECKED_IN" : "RESERVED",
    });

    setIsNewBookingModalOpen(false);
    setBookGuestName("");
    setBookPhone("");
    setBookEmail("");
    setBookCompany("");
    showToast(
      `Booking ${selectedSpace.name} (${bookGuestName}) berhasil disimpan [${bookIsImmediateCheckIn ? "CHECKED_IN - SEDANG AKTIF" : "RESERVED - TERJADWAL"}]!`
    );
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
            <span>Co-working Space Management — {activeOutlet?.name || "Singaraja"}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {spaces.length} Ruang/Meja ({availableSpacesCount} Tersedia • {occupiedSpacesCount} Digunakan) • {members.filter((m) => m.status === "ACTIVE").length} Member Aktif
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



          {(user?.role === "OWNER" || user?.role === "ADMIN") && (
            <>
              <Button
                size="sm"
                variant={isMasterManageMode ? "default" : "outline"}
                onClick={() => setIsMasterManageMode(!isMasterManageMode)}
                className={`text-xs space-x-1.5 font-bold transition-all ${isMasterManageMode
                    ? "bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
                    : "border-purple-300 text-purple-700 hover:bg-purple-50"
                  }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isMasterManageMode ? "Tutup Mode Master" : "Kelola Master Ruang"}</span>
              </Button>

              {isMasterManageMode && (
                <Button
                  size="sm"
                  onClick={() => setIsAddSpaceModalOpen(true)}
                  className="text-xs font-bold space-x-1 bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Ruangan</span>
                </Button>
              )}
            </>
          )}

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
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("SPACES")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all ${activeTab === "SPACES"
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
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all ${activeTab === "BOOKINGS"
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
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all ${activeTab === "MEMBERS"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Member Co-working ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOGS")}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 transition-all ${activeTab === "LOGS"
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
          {isMasterManageMode && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900 font-medium animate-in fade-in">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span><strong>Mode Kelola Master Ruangan Aktif:</strong> Anda dapat mengubah data teknis tarif, fasilitas, dan foto ruang atau menambah unit baru.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddSpaceModalOpen(true)}
                className="text-xs h-7 border-purple-300 text-purple-700 bg-white hover:bg-purple-100 font-bold"
              >
                + Tambah Ruang Baru
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((sp) => {
              const isOccupied = sp.status === "OCCUPIED";

              return (
                <Card
                  key={sp.id}
                  className={`p-4 border transition-all flex flex-col justify-between ${isOccupied
                      ? "bg-blue-50/50 border-blue-300 shadow-xs"
                      : "bg-white border-slate-200 shadow-xs hover:border-slate-300"
                    }`}
                >
                  <div className="space-y-3">
                    {/* Space Photo Cover */}
                    {sp.imageUrl ? (
                      <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={sp.imageUrl}
                          alt={sp.name}
                          className="w-full h-full object-cover"
                        />
                        {isMasterManageMode && (
                          <div className="absolute top-2 right-2 flex items-center space-x-1">
                            <button
                              onClick={() => handleOpenEditSpace(sp)}
                              className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white hover:text-blue-600 shadow-xs transition-all"
                              title="Edit Workspace"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpace(sp.id)}
                              className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white hover:text-rose-600 shadow-xs transition-all"
                              title="Hapus Workspace"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-24 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-400">
                        <Laptop className="w-8 h-8 opacity-30" />
                        {isMasterManageMode && (
                          <div className="absolute top-2 right-2 flex items-center space-x-1">
                            <button
                              onClick={() => handleOpenEditSpace(sp)}
                              className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white hover:text-blue-600 shadow-xs transition-all"
                              title="Edit Workspace"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSpace(sp.id)}
                              className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white hover:text-rose-600 shadow-xs transition-all"
                              title="Hapus Workspace"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-start justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          {sp.type.replace("_", " ")} • {sp.area}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 mt-0.5">{sp.name}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {sp.description || "Ruang kerja kondusif dengan fasilitas lengkap."}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded flex-shrink-0 ${isOccupied ? "bg-blue-600 text-white" : "bg-emerald-100 text-emerald-800"
                          }`}
                      >
                        {sp.status}
                      </span>
                    </div>

                    <div className="py-1 space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Tarif Per Jam:</span>
                        <span className="font-mono font-bold text-blue-600">
                          {formatCurrencyIDR(sp.hourlyRate)} / jam
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tarif Harian:</span>
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
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
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
                        <p className="font-semibold text-slate-900">
                          {b.endDate && b.endDate !== b.date ? `${b.date} s/d ${b.endDate}` : b.date}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {b.bookingType === "HOURLY"
                            ? `Jam: ${b.startTime} ${b.endTime ? `– ${b.endTime}` : ""} (${b.duration} Jam)`
                            : `Durasi: ${b.duration} Hari ${b.endTime ? `(${b.startTime} – ${b.endTime})` : ""}`}
                        </p>
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
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.checkInStatus === "CHECKED_IN"
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
                        <div className="flex items-center justify-end space-x-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const [startH, startM] = (b.startTime || "09:00").split(":").map(Number);
                              const endH = (startH + (b.duration || 1)) % 24;
                              const endTime = `${endH.toString().padStart(2, "0")}:${(startM || 0).toString().padStart(2, "0")}`;

                              setSelectedBookingForReceipt({
                                bookingCode: b.bookingCode || b.id,
                                transactionDate: `${b.date}, ${b.startTime || "09:00"} WITA`,
                                guestName: b.guestName,
                                guestPhone: b.guestPhone,
                                guestEmail: b.guestEmail,
                                company: b.company,
                                spaceName: b.spaceName,
                                spaceType: b.spaceType,
                                outletName: activeOutlet?.name || "Singaraja",
                                outletAddress: "Jl. Veteran No. 18, Singaraja, Bali",
                                outletPhone: "(0362) 23456",
                                bookingDate: b.date,
                                endDate: b.endDate,
                                startTime: b.startTime,
                                endTime,
                                duration: b.duration,
                                bookingType: b.bookingType || "HOURLY",
                                basePrice: b.totalAmount,
                                totalAmount: b.totalAmount,
                                paymentMethod: b.paymentMethod || "QRIS",
                                paymentStatus: b.paymentStatus || "PAID",
                                notes: b.notes,
                              });
                              setIsReceiptModalOpen(true);
                            }}
                            className="text-[10px] h-7 px-2 font-bold text-slate-700 hover:bg-slate-100 flex items-center space-x-1"
                          >
                            <Printer className="w-3 h-3 text-slate-500" />
                            <span>Nota</span>
                          </Button>

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
                        </div>
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
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${memberStatusFilter === st
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
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${m.status === "ACTIVE"
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

      {/* TAB 4: CHECK-IN / CHECK-OUT AUDIT LOG */}
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
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === "ACTIVE_IN"
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

      {/* MODAL 1: BUAT BOOKING & CHECK-IN (HARMONIZED & CONSISTENT WITH PACKAGES & DATE RANGE) */}
      {isNewBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Buat Booking & Check-In Co-working</h3>
                  <p className="text-[11px] text-slate-500">Pilih paket durasi, slot jam operasional, atau rentang tanggal sewa</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewBookingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Workspace Card Preview */}
            {(() => {
              const currentSelectedSpace = spaces.find((s) => s.id === bookSpaceId) || spaces[0];
              return (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                        {currentSelectedSpace?.type.replace("_", " ")}
                      </span>
                      <h4 className="font-black text-sm text-slate-900 mt-1">{currentSelectedSpace?.name}</h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{currentSelectedSpace?.area} &bull; Kapasitas: {currentSelectedSpace?.capacity} Orang</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold block">Tarif Sewa</span>
                      <p className="font-black text-xs text-blue-600 font-mono">
                        {formatCurrencyIDR(currentSelectedSpace?.hourlyRate || 0)} <span className="text-[10px] font-normal text-slate-500">/ jam</span>
                      </p>
                      <p className="font-bold text-[11px] text-slate-700 font-mono">
                        {formatCurrencyIDR(currentSelectedSpace?.dailyRate || 0)} <span className="text-[10px] font-normal text-slate-500">/ hari</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              {/* Workspace Selection */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Pilih Ruang / Meja Kerja</label>
                <select
                  value={bookSpaceId}
                  onChange={(e) => setBookSpaceId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type.replace("_", " ")} &bull; {s.status === "AVAILABLE" ? "🟢 Tersedia" : "🔴 Terisi"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Booking Mode Switcher Tabs */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Tipe Sewa & Paket</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setBookType("HOURLY");
                      setBookDurationHours(2);
                    }}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs transition-all ${bookType === "HOURLY"
                        ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    ⏱️ Paket Jam
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookType("DAILY");
                      setBookDailyPreset("1_DAY");
                    }}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs transition-all ${bookType === "DAILY"
                        ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    📅 Sewa Harian / Multi-Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookType("MONTHLY")}
                    className={`py-2 px-2 rounded-xl text-center font-bold text-xs transition-all ${bookType === "MONTHLY"
                        ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    🏢 Bulanan (30 Hari)
                  </button>
                </div>
              </div>

              {/* 1. HOURLY PACKAGE MODE */}
              {bookType === "HOURLY" && (
                <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-200/80 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tanggal Pemakaian</span>
                      </label>
                      <input
                        type="date"
                        value={bookStartDate}
                        onChange={(e) => {
                          setBookStartDate(e.target.value);
                          setBookEndDate(e.target.value);
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 flex items-center justify-between">
                        <span>Durasi Jam</span>
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded">Min. 2 Jam</span>
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={12}
                        value={bookDurationHours}
                        onChange={(e) => setBookDurationHours(Math.max(2, Number(e.target.value)))}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                      />
                    </div>
                  </div>

                  {/* Hourly Preset Pills */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-semibold block">Pilihan Cepat Paket Durasi:</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { hours: 2, label: "Paket 2 Jam (Min)" },
                        { hours: 3, label: "Paket 3 Jam" },
                        { hours: 4, label: "Paket 4 Jam (1/2 Hari)" },
                        { hours: 8, label: "Paket 8 Jam (Full)" },
                      ].map((item) => (
                        <button
                          key={item.hours}
                          type="button"
                          onClick={() => setBookDurationHours(item.hours)}
                          className={`py-1.5 px-1 rounded-xl text-center text-[10px] font-bold border transition-all ${bookDurationHours === item.hours
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Operational Time Slots (09:00 - 18:00) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Pilih Jam Mulai (Operasional 09:00 - 18:00)</span>
                      </label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full font-mono">
                        Sewa: {bookStartTime} &ndash; {calculateHourlyEndTime(bookStartTime, bookDurationHours)} WITA
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200">
                      {OPERATIONAL_TIME_SLOTS.map((slot) => {
                        const isSelected = bookStartTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setBookStartTime(slot)}
                            className={`py-1 rounded-lg text-center font-mono font-bold text-xs transition-all ${isSelected
                                ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-600/30"
                                : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                              }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. DAILY & MULTI-DAY DATE RANGE MODE */}
              {bookType === "DAILY" && (
                <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Pilihan Paket Harian atau Rentang Tanggal</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {[
                        { key: "1_DAY", label: "1 Hari Pass" },
                        { key: "3_DAYS", label: "3 Hari Pass" },
                        { key: "7_DAYS", label: "7 Hari (Weekly)" },
                        { key: "14_DAYS", label: "14 Hari Pass" },
                        { key: "CUSTOM_RANGE", label: "Rentang Tanggal" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setBookDailyPreset(item.key as any)}
                          className={`py-1.5 px-1 rounded-xl text-center text-[10px] font-bold border transition-all ${bookDailyPreset === item.key
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Pickers for Range */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tanggal Mulai *</span>
                      </label>
                      <input
                        type="date"
                        value={bookStartDate}
                        onChange={(e) => setBookStartDate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500/20"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tanggal Selesai *</span>
                      </label>
                      <input
                        type="date"
                        min={bookStartDate}
                        disabled={bookDailyPreset !== "CUSTOM_RANGE"}
                        value={
                          bookDailyPreset === "1_DAY"
                            ? bookStartDate
                            : bookDailyPreset === "3_DAYS"
                              ? (() => {
                                const d = new Date(bookStartDate);
                                d.setDate(d.getDate() + 2);
                                return d.toISOString().split("T")[0];
                              })()
                              : bookDailyPreset === "7_DAYS"
                                ? (() => {
                                  const d = new Date(bookStartDate);
                                  d.setDate(d.getDate() + 6);
                                  return d.toISOString().split("T")[0];
                                })()
                                : bookDailyPreset === "14_DAYS"
                                  ? (() => {
                                    const d = new Date(bookStartDate);
                                    d.setDate(d.getDate() + 13);
                                    return d.toISOString().split("T")[0];
                                  })()
                                  : bookEndDate
                        }
                        onChange={(e) => setBookEndDate(e.target.value)}
                        className={`w-full p-2 border rounded-xl font-bold text-xs outline-none ${bookDailyPreset === "CUSTOM_RANGE"
                            ? "bg-white border-amber-300 focus:ring-2 focus:ring-amber-500/20 text-slate-900"
                            : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                          }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between font-bold">
                    <span>
                      📅 Total:{" "}
                      {bookDailyPreset === "1_DAY"
                        ? "1 Hari"
                        : bookDailyPreset === "3_DAYS"
                          ? "3 Hari"
                          : bookDailyPreset === "7_DAYS"
                            ? "7 Hari (1 Minggu Penuh)"
                            : bookDailyPreset === "14_DAYS"
                              ? "14 Hari (2 Minggu)"
                              : `${calculateDaysCount(bookStartDate, bookEndDate)} Hari`}
                    </span>
                    <span className="text-slate-500 font-normal">Akses 09:00 &ndash; 18:00 WITA setiap hari</span>
                  </div>
                </div>
              )}

              {/* 3. MONTHLY PACKAGE MODE */}
              {bookType === "MONTHLY" && (
                <div className="p-3.5 bg-purple-50/50 rounded-2xl border border-purple-200/80 space-y-2">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span>Tanggal Mulai Keanggotaan Bulanan (30 Hari Akses Penuh)</span>
                  </label>
                  <input
                    type="date"
                    value={bookStartDate}
                    onChange={(e) => setBookStartDate(e.target.value)}
                    className="w-full p-2 bg-white border border-purple-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-purple-500/20"
                    required
                  />
                  <p className="text-[11px] text-purple-800">
                    Akses meja khusus / dedicated workspace selama 30 hari kalender, termasuk locker dan kuota meeting room.
                  </p>
                </div>
              )}

              {/* Customer Information Form */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nama Tamu / Penyewa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Sarah Jenkins / PT Nomad Tech"
                    value={bookGuestName}
                    onChange={(e) => setBookGuestName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
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
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Email (Opsional)</label>
                    <input
                      type="email"
                      placeholder="nomad@example.com"
                      value={bookEmail}
                      onChange={(e) => setBookEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Perusahaan / Catatan Khusus</label>
                  <input
                    type="text"
                    placeholder="Contoh: Tim IT Remote, butuh stopkontak tambahan"
                    value={bookCompany}
                    onChange={(e) => setBookCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Payment & Check-In Action Mode */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Metode Pembayaran</label>
                    <select
                      value={bookPaymentMethod}
                      onChange={(e) => setBookPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-medium text-xs outline-none"
                    >
                      <option value="QRIS DagoPay">QRIS DagoPay (Instant)</option>
                      <option value="CASH">Tunai (Cash Meja Kasir)</option>
                      <option value="EDC / Debit Card">EDC / Kartu Debit Bank</option>
                      <option value="Bank Transfer">Bank Transfer (BCA/Mandiri)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Status Aksi Sesi</label>
                    <div className="flex items-center space-x-2 pt-1.5">
                      <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={bookIsImmediateCheckIn}
                          onChange={(e) => setBookIsImmediateCheckIn(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span>Langsung Check-In Tamu (Walk-In)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Bill Breakdown Summary Card */}
                {(() => {
                  const selSpace = spaces.find((s) => s.id === bookSpaceId) || spaces[0];
                  let calcDur = 1;
                  let calcPrice = 0;
                  if (bookType === "HOURLY") {
                    calcDur = Math.max(2, Number(bookDurationHours));
                    calcPrice = (selSpace?.hourlyRate || 0) * calcDur;
                  } else if (bookType === "DAILY") {
                    if (bookDailyPreset === "1_DAY") calcDur = 1;
                    else if (bookDailyPreset === "3_DAYS") calcDur = 3;
                    else if (bookDailyPreset === "7_DAYS") calcDur = 7;
                    else if (bookDailyPreset === "14_DAYS") calcDur = 14;
                    else calcDur = calculateDaysCount(bookStartDate, bookEndDate);
                    calcPrice = (selSpace?.dailyRate || 0) * calcDur;
                  } else {
                    calcDur = 30;
                    calcPrice = selSpace?.monthlyRate || (selSpace?.dailyRate || 0) * 20;
                  }

                  return (
                    <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Tagihan Lunas</span>
                        <span className="text-xs text-slate-300">
                          {bookType === "HOURLY"
                            ? `${calcDur} Jam (${bookStartTime} - ${calculateHourlyEndTime(bookStartTime, calcDur)})`
                            : bookType === "DAILY"
                              ? `${calcDur} Hari (${bookStartDate} ${bookDailyPreset === "CUSTOM_RANGE" ? `s/d ${bookEndDate}` : ""})`
                              : "Paket Bulanan 30 Hari"}
                        </span>
                      </div>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {formatCurrencyIDR(calcPrice)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewBookingModalOpen(false)}
                  className="rounded-xl font-bold"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm px-4"
                >
                  {bookIsImmediateCheckIn ? "Simpan, Bayar & Check-In Tamu" : "Simpan Reservasi Terjadwal"}
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

      {/* Modal Tambah Workspace */}
      {isAddSpaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <Laptop className="w-4 h-4 text-brand-orange" />
                <span>Tambah Master Workspace Baru</span>
              </h3>
              <button
                onClick={() => setIsAddSpaceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSpaceSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Workspace / Ruangan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Focus Studio Pod B-02"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tipe Ruangan</label>
                  <select
                    value={newSpaceType}
                    onChange={(e) => setNewSpaceType(e.target.value as SpaceType)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                  >
                    <option value="HOT_DESK">Hot Desk</option>
                    <option value="DEDICATED_DESK">Dedicated Desk</option>
                    <option value="MEETING_ROOM">Meeting Room</option>
                    <option value="PRIVATE_POD">Private Pod</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Area Lokasi</label>
                  <select
                    value={newSpaceArea}
                    onChange={(e) => setNewSpaceArea(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                  >
                    <option value="Ground Floor Main">Ground Floor Main</option>
                    <option value="Mezzanine Quiet Zone">Mezzanine Quiet Zone</option>
                    <option value="VIP Meeting Wing">VIP Meeting Wing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kapasitas (Pax)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newSpaceCapacity}
                    onChange={(e) => setNewSpaceCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-bold font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tarif / Jam (Rp)</label>
                  <input
                    type="number"
                    required
                    min={5000}
                    step={1000}
                    value={newSpaceHourlyRate}
                    onChange={(e) => setNewSpaceHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-bold font-mono text-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tarif / Hari (Rp)</label>
                  <input
                    type="number"
                    required
                    min={10000}
                    step={5000}
                    value={newSpaceDailyRate}
                    onChange={(e) => setNewSpaceDailyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-bold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Keterangan / Deskripsi Ruangan</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan suasana, fasilitas presentasi, atau kenyamanan ruang kerja..."
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Fasilitas Termasuk (Pisahkan Koma)</label>
                <input
                  type="text"
                  placeholder="Contoh: WiFi 100Mbps, Smart TV 4K, Whiteboard, Free Coffee"
                  value={newSpaceAmenities}
                  onChange={(e) => setNewSpaceAmenities(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              {/* Photo Upload & Preview */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <ImageIcon className="w-3.5 h-3.5 text-brand-orange" />
                    <span>Foto Workspace</span>
                  </span>
                  {newSpaceImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNewSpaceImageUrl("")}
                      className="text-[10px] text-rose-500 font-bold hover:underline"
                    >
                      Hapus Foto
                    </button>
                  )}
                </label>

                {newSpaceImageUrl ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                      src={newSpaceImageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <label className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-orange/60 hover:bg-orange-50/20 transition-all text-slate-500">
                    <Upload className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-600">Pilih / Upload Foto Ruangan</span>
                    <span className="text-[9px] text-slate-400">JPG, PNG, atau WEBP (maks 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSpaceImageUpload(e, setNewSpaceImageUrl)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddSpaceModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                  Simpan & Aktifkan Ruang
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Workspace */}
      {isEditSpaceModalOpen && editingSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Edit Workspace: {editingSpace.name}</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditSpaceModalOpen(false);
                  setEditingSpace(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSpaceSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nama Workspace / Ruangan</label>
                <input
                  type="text"
                  required
                  value={editSpaceName}
                  onChange={(e) => setEditSpaceName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tipe Ruangan</label>
                  <select
                    value={editSpaceType}
                    onChange={(e) => setEditSpaceType(e.target.value as SpaceType)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                  >
                    <option value="HOT_DESK">Hot Desk</option>
                    <option value="DEDICATED_DESK">Dedicated Desk</option>
                    <option value="MEETING_ROOM">Meeting Room</option>
                    <option value="PRIVATE_POD">Private Pod</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Area Lokasi</label>
                  <select
                    value={editSpaceArea}
                    onChange={(e) => setEditSpaceArea(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                  >
                    <option value="Ground Floor Main">Ground Floor Main</option>
                    <option value="Mezzanine Quiet Zone">Mezzanine Quiet Zone</option>
                    <option value="VIP Meeting Wing">VIP Meeting Wing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kapasitas (Pax)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editSpaceCapacity}
                    onChange={(e) => setEditSpaceCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-bold font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tarif / Jam (Rp)</label>
                  <input
                    type="number"
                    required
                    min={5000}
                    step={1000}
                    value={editSpaceHourlyRate}
                    onChange={(e) => setEditSpaceHourlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-bold font-mono text-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tarif / Hari (Rp)</label>
                  <input
                    type="number"
                    required
                    min={10000}
                    step={5000}
                    value={editSpaceDailyRate}
                    onChange={(e) => setEditSpaceDailyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl font-bold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Keterangan / Deskripsi Ruangan</label>
                <textarea
                  rows={2}
                  placeholder="Jelaskan suasana, fasilitas presentasi, atau kenyamanan ruang kerja..."
                  value={editSpaceDesc}
                  onChange={(e) => setEditSpaceDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl resize-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Fasilitas Termasuk (Pisahkan Koma)</label>
                <input
                  type="text"
                  value={editSpaceAmenities}
                  onChange={(e) => setEditSpaceAmenities(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              {/* Photo Upload, Replace & Preview */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Foto Workspace</span>
                  </span>
                  {editSpaceImageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditSpaceImageUrl("")}
                      className="text-[10px] text-rose-500 font-bold hover:underline"
                    >
                      Hapus Foto
                    </button>
                  )}
                </label>

                {editSpaceImageUrl ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img
                        src={editSpaceImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <label className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 cursor-pointer hover:underline">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ganti Foto Ruangan</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSpaceImageUpload(e, setEditSpaceImageUrl)}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/60 hover:bg-blue-50/20 transition-all text-slate-500">
                    <Upload className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-600">Pilih / Upload Foto Baru</span>
                    <span className="text-[9px] text-slate-400">JPG, PNG, atau WEBP (maks 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSpaceImageUpload(e, setEditSpaceImageUrl)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditSpaceModalOpen(false);
                    setEditingSpace(null);
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  Simpan Perubahan
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

      {/* Coworking Thermal Receipt Modal */}
      <CoworkingReceiptModal
        isOpen={isReceiptModalOpen}
        receiptData={selectedBookingForReceipt}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
}
