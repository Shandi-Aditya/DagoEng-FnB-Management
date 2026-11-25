"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { notify } from "@/components/app/notify";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useInventory } from "@/contexts/InventoryContext";
import { normalizeLoyaltyPhone, useLoyalty } from "@/contexts/LoyaltyContext";
import {
  resolvePostPaymentOrderStatus,
  useOrders,
} from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { usePrinter } from "@/contexts/PrinterContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTables } from "@/contexts/TableContext";
import { CorporateInvoicePDFModal } from "@/features/pos/CorporateInvoicePDFModal";
import { KitchenOrderReceiptModal } from "@/features/pos/KitchenOrderReceiptModal";
import { PaymentModal } from "@/features/pos/PaymentModal";
import { PosOpenShiftModal } from "@/features/pos/PosOpenShiftModal";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import type { POSCartItem, POSPaymentMethod, POSReceiptData, SplitGuestBill } from "@/features/pos/types";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import type { QRISVerificationDetail } from "@/lib/qris-verification";
import { getOrderTaxBreakdown, normalizeTenantId } from "@/lib/tax-breakdown";
import { getTenantName, getTenantStatus } from "@/lib/tenant";
import { formatCurrencyIDR } from "@/lib/utils";
import type { OrderRecord } from "@/types/order";
import type { KitchenTicketData, PrintPurpose } from "@/types/printer";

import { OrderDetailSheet } from "@/features/orders/OrderDetailSheet";
import { countByQueue, emptyQueueMessage, ordersInQueue, searchOrders, type OrderQueueId } from "@/features/orders/orders-queue";
import {
  buildOrderExportData,
  buildOrderReceiptData,
  buildReprintKitchenTicket,
  filterOrdersByTenant,
  isOrderBeforeCooking,
  paymentMethodLabel,
  toOrderBomItems,
} from "@/features/orders/orders-domain";
import { OrdersReportPDFModal } from "@/features/orders/OrdersReportPDFModal";
import { OrdersTable } from "@/features/orders/OrdersTable";
import { OrdersToolbar } from "@/features/orders/OrdersToolbar";
import { RefundOrderModal } from "@/features/orders/RefundOrderModal";

