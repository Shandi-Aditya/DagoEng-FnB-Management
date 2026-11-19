"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, History, Laptop, Users } from "lucide-react";

import { notify } from "@/components/app/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { normalizeLoyaltyPhone, useLoyalty } from "@/contexts/LoyaltyContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useSettings } from "@/contexts/SettingsContext";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { resolveCoworkingReceiptPublisher } from "@/lib/receipt-publisher";
import type { CoworkingBooking } from "@/types/coworking";

import { CoworkingBookingsTab } from "@/features/coworking/CoworkingBookingsTab";
import {
  buildCoworkingExportData,
  calculateCoworkingKPIs,
  filterCoworkingBookings,
  filterCoworkingMembers,
} from "@/features/coworking/coworking-domain";
import { CoworkingLogsTab } from "@/features/coworking/CoworkingLogsTab";
import { CoworkingMembersTab } from "@/features/coworking/CoworkingMembersTab";
import {
  type CoworkingReceiptData,
  CoworkingReceiptModal,
} from "@/features/coworking/CoworkingReceiptModal";
import { CoworkingReportPDFModal } from "@/features/coworking/CoworkingReportPDFModal";
import { CoworkingSpacesTab } from "@/features/coworking/CoworkingSpacesTab";
import { CoworkingToolbar } from "@/features/coworking/CoworkingToolbar";
import { CoworkingQrisModal } from "@/features/coworking/CoworkingQrisModal";
import { NewBookingModal } from "@/features/coworking/NewBookingModal";
import { NewMemberModal } from "@/features/coworking/NewMemberModal";

