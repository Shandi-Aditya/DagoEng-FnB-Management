"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Laptop, Users, Calendar, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useSettings } from "@/contexts/SettingsContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { notify } from "@/components/app/notify";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { resolveCoworkingReceiptPublisher } from "@/lib/receipt-publisher";
import { CoworkingBooking } from "@/types/coworking";
import {
  calculateCoworkingKPIs,
  buildCoworkingExportData,
} from "@/features/coworking/coworking-domain";
import { CoworkingToolbar } from "@/features/coworking/CoworkingToolbar";
import { CoworkingSpacesTab } from "@/features/coworking/CoworkingSpacesTab";
import { CoworkingBookingsTab } from "@/features/coworking/CoworkingBookingsTab";
import { CoworkingMembersTab } from "@/features/coworking/CoworkingMembersTab";
import { CoworkingLogsTab } from "@/features/coworking/CoworkingLogsTab";
import { NewBookingModal } from "@/features/coworking/NewBookingModal";
import { NewMemberModal } from "@/features/coworking/NewMemberModal";
import { CoworkingReportPDFModal } from "@/features/coworking/CoworkingReportPDFModal";
import {
  CoworkingReceiptModal,
  CoworkingReceiptData,
} from "@/features/coworking/CoworkingReceiptModal";
import { cn } from "@/lib/utils";

export default function CoworkingPage() {
  const { user } = useAuth();
  const { activeOutlet } = useOutlet();
  const { settings } = useSettings();
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
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [selectedBookingForReceipt, setSelectedBookingForReceipt] = useState<CoworkingReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Operational Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewMemberModalOpen, setIsNewMemberModalOpen] = useState(false);
  const [selectedSpaceIdForBooking, setSelectedSpaceIdForBooking] = useState<string | undefined>();

  // Cashier redirection
  if (user?.role?.slug === "CASHIER") {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-card border border-border rounded-2xl shadow-xs my-12">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
          <Laptop className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground">Operasional Terintegrasi di POS Kasir</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Untuk staf kasir, seluruh transaksi dan pemesanan co-working dilayani langsung melalui modul <strong className="text-foreground">POS Kasir</strong>.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/pos"
            className={cn(buttonVariants({ size: "sm" }), "px-5 font-semibold text-xs")}
          >
            Buka Modul POS Kasir
          </Link>
        </div>
      </div>
    );
  }

  const kpis = calculateCoworkingKPIs(spaces, members);
  const canManageSettings =
    user?.role?.slug === "OWNER" ||
    user?.role?.slug === "SUPER_ADMIN" ||
    user?.role?.slug === "MANAGER";

  const outletScopeName = activeOutlet?.name || "Semua Gerai";

  const handleExportCSV = () => {
    const { filename, headers, rows } = buildCoworkingExportData(
      activeTab === "MEMBERS" ? "MEMBERS" : "BOOKINGS",
      bookings,
      members,
      outletScopeName
    );
    downloadCSV(`${filename}_${Date.now()}`, headers, rows);
    notify.success("Ekspor CSV berhasil", `Data ${activeTab === "MEMBERS" ? "member" : "booking"} berhasil diunduh.`);
  };

  const handleExportExcel = () => {
    const { filename, sheet, headers, rows } = buildCoworkingExportData(
      activeTab === "MEMBERS" ? "MEMBERS" : "BOOKINGS",
      bookings,
      members,
      outletScopeName
    );
    downloadExcel(`${filename}_${Date.now()}`, sheet, headers, rows);
    notify.success("Ekspor Excel berhasil", `Data ${activeTab === "MEMBERS" ? "member" : "booking"} berhasil diunduh.`);
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
    bookSpace({
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
      totalAmount: bookingData.totalAmount,
      paidAmount: bookingData.totalAmount,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: bookingData.paymentMethod,
      paymentRef: `PAY-CWK-${Date.now().toString().slice(-6)}`,
      paymentTimestamp: new Date().toISOString(),
      checkInStatus: bookingData.isImmediateCheckIn ? "CHECKED_IN" : "RESERVED",
    });

    notify.success("Pemesanan dibuat", `Sesi co-working untuk ${bookingData.guestName} berhasil dicatat.`);
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
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const expStr = expiry.toLocaleDateString("id-ID", {
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

    notify.success("Member didaftarkan", `Member ${params.name} aktif.`);
  };

  const handleCheckoutSpace = (spaceId: string) => {
    checkoutSpace(spaceId);
    notify.success("Check-out selesai", "Ruang atau meja kembali tersedia.");
  };

  const handleCheckInBooking = (bookingId: string) => {
    checkInBooking(bookingId);
    notify.success("Check-in berhasil", "Sesi operasional aktif.");
  };

  const handleOpenReceipt = (b: CoworkingBooking) => {
    const [startH, startM] = (b.startTime || "09:00").split(":").map(Number);
    const endH = (startH + (b.duration || 1)) % 24;
    const endTime = `${endH.toString().padStart(2, "0")}:${(startM || 0).toString().padStart(2, "0")}`;
    const cwPublisher = resolveCoworkingReceiptPublisher(activeOutlet);

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
      basePrice: b.totalAmount,
      tax: 0,
      taxType: "NON_TAX",
      taxRatePercent: 0,
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
        <TabsList>
          <TabsTrigger value="SPACES" className="gap-1.5 text-xs">
            <Laptop className="size-3.5" />
            <span>Ruang dan meja ({spaces.length})</span>
          </TabsTrigger>
          <TabsTrigger value="BOOKINGS" className="gap-1.5 text-xs">
            <Calendar className="size-3.5" />
            <span>Booking ({bookings.length})</span>
          </TabsTrigger>
          <TabsTrigger value="MEMBERS" className="gap-1.5 text-xs">
            <Users className="size-3.5" />
            <span>Member ({members.length})</span>
          </TabsTrigger>
          <TabsTrigger value="LOGS" className="gap-1.5 text-xs">
            <History className="size-3.5" />
            <span>Log check-in ({checkLogs.length})</span>
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
            bookings={bookings}
            onOpenReceipt={handleOpenReceipt}
            onCheckIn={handleCheckInBooking}
            onCheckout={handleCheckoutSpace}
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
          bookings={bookings}
          spaces={spaces}
          members={members}
          outletName={activeOutlet?.name || "Semua Gerai"}
        />
      )}
    </div>
  );
}