export default function OrdersPage() {
  const { user } = useAuth();
  const { startDate, endDate } = useDateFilter();
  const { activeOutletId, activeOutlet } = useOutlet();
  const { filteredOrders, advanceOrderStatus, refundOrder, voidOrder } = useOrders();
  const { recordOrderWasteBOM } = useInventory();
  const { members, addPoints, reverseTransactionPoints, refreshMembers } = useLoyalty();
  const { releaseTableToAvailable } = useTables();
  const { logActivity } = useActivityLog();
  const { settings } = useSettings();
  const { activeShift, openShift, recordShiftTransaction, recordShiftRefund } = useEmployeeShift();
  const { canReceiveCashierReceipt, canReceiveKitchenReceipt } = usePrinter();
  const { bookings: cwBookings, confirmBookingPayment, cancelBooking } = useCoworking();

  const isTenantOwner = user?.scopeLevel === "TENANT" && !!user?.tenant?.id;
  const userTenantId = user?.tenant?.id;

  const roleSlug = user?.role?.slug || (typeof user?.role === "string" ? user.role : "");
  const isKitchenStaff = roleSlug === "KITCHEN_STAFF";
  const isSupervisor =
    roleSlug === "SUPER_ADMIN" ||
    roleSlug === "OWNER" ||
    roleSlug === "MANAGER";
  const isHubSupervisor = isSupervisor && !isTenantOwner;
  const isTenantScoped = isTenantOwner || (isKitchenStaff && !!userTenantId);
  const canExportNominalReports =
    isSupervisor ||
    (user?.scopeLevel === "TENANT" && !!user?.tenant?.id);
  const canViewNominals = !isKitchenStaff;
  const canProcessPayment =
    roleSlug === "CASHIER" ||
    isSupervisor;
  const canVoidOrRefund = isSupervisor || roleSlug === "CASHIER";
  const requiresPinForVoidRefund = roleSlug === "CASHIER" || isTenantOwner;
  const canPrintCashierReceipt = canReceiveCashierReceipt(roleSlug);
  const canPrintKitchenReceipt = canReceiveKitchenReceipt(roleSlug);

  // Strict tenant-aware order list
  const displayedOrders = useMemo(() => {
    return filterOrdersByTenant(filteredOrders, userTenantId, isTenantScoped);
  }, [filteredOrders, userTenantId, isTenantScoped]);

  // Cashiers land on what needs action; everyone else on the full list
  const [orderQueue, setOrderQueue] = useState<OrderQueueId>("ALL");
  const [hasChosenQueue, setHasChosenQueue] = useState(false);
  // The signed-in role loads after the first render; pick the default queue once it is known
  useEffect(() => {
    if (!hasChosenQueue && canProcessPayment) setOrderQueue("UNPAID");
  }, [canProcessPayment, hasChosenQueue]);
  const handleQueueChange = (next: OrderQueueId) => {
    setHasChosenQueue(true);
    setOrderQueue(next);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const queueCounts = useMemo(() => countByQueue(displayedOrders), [displayedOrders]);
  const visibleOrders = useMemo(
    () => searchOrders(ordersInQueue(displayedOrders, orderQueue), searchQuery),
    [displayedOrders, orderQueue, searchQuery],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [orderQueue, searchQuery, startDate, endDate, activeOutletId, pageSize]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleOrders.slice(start, start + pageSize);
  }, [visibleOrders, currentPage, pageSize]);

  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OrderRecord | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState<boolean>(false);
  const [receiptModalOrder, setReceiptModalOrder] = useState<POSReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<OrderRecord | null>(null);
  const [kitchenModalTicket, setKitchenModalTicket] = useState<KitchenTicketData | null>(null);
  const [isKitchenModalOpen, setIsKitchenModalOpen] = useState<boolean>(false);
  const [refundOrderTarget, setRefundOrderTarget] = useState<OrderRecord | null>(null);
  const [refundModalMode, setRefundModalMode] = useState<"REFUND" | "VOID">("REFUND");
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [pendingShiftOrder, setPendingShiftOrder] = useState<OrderRecord | null>(null);
  const [shiftNameInput, setShiftNameInput] = useState("Shift Pagi");
  const [openingCashInput, setOpeningCashInput] = useState<number | "">(200000);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const paymentSubmittingRef = useRef(false);
  const refundSubmittingRef = useRef(false);

  const handleExportOrdersCSV = () => {
    if (!canExportNominalReports) return;
    const { headers, rows } = buildOrderExportData(visibleOrders, settings.promos);
    downloadCSV(`Daftar_Pesanan_Transaksi_${Date.now()}`, headers, rows);
  };

  const handleExportOrdersExcel = () => {
    if (!canExportNominalReports) return;
    const { headers, rows } = buildOrderExportData(visibleOrders, settings.promos);
    downloadExcel(`Daftar_Pesanan_Transaksi_${Date.now()}`, "Riwayat Pesanan", headers, rows);
  };

  const findSuspendedOrInactiveTenantForOrder = (order: OrderRecord): string | null => {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (item.itemType === "COWORKING") continue;
      const tid = normalizeTenantId(item.tenantId || order.tenantId || "tenant-ks") || "tenant-ks";
      const status = getTenantStatus(tid);
      if (status === "SUSPENDED" || status === "INACTIVE") {
        return getTenantName(tid) || tid;
      }
    }
    return null;
  };

  const handleOpenPayment = (order: OrderRecord) => {
    if (order.paymentStatus === "PAID") {
      notify.warning("Pesanan sudah lunas");
      return;
    }
    const blockedTenantName = findSuspendedOrInactiveTenantForOrder(order);
    if (blockedTenantName) {
      notify.error(
        "Mitra ditangguhkan",
        `Pembayaran untuk gerai ${blockedTenantName} ditolak karena status mitra sedang ditangguhkan atau nonaktif.`
      );
      return;
    }
    if (!canProcessPayment) {
      notify.error("Tidak bisa memproses pembayaran", "Peran Anda tidak punya akses kasir.");
      return;
    }
    if (!activeShift) {
      notify.warning(
        "Shift kasir belum dibuka",
        "Buka shift dengan modal awal sebelum menerima pembayaran."
      );
      setPendingShiftOrder(order);
      setIsOpenShiftModalOpen(true);
      return;
    }
    setPaymentOrder(order);
    setIsPaymentModalOpen(true);
  };

  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpeningShift) return;
    setIsOpeningShift(true);
    try {
      openShift(shiftNameInput, Number(openingCashInput) || 0, user?.name);
      notify.success("Shift kasir dibuka", `${shiftNameInput} siap menerima pembayaran.`);
      setIsOpenShiftModalOpen(false);
      if (pendingShiftOrder && pendingShiftOrder.paymentStatus !== "PAID") {
        setPaymentOrder(pendingShiftOrder);
        setIsPaymentModalOpen(true);
      }
      setPendingShiftOrder(null);
    } catch (err) {
      notify.error(
        "Gagal membuka shift",
        err instanceof Error ? err.message : "Periksa nominal modal awal kasir."
      );
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handlePaymentSuccess = async (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
    paymentReference?: string;
    splitDetails?: SplitGuestBill[];
    qrisVerification?: QRISVerificationDetail;
  }) => {
    if (!paymentOrder || paymentSubmittingRef.current) return;
    const blockedTenantName = findSuspendedOrInactiveTenantForOrder(paymentOrder);
    if (blockedTenantName) {
      setIsPaymentModalOpen(false);
      notify.error(
        "Mitra ditangguhkan",
        `Pembayaran untuk gerai ${blockedTenantName} ditolak karena status mitra sedang ditangguhkan atau nonaktif.`
      );
      return;
    }
    if (!activeShift) {
      setIsPaymentModalOpen(false);
      notify.warning(
        "Shift kasir belum dibuka",
        "Buka shift dengan modal awal sebelum menerima pembayaran."
      );
      setPendingShiftOrder(paymentOrder);
      setIsOpenShiftModalOpen(true);
      return;
    }

    paymentSubmittingRef.current = true;
    try {
      const chosenMethod = paymentData.method;
      const pBreakdown = getOrderTaxBreakdown(paymentOrder);
      const mappedSplitDetails = paymentData.splitDetails?.map((guest, idx) => ({
        guestNumber: idx + 1,
        label: guest.guestLabel,
        amount: guest.assignedAmount,
        method: guest.paymentMethod,
      }));

      const nextStatus = resolvePostPaymentOrderStatus(paymentOrder.status);

      const syncRes = await advanceOrderStatus(
        paymentOrder.id,
        nextStatus,
        `Pembayaran lunas via ${paymentData.method} (${formatCurrencyIDR(paymentOrder.total)})`,
        {
          paymentStatus: "PAID",
          paymentMethod: chosenMethod,
          paymentReference:
            paymentData.paymentReference || paymentData.qrisVerification?.referenceNumber,
          qrisVerification: paymentData.qrisVerification,
          splitDetails: mappedSplitDetails,
          cashierName: user?.name,
          tax: paymentOrder.tax ?? pBreakdown.pb1,
          serviceCharge: paymentOrder.serviceCharge ?? pBreakdown.serviceCharge,
        }
      );

      if (syncRes.rejected) {
        notify.error(
          "Pembayaran ditolak server",
          syncRes.error || "Pembayaran tidak dapat diselesaikan."
        );
        setIsPaymentModalOpen(false);
        return;
      }

      const cashPortion =
        paymentData.method === "SPLIT"
          ? (paymentData.splitDetails || [])
              .filter((guest) => guest.paymentMethod === "CASH")
              .reduce((sum, guest) => sum + guest.assignedAmount, 0)
          : paymentData.method === "CASH"
            ? paymentOrder.total
            : 0;
      recordShiftTransaction(cashPortion, paymentOrder.total - cashPortion, paymentOrder.outletId, paymentOrder.id);

      if (paymentOrder.corporateInfo?.linkedBookingCode) {
        const matchingBooking = cwBookings.find(
          (b) => b.bookingCode === paymentOrder.corporateInfo?.linkedBookingCode
        );
        if (matchingBooking) {
          confirmBookingPayment(matchingBooking.id, chosenMethod);
        }
      }

      const orderNormPhone = paymentOrder.customerPhone
        ? normalizeLoyaltyPhone(paymentOrder.customerPhone)
        : "";
      const matchingMember =
        (orderNormPhone
          ? members.find((m) => normalizeLoyaltyPhone(m.phone) === orderNormPhone)
          : undefined) ??
        members.find(
          (m) => m.name.toLowerCase().trim() === paymentOrder.customerName.toLowerCase().trim()
        );
      let pointsAdded = 0;
      const alreadyEarnedForOrder = matchingMember
        ? matchingMember.pointHistory.some(
            (h) => h.type === "EARN" && h.relatedTransactionId === paymentOrder.id
          )
        : false;
      if (matchingMember && !alreadyEarnedForOrder) {
        pointsAdded = Math.floor(paymentOrder.total / 1000);
        addPoints(
          matchingMember.id,
          pointsAdded,
          `Penyelesaian Pesanan #${paymentOrder.orderNumber}`,
          paymentOrder.id,
          paymentOrder.total
        );
      }

      if (
        nextStatus === "COMPLETED" &&
        paymentOrder.orderType === "DINE_IN" &&
        paymentOrder.tableNumber &&
        paymentOrder.tableNumber !== "TAKEAWAY"
      ) {
        releaseTableToAvailable(paymentOrder.tableNumber);
      }

      logActivity({
        module: "POS",
        action: "ORDER_PAYMENT_AND_COMPLETED",
        recordId: paymentOrder.orderNumber,
        previousValue: `Status: ${paymentOrder.status} (${paymentOrder.paymentStatus})`,
        newValue: `Status: ${nextStatus} (PAID via ${paymentData.method})`,
        description:
          nextStatus === "COMPLETED"
            ? `Pesanan ${paymentOrder.orderNumber} (Meja ${paymentOrder.tableNumber}, ${paymentOrder.customerName}) lunas & diselesaikan`
            : `Pesanan ${paymentOrder.orderNumber} (Meja ${paymentOrder.tableNumber}, ${paymentOrder.customerName}) lunas & masuk antrean dapur`,
        reason: `Pembayaran kasir selesai via ${paymentData.method}`,
        status: "SUCCESS",
        outletId: paymentOrder.outletId,
        outletName: paymentOrder.outletName,
      });

      const memberMsg = matchingMember
        ? pointsAdded > 0
          ? ` · ${matchingMember.name} +${pointsAdded} poin`
          : ` · ${matchingMember.name}`
        : "";
      notify.success(
        `Pesanan ${paymentOrder.orderNumber} dibayar`,
        `${paymentMethodLabel(paymentData.method as OrderRecord["paymentMethod"])}${memberMsg}`
      );
      setIsPaymentModalOpen(false);

      if (selectedOrder?.id === paymentOrder.id) {
        const resolvedOrder = syncRes.order ?? {
          ...paymentOrder,
          status: nextStatus,
          paymentStatus: "PAID" as const,
          paymentMethod: chosenMethod,
          paymentReference:
            paymentData.paymentReference ||
            paymentData.qrisVerification?.referenceNumber ||
            paymentOrder.paymentReference,
          qrisVerification: paymentData.qrisVerification ?? paymentOrder.qrisVerification,
          splitDetails: mappedSplitDetails ?? paymentOrder.splitDetails,
          cashierName: user?.name || paymentOrder.cashierName,
        };
        setSelectedOrder(resolvedOrder);
      }
    } finally {
      paymentSubmittingRef.current = false;
    }
  };

  const modalCartItems: POSCartItem[] = paymentOrder
    ? paymentOrder.items.map((it, idx) => ({
        cartItemId: it.id || `ord-it-${idx}`,
        productId: it.productId || it.id || `prod-${idx}`,
        productName: it.productName,
        quantity: it.quantity,
        basePrice: it.unitPrice,
        unitFinalPrice: it.unitPrice,
        itemTotal: it.unitPrice * it.quantity,
        selectedModifiers: it.modifiers?.map((m) => ({ name: m, price: 0 })) || [],
        notes: it.notes,
      }))
    : [];

  const handlePrintReceipt = (order: OrderRecord) => {
    if (!canPrintCashierReceipt) {
      notify.error(
        "Akses struk kasir dibatasi",
        "Peran Anda tidak diizinkan mencetak struk pelanggan."
      );
      return;
    }
    setReceiptModalOrder(buildOrderReceiptData(order));
    setIsReceiptModalOpen(true);
  };

  const handlePrintKitchenTicket = (order: OrderRecord, purpose: PrintPurpose) => {
    if (!canPrintKitchenReceipt) {
      notify.error(
        "Akses nota dapur dibatasi",
        "Peran Anda tidak diizinkan mencetak nota dapur."
      );
      return;
    }
    setKitchenModalTicket(
      buildReprintKitchenTicket(
        order,
        purpose,
        user?.name,
        isTenantScoped ? userTenantId : undefined
      )
    );
    setIsKitchenModalOpen(true);
  };

  const handleOpenRefund = (order: OrderRecord) => {
    if (!canVoidOrRefund) {
      notify.error("Akses ditolak", "Peran Anda tidak diizinkan melakukan refund pesanan.");
      return;
    }
    if (order.paymentStatus !== "PAID") {
      notify.warning("Hanya pesanan yang sudah lunas yang dapat di-refund");
      return;
    }
    setRefundModalMode("REFUND");
    setRefundOrderTarget(order);
    setIsRefundModalOpen(true);
  };

  const handleOpenVoid = (order: OrderRecord) => {
    if (!canVoidOrRefund) {
      notify.error("Akses ditolak", "Peran Anda tidak diizinkan membatalkan pesanan.");
      return;
    }
    if (order.paymentStatus === "PAID") {
      notify.warning("Pesanan sudah lunas", "Gunakan aksi refund untuk membatalkan pesanan lunas.");
      return;
    }
    if (order.status === "CANCELLED") {
      notify.warning("Pesanan sudah dibatalkan");
      return;
    }
    setRefundModalMode("VOID");
    setRefundOrderTarget(order);
    setIsRefundModalOpen(true);
  };

  const handleConfirmRefund = async (params: {
    reason: string;
    supervisorName: string;
    supervisorRole?: string;
    supervisorPin?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!refundOrderTarget) return { ok: false, error: "Pesanan tidak ditemukan." };
    if (refundSubmittingRef.current) {
      return { ok: false, error: "Permintaan refund/pembatalan sedang diproses." };
    }

    refundSubmittingRef.current = true;
    try {
      const isVoid = refundModalMode === "VOID";
      const syncRes = isVoid
        ? await voidOrder(refundOrderTarget.id, {
            reason: params.reason,
            supervisorName: params.supervisorName,
            supervisorRole: params.supervisorRole,
            supervisorPin: params.supervisorPin,
          })
        : await refundOrder(refundOrderTarget.id, {
            reason: params.reason,
            supervisorName: params.supervisorName,
            supervisorRole: params.supervisorRole,
            supervisorPin: params.supervisorPin,
            refundMethod: "CASH",
          });

      if (syncRes.rejected) {
        const errorMessage =
          syncRes.error ||
          (isVoid
            ? "Otorisasi pembatalan pesanan ditolak oleh server."
            : "Otorisasi refund pesanan ditolak oleh server.");
        notify.error(
          isVoid ? "Pembatalan pesanan ditolak" : "Refund pesanan ditolak",
          errorMessage
        );
        return { ok: false, error: errorMessage };
      }

      const resolvedOrder = syncRes.order ?? refundOrderTarget;

      if (!isVoid) {
        recordShiftRefund(
          resolvedOrder.total,
          resolvedOrder.id,
          resolvedOrder.outletId
        );
      }
      if (refundOrderTarget.corporateInfo?.linkedBookingCode) {
        const matchingBooking = cwBookings.find(
          (b) => b.bookingCode === refundOrderTarget.corporateInfo?.linkedBookingCode
        );
        cancelBooking(matchingBooking?.id || refundOrderTarget.corporateInfo.linkedBookingCode);
      }

      const isPostCook =
        !isOrderBeforeCooking(refundOrderTarget) || !isOrderBeforeCooking(resolvedOrder);
      if (isPostCook) {
        recordOrderWasteBOM(
          toOrderBomItems(resolvedOrder.items),
          refundOrderTarget.paymentStatus !== "PAID" && !resolvedOrder.bomDeducted,
          resolvedOrder.orderNumber
        );
      }

      if (syncRes.synced) {
        void refreshMembers();
      } else {
        const targetNormPhone =
          resolvedOrder.customerPhone && !resolvedOrder.customerPhone.includes("*")
            ? normalizeLoyaltyPhone(resolvedOrder.customerPhone)
            : "";
        const matchingMember =
          (resolvedOrder.loyaltyMemberId
            ? members.find((m) => m.id === resolvedOrder.loyaltyMemberId)
            : undefined) ??
          (targetNormPhone
            ? members.find((m) => normalizeLoyaltyPhone(m.phone) === targetNormPhone)
            : undefined) ??
          members.find(
            (m) => m.name.toLowerCase().trim() === resolvedOrder.customerName.toLowerCase().trim()
          );
        if (!resolvedOrder.loyaltyPointsReversed && matchingMember) {
          reverseTransactionPoints(
            matchingMember.id,
            resolvedOrder.id,
            `${isVoid ? "Pembatalan" : "Refund"} pesanan #${resolvedOrder.orderNumber}: ${params.reason}`,
            !isVoid ? resolvedOrder.total : 0
          );
        }
      }

      if (
        resolvedOrder.orderType === "DINE_IN" &&
        resolvedOrder.tableNumber &&
        resolvedOrder.tableNumber !== "TAKEAWAY"
      ) {
        releaseTableToAvailable(resolvedOrder.tableNumber);
      }

      notify.success(
        isVoid
          ? `Pesanan ${resolvedOrder.orderNumber} dibatalkan`
          : `Pesanan ${resolvedOrder.orderNumber} di-refund`,
        isVoid
          ? `Alasan: ${params.reason}`
          : `Uang tunai ${formatCurrencyIDR(resolvedOrder.total)} dikembalikan ke pelanggan`
      );

      if (selectedOrder?.id === refundOrderTarget.id) {
        setSelectedOrder(resolvedOrder);
      }

      setIsRefundModalOpen(false);
      setRefundOrderTarget(null);
      return { ok: true };
    } finally {
      refundSubmittingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <OrdersToolbar
        queue={orderQueue}
        onQueueChange={handleQueueChange}
        counts={queueCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onResetFilters={() => setSearchQuery("")}
        canExport={canExportNominalReports}
        onExportExcel={handleExportOrdersExcel}
        onExportCSV={handleExportOrdersCSV}
        onOpenPDF={() => setIsPDFModalOpen(true)}
      />

      <OrdersTable
        orders={paginatedOrders}
        totalOrders={visibleOrders.length}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        emptyMessage={emptyQueueMessage(orderQueue, searchQuery.trim() !== "")}
        canViewNominals={canViewNominals}
        canProcessPayment={canProcessPayment}
        onViewInvoice={(order) => setInvoiceModalOrder(order)}
        onOpenPayment={handleOpenPayment}
        onOpenRefund={canVoidOrRefund ? handleOpenRefund : undefined}
        onSelectOrder={setSelectedOrder}
      />

      <OrderDetailSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        canViewNominals={canViewNominals}
        canProcessPayment={canProcessPayment}
        canPrintCashierReceipt={canPrintCashierReceipt}
        canPrintKitchenReceipt={canPrintKitchenReceipt}
        promos={settings.promos}
        onViewInvoice={(order) => setInvoiceModalOrder(order)}
        onOpenPayment={handleOpenPayment}
        onPrintReceipt={handlePrintReceipt}
        onPrintKitchenTicket={handlePrintKitchenTicket}
        onOpenRefund={canVoidOrRefund ? handleOpenRefund : undefined}
        onOpenVoid={canVoidOrRefund ? handleOpenVoid : undefined}
      />

      <PosOpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => {
          setIsOpenShiftModalOpen(false);
          setPendingShiftOrder(null);
        }}
        isSubmitting={isOpeningShift}
        shiftName={shiftNameInput}
        onShiftNameChange={setShiftNameInput}
        openingCash={openingCashInput}
        onOpeningCashChange={setOpeningCashInput}
        onSubmit={handleOpenShiftSubmit}
      />

      {/* POS Payment Modal Integration */}
      {paymentOrder && (() => {
        const pBreakdown = getOrderTaxBreakdown(paymentOrder);
        return (
          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            cartItems={modalCartItems}
            subtotal={pBreakdown.subtotal}
            tax={pBreakdown.pb1}
            serviceCharge={pBreakdown.serviceCharge}
            discount={pBreakdown.discount}
            grandTotal={pBreakdown.total}
            tableNumber={paymentOrder.tableNumber}
            customerName={paymentOrder.customerName}
            orderType={paymentOrder.orderType === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN"}
            isSettlement
            onPaymentSuccess={handlePaymentSuccess}
          />
        );
      })()}

      <RefundOrderModal
        isOpen={isRefundModalOpen}
        onClose={() => {
          setIsRefundModalOpen(false);
          setRefundOrderTarget(null);
        }}
        order={refundOrderTarget}
        mode={refundModalMode}
        currentUserName={user?.name}
        currentUserRole={roleSlug}
        isSupervisor={isHubSupervisor}
        requiresPin={refundModalMode === "REFUND" ? true : requiresPinForVoidRefund}
        onConfirmRefund={handleConfirmRefund}
      />

      <OrdersReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        orders={visibleOrders}
        outletName={
          visibleOrders[0]?.outletName ||
          displayedOrders[0]?.outletName ||
          activeOutlet?.name ||
          "Singaraja"
        }
      />

      {/* POS Thermal Receipt Modal for Reprinting (Customer) */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        receiptData={receiptModalOrder}
        onClose={() => setIsReceiptModalOpen(false)}
      />

      {/* Corporate Invoice PDF Modal */}
      <CorporateInvoicePDFModal
        isOpen={Boolean(invoiceModalOrder)}
        onClose={() => setInvoiceModalOrder(null)}
        order={invoiceModalOrder}
      />

      {/* Kitchen Order Thermal Ticket Modal for Reprinting (Kitchen) */}
      <KitchenOrderReceiptModal
        isOpen={isKitchenModalOpen}
        ticketData={kitchenModalTicket}
        onClose={() => setIsKitchenModalOpen(false)}
      />
    </div>
  );
}