export default function CoworkingPage() {
  const { user } = useAuth();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { settings } = useSettings();
  const { members: loyaltyMembers, addPoints } = useLoyalty();
  const { recordShiftTransaction } = useEmployeeShift();
  const {
    spaces,
    bookings,
    members,
    checkLogs,
    bookSpace,
    checkInBooking,
    checkoutSpace,
    addMember,
  } = useCoworking();

  const [activeTab, setActiveTab] = useState<"SPACES" | "BOOKINGS" | "MEMBERS" | "LOGS">("SPACES");
  const [bookingSearchQuery, setBookingSearchQuery] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("ALL");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [selectedBookingForReceipt, setSelectedBookingForReceipt] = useState<CoworkingReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Operational Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [selectedSpaceIdForBooking, setSelectedSpaceIdForBooking] = useState<string | undefined>();
  const [selectedQrisBooking, setSelectedQrisBooking] = useState<CoworkingBooking | null>(null);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState(false);

  // Cashier redirection
  if (user?.role?.slug === "CASHIER") {
    return (
      <div className="mx-auto my-12 max-w-lg space-y-4 rounded-2xl border border-border bg-card p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
          <Laptop className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-medium text-foreground">Operasional terintegrasi di POS kasir</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Untuk staf kasir, seluruh transaksi dan pemesanan co-working dilayani langsung melalui modul <strong className="text-foreground">POS Kasir</strong>.
          </p>
        </div>
        <div className="pt-2">
          <Button
            render={<Link href="/pos" />}
            nativeButton={false}
          >
            Buka modul POS kasir
          </Button>
        </div>
      </div>
    );
  }

  const outletBookings = useMemo(
    () =>
      bookings.filter(
        (b) => activeOutletId === "ALL" || !b.outletId || b.outletId === activeOutletId
      ),
    [bookings, activeOutletId]
  );

  const displayedBookings = useMemo(
    () =>
      filterCoworkingBookings(
        outletBookings,
        bookingStatusFilter,
        bookingSearchQuery,
        bookingDateFilter
      ),
    [outletBookings, bookingStatusFilter, bookingSearchQuery, bookingDateFilter]
  );

  const displayedMembers = useMemo(
    () => filterCoworkingMembers(members, memberStatusFilter, searchMemberQuery),
    [members, memberStatusFilter, searchMemberQuery]
  );

  const kpis = calculateCoworkingKPIs(spaces, members);
  const canManageSettings =
    user?.role?.slug === "OWNER" ||
    user?.role?.slug === "SUPER_ADMIN" ||
    user?.role?.slug === "MANAGER";

  const outletScopeName = activeOutlet?.name || "Semua Gerai";

  const handleExportCSV = () => {
    const { filename, headers, rows } = buildCoworkingExportData(
      activeTab === "MEMBERS" ? "MEMBERS" : "BOOKINGS",
      displayedBookings,
      displayedMembers,
      outletScopeName
    );
    downloadCSV(`${filename}_${Date.now()}`, headers, rows);
    notify.success(`Data ${activeTab === "MEMBERS" ? "member" : "booking"} diekspor ke CSV`);
  };

  const handleExportExcel = () => {
    const { filename, sheet, headers, rows } = buildCoworkingExportData(
      activeTab === "MEMBERS" ? "MEMBERS" : "BOOKINGS",
      displayedBookings,
      displayedMembers,
      outletScopeName
    );
    downloadExcel(`${filename}_${Date.now()}`, sheet, headers, rows);
    notify.success(`Data ${activeTab === "MEMBERS" ? "member" : "booking"} diekspor ke Excel`);
  };

  const creditCoworkingPayment = (booking: CoworkingBooking) => {
    const method = (booking.paymentMethod || "QRIS").toUpperCase();
    const cashAmount = method === "CASH" ? booking.totalAmount : 0;
    const nonCashAmount = method !== "CASH" ? booking.totalAmount : 0;
    const targetOutletId = booking.outletId || (activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr");

    if (booking.totalAmount > 0) {
      recordShiftTransaction(cashAmount, nonCashAmount, targetOutletId, `cw-${booking.id}`);
    }

    const normPhone = normalizeLoyaltyPhone(booking.guestPhone || "");
    const cleanEmail = booking.guestEmail?.trim().toLowerCase();
    const cleanName = booking.guestName.trim().toLowerCase();

    const matchedMember = loyaltyMembers.find((m) => {
      if (normPhone && normalizeLoyaltyPhone(m.phone) === normPhone) return true;
      if (cleanEmail && cleanEmail !== "-" && m.email?.trim().toLowerCase() === cleanEmail) return true;
      return Boolean(cleanName) && m.name.trim().toLowerCase() === cleanName;
    });

    if (matchedMember && booking.totalAmount > 0) {
      const earnedPoints = Math.floor(booking.totalAmount / 1000);
      if (earnedPoints > 0) {
        addPoints(
          matchedMember.id,
          earnedPoints,
          `Booking Coworking #${booking.bookingCode}`,
          booking.id,
          booking.totalAmount
        );
      }
    }
  };

  const handleCreateBooking = (bookingData: {
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    company?: string;
    space: any;
    bookingType: "HOURLY" | "DAILY" | "MONTHLY";
    date: string;
    endDate?: string;
    startTime: string;
    endTime?: string;
    duration: number;
    totalAmount: number;
    isImmediateCheckIn: boolean;
    paymentMethod: string;
  }) => {
    const isQris = bookingData.paymentMethod === "QRIS";
    const nowIso = new Date().toISOString();
    const targetOutletId = activeOutletId !== "ALL" ? activeOutletId : "outlet-sgr";
    const createdBooking = bookSpace({
      guestName: bookingData.guestName,
      guestPhone: bookingData.guestPhone,
      guestEmail: bookingData.guestEmail || "-",
      company: bookingData.company,
      spaceId: bookingData.space.id,
      spaceName: bookingData.space.name,
      spaceType: bookingData.space.type,
      bookingType: bookingData.bookingType,
      date: bookingData.date,
      endDate: bookingData.endDate,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      duration: bookingData.duration,
      price: bookingData.totalAmount,
      discount: 0,
      tax: 0,
      taxType: "NON_TAX",
      taxRatePercent: 0,
      outletId: targetOutletId,
      createdAt: nowIso,
      totalAmount: bookingData.totalAmount,
      paidAmount: isQris ? 0 : bookingData.totalAmount,
      remainingAmount: isQris ? bookingData.totalAmount : 0,
      paymentStatus: isQris ? "PENDING" : "PAID",
      paymentMethod: bookingData.paymentMethod,
      paymentRef: isQris ? undefined : `PAY-CWK-${Date.now().toString().slice(-6)}`,
      paymentTimestamp: isQris ? undefined : nowIso,
      checkInStatus: !isQris && bookingData.isImmediateCheckIn ? "CHECKED_IN" : "RESERVED",
    });

    if (isQris) {
      setSelectedQrisBooking(createdBooking);
      setIsQrisModalOpen(true);
      notify.warning(
        "Menunggu konfirmasi QRIS",
        `Booking ${createdBooking.bookingCode} dibuat. Tampilkan QRIS statis dan minta otorisasi supervisor.`
      );
    } else {
      creditCoworkingPayment(createdBooking);
      notify.success("Booking dibuat", bookingData.guestName);
    }
  };

  const handleCreateMember = (params: {
    name: string;
    contact: string;
    email: string;
    packageName: string;
    totalSpent: number;
    paymentMethod: string;
  }) => {
    const today = new Date();
    const expiry = new Date();
    expiry.setDate(today.getDate() + 30);

    const startStr = today.toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const expStr = expiry.toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    addMember(
      {
        name: params.name,
        contact: params.contact,
        email: params.email,
        packageName: params.packageName,
        startDate: startStr,
        expiryDate: expStr,
        status: "ACTIVE",
        totalSpent: params.totalSpent,
      },
      {
        amount: params.totalSpent,
        paymentMethod: params.paymentMethod,
      }
    );

    notify.success(`${params.name} terdaftar sebagai member`);
  };

  const handleCheckoutSpace = (spaceId: string) => {
    checkoutSpace(spaceId);
    notify.success("Check-out selesai", "Ruang kembali tersedia.");
  };

  const handleCheckInBooking = (bookingId: string) => {
    checkInBooking(bookingId);
    notify.success("Tamu sudah check-in");
  };

  const handleOpenReceipt = (b: CoworkingBooking) => {
    const [rawH = "09", rawM = "00"] = (b.startTime || "09:00").split(":");
    const startH = Number.parseInt(rawH, 10) || 9;
    const startM = Number.parseInt(rawM, 10) || 0;
    const endH = (startH + (b.duration || 1)) % 24;
    const computedEndTime = `${endH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`;
    const endTime = b.endTime ? b.endTime.replace(/\s*WITA$/i, "").trim() : computedEndTime;
    const cwPublisher = resolveCoworkingReceiptPublisher(activeOutlet);
    const storedTax = b.tax ?? 0;

    setSelectedBookingForReceipt({
      bookingCode: b.bookingCode || b.id,
      transactionDate: `${b.date}, ${b.startTime || "09:00"} WITA`,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
      guestEmail: b.guestEmail,
      company: b.company,
      spaceName: b.spaceName,
      spaceType: b.spaceType,
      outletName: cwPublisher.outletName,
      outletAddress: cwPublisher.outletAddress,
      outletPhone: cwPublisher.outletPhone,
      bookingDate: b.date,
      endDate: b.endDate,
      startTime: b.startTime,
      endTime,
      duration: b.duration,
      bookingType: b.bookingType || "HOURLY",
      basePrice: b.price ?? b.totalAmount,
      discount: b.discount && b.discount > 0 ? b.discount : undefined,
      promoTitle: b.promoTitle,
      tax: storedTax,
      taxType: b.taxType ?? (storedTax > 0 ? "PPN" : "NON_TAX"),
      taxRatePercent: b.taxRatePercent ?? 0,
      totalAmount: b.totalAmount,
      paymentMethod: b.paymentMethod || "QRIS",
      paymentStatus: b.paymentStatus || "PAID",
      notes: b.notes,
    });
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <CoworkingToolbar
        outletName={activeOutlet?.name || "Singaraja Hub"}
        totalSpaces={kpis.totalSpaces}
        availableSpaces={kpis.availableSpaces}
        occupiedSpaces={kpis.occupiedSpaces}
        activeMembers={kpis.activeMembers}
        canManageSettings={canManageSettings}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onOpenPDF={() => setIsPDFModalOpen(true)}
        onOpenNewMemberModal={() => setIsNewMemberModalOpen(true)}
        onOpenNewBookingModal={() => {
          setSelectedSpaceIdForBooking(undefined);
          setIsNewBookingModalOpen(true);
        }}
      />

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "SPACES" | "BOOKINGS" | "MEMBERS" | "LOGS")}
        className="space-y-4"
      >
        <TabsList aria-label="Navigasi modul co-working">
          <TabsTrigger value="SPACES">
            <Laptop />
            <span>Ruang dan meja</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {spaces.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="BOOKINGS">
            <Calendar />
            <span>Booking</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {bookings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="MEMBERS">
            <Users />
            <span>Member</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {members.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="LOGS">
            <History />
            <span>Log check-in</span>
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {checkLogs.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="SPACES">
          <CoworkingSpacesTab
            spaces={spaces}
            onBookSpace={(spaceId) => {
              setSelectedSpaceIdForBooking(spaceId);
              setIsNewBookingModalOpen(true);
            }}
            onCheckout={handleCheckoutSpace}
          />
        </TabsContent>

        <TabsContent value="BOOKINGS">
          <CoworkingBookingsTab
            bookings={outletBookings}
            searchQuery={bookingSearchQuery}
            onSearchChange={setBookingSearchQuery}
            statusFilter={bookingStatusFilter}
            onStatusFilterChange={setBookingStatusFilter}
            dateFilter={bookingDateFilter}
            onDateFilterChange={setBookingDateFilter}
            onOpenReceipt={handleOpenReceipt}
            onCheckIn={handleCheckInBooking}
            onCheckout={handleCheckoutSpace}
            onConfirmQris={(booking) => {
              setSelectedQrisBooking(booking);
              setIsQrisModalOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="MEMBERS">
          <CoworkingMembersTab
            members={members}
            searchQuery={searchMemberQuery}
            onSearchChange={setSearchMemberQuery}
            statusFilter={memberStatusFilter}
            onStatusFilterChange={setMemberStatusFilter}
          />
        </TabsContent>

        <TabsContent value="LOGS">
          <CoworkingLogsTab logs={checkLogs} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NewBookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        spaces={spaces}
        bookings={bookings}
        defaultSpaceId={selectedSpaceIdForBooking}
        onSubmit={handleCreateBooking}
        coworkingHolidays={settings.coworkingHolidays}
      />

      <NewMemberModal
        isOpen={isNewMemberModalOpen}
        onClose={() => setIsNewMemberModalOpen(false)}
        onSubmit={handleCreateMember}
      />

      {isReceiptModalOpen && selectedBookingForReceipt && (
        <CoworkingReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          receiptData={selectedBookingForReceipt}
        />
      )}

      {isPDFModalOpen && (
        <CoworkingReportPDFModal
          isOpen={isPDFModalOpen}
          onClose={() => setIsPDFModalOpen(false)}
          bookings={displayedBookings}
          spaces={spaces}
          members={displayedMembers}
          outletName={activeOutlet?.name || "Semua Gerai"}
        />
      )}

      {/* QRIS Supervisor Confirmation Modal (Task V-05) */}
      <CoworkingQrisModal
        isOpen={isQrisModalOpen}
        onClose={() => {
          setIsQrisModalOpen(false);
          setSelectedQrisBooking(null);
        }}
        booking={selectedQrisBooking}
        onSuccess={(verifiedBooking) => {
          creditCoworkingPayment(verifiedBooking);
          setIsQrisModalOpen(false);
          setSelectedQrisBooking(null);
          notify.success("Pembayaran QRIS disetujui", verifiedBooking.bookingCode);
        }}
      />
    </div>
  );
}
