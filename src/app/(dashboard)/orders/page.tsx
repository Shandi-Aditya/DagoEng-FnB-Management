"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { notify } from "@/components/app/notify";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useInventory } from "@/contexts/InventoryContext";
import { normalizeLoyaltyPhone, useLoyalty } from "@/contexts/LoyaltyContext";
import { useOrders } from "@/contexts/OrderContext";
import { usePrinter } from "@/contexts/PrinterContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTables } from "@/contexts/TableContext";
import { KitchenOrderReceiptModal } from "@/features/pos/KitchenOrderReceiptModal";
import { PaymentModal } from "@/features/pos/PaymentModal";
import { PosOpenShiftModal } from "@/features/pos/PosOpenShiftModal";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import type { POSCartItem, POSPaymentMethod, POSReceiptData, SplitGuestBill } from "@/features/pos/types";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import type { QRISVerificationDetail } from "@/lib/qris-verification";
import { getOrderTaxBreakdown } from "@/lib/tax-breakdown";
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
  paymentMethodLabel,
} from "@/features/orders/orders-domain";
import { OrdersReportPDFModal } from "@/features/orders/OrdersReportPDFModal";
import { OrdersTable } from "@/features/orders/OrdersTable";
import { OrdersToolbar } from "@/features/orders/OrdersToolbar";
import { RefundOrderModal } from "@/features/orders/RefundOrderModal";

export default function OrdersPage() {
  const { user } = useAuth();
  const { filteredOrders, advanceOrderStatus, refundOrder, voidOrder } = useOrders();
  const { deductOrderBOM, restoreOrderBOM, recordOrderWasteBOM } = useInventory();
  const { members, addPoints, reverseTransactionPoints } = useLoyalty();
  const { releaseTableToAvailable } = useTables();
  const { logActivity } = useActivityLog();
  const { settings } = useSettings();
  const { activeShift, openShift, recordShiftTransaction, recordShiftRefund } = useEmployeeShift();
  const { canReceiveCashierReceipt, canReceiveKitchenReceipt } = usePrinter();

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
  }, [orderQueue, searchQuery, displayedOrders.length]);

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

  const handleExportOrdersCSV = () => {
    if (!canExportNominalReports) return;
    const { headers, rows } = buildOrderExportData(displayedOrders, settings.promos);
    downloadCSV(`Daftar_Pesanan_Transaksi_${Date.now()}`, headers, rows);
  };

  const handleExportOrdersExcel = () => {
    if (!canExportNominalReports) return;
    const { headers, rows } = buildOrderExportData(displayedOrders, settings.promos);
    downloadExcel(`Daftar_Pesanan_Transaksi_${Date.now()}`, "Riwayat Pesanan", headers, rows);
  };

  const handleOpenPayment = (order: OrderRecord) => {
    if (order.paymentStatus === "PAID") {
      notify.warning("Pesanan sudah lunas");
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

  const handlePaymentSuccess = (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
    splitDetails?: SplitGuestBill[];
    qrisVerification?: QRISVerificationDetail;
  }) => {
    if (!paymentOrder || paymentSubmittingRef.current) return;
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

      advanceOrderStatus(
        paymentOrder.id,
        "COMPLETED",
        `Pembayaran lunas via ${paymentData.method} (${formatCurrencyIDR(paymentOrder.total)})`,
        {
          paymentStatus: "PAID",
          paymentMethod: chosenMethod,
          qrisVerification: paymentData.qrisVerification,
          splitDetails: mappedSplitDetails,
          cashierName: user?.name,
          tax: pBreakdown.pb1,
          serviceCharge: pBreakdown.serviceCharge,
        }
      );

      const cashPortion =
        paymentData.method === "SPLIT"
          ? (paymentData.splitDetails || [])
              .filter((guest) => guest.paymentMethod === "CASH")
              .reduce((sum, guest) => sum + guest.assignedAmount, 0)
          : paymentData.method === "CASH"
            ? paymentOrder.total
            : 0;
      recordShiftTransaction(cashPortion, paymentOrder.total - cashPortion, paymentOrder.outletId, paymentOrder.id);

      const bomItems = paymentOrder.items.map((it) => ({
        productId: it.productId || it.id,
        productName: it.productName,
        quantity: it.quantity,
        modifiers: it.modifiers,
      }));
      deductOrderBOM(bomItems);

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
      if (matchingMember) {
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
        newValue: `Status: COMPLETED (PAID via ${paymentData.method})`,
        description: `Pesanan ${paymentOrder.orderNumber} (Meja ${paymentOrder.tableNumber}, ${paymentOrder.customerName}) lunas & diselesaikan`,
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
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: "COMPLETED",
                paymentStatus: "PAID",
                paymentMethod: chosenMethod,
                qrisVerification: paymentData.qrisVerification ?? prev.qrisVerification,
                splitDetails: mappedSplitDetails ?? prev.splitDetails,
                cashierName: user?.name || prev.cashierName,
              }
            : null
        );
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

    const isVoid = refundModalMode === "VOID";
    const result = isVoid
      ? voidOrder(refundOrderTarget.id, {
          reason: params.reason,
          supervisorName: params.supervisorName,
          supervisorRole: params.supervisorRole,
          supervisorPin: params.supervisorPin,
        })
      : refundOrder(refundOrderTarget.id, {
          reason: params.reason,
          supervisorName: params.supervisorName,
          supervisorRole: params.supervisorRole,
          supervisorPin: params.supervisorPin,
          refundMethod: "CASH",
        });

    if (!result.success) {
      notify.error(isVoid ? "Gagal membatalkan pesanan" : "Gagal melakukan refund", result.error);
      return { ok: false, error: result.error };
    }

    if (result.serverSync) {
      const syncResult = await result.serverSync;
      if (syncResult.rejected) {
        const errorMessage = syncResult.error || "Otorisasi supervisor ditolak oleh server.";
        notify.error(
          isVoid ? "Pembatalan pesanan ditolak" : "Refund pesanan ditolak",
          errorMessage
        );
        return { ok: false, error: errorMessage };
      }
    }

    if (!isVoid) {
      recordShiftRefund(
        refundOrderTarget.total,
        refundOrderTarget.id,
        refundOrderTarget.outletId
      );
    }

    const bomItems = refundOrderTarget.items.map((it) => ({
      productId: it.productId || it.id,
      productName: it.productName,
      quantity: it.quantity,
      modifiers: it.modifiers,
    }));
    const isBeforeCooking =
      !refundOrderTarget.cookingStartedAt &&
      ["NEW", "CONFIRMED", "KITCHEN_RECEIVED"].includes(refundOrderTarget.status);

    if (!isBeforeCooking) {
      recordOrderWasteBOM(
        bomItems,
        refundOrderTarget.paymentStatus !== "PAID",
        refundOrderTarget.orderNumber
      );
    } else if (refundOrderTarget.paymentStatus === "PAID") {
      restoreOrderBOM(bomItems, refundOrderTarget.orderNumber);
    }

    const targetNormPhone = refundOrderTarget.customerPhone
      ? normalizeLoyaltyPhone(refundOrderTarget.customerPhone)
      : "";
    const matchingMember =
      (targetNormPhone
        ? members.find((m) => normalizeLoyaltyPhone(m.phone) === targetNormPhone)
        : undefined) ??
      members.find(
        (m) => m.name.toLowerCase().trim() === refundOrderTarget.customerName.toLowerCase().trim()
      );
    if (matchingMember) {
      reverseTransactionPoints(
        matchingMember.id,
        refundOrderTarget.id,
        `${isVoid ? "Pembatalan" : "Refund"} pesanan #${refundOrderTarget.orderNumber}: ${params.reason}`,
        !isVoid ? refundOrderTarget.total : 0
      );
    }

    if (
      refundOrderTarget.orderType === "DINE_IN" &&
      refundOrderTarget.tableNumber &&
      refundOrderTarget.tableNumber !== "TAKEAWAY"
    ) {
      releaseTableToAvailable(refundOrderTarget.tableNumber);
    }

    notify.success(
      isVoid
        ? `Pesanan ${refundOrderTarget.orderNumber} dibatalkan`
        : `Pesanan ${refundOrderTarget.orderNumber} di-refund`,
      isVoid
        ? `Alasan: ${params.reason}`
        : `Uang tunai ${formatCurrencyIDR(refundOrderTarget.total)} dikembalikan ke pelanggan`
    );

    if (selectedOrder?.id === refundOrderTarget.id) {
      setSelectedOrder((prev) =>
        prev
          ? result.order || {
              ...prev,
              status: "CANCELLED",
              ...(isVoid
                ? {
                    voidReason: params.reason,
                    voidApprovedBy: params.supervisorName,
                    voidedAt: new Date().toISOString(),
                  }
                : {
                    paymentStatus: "REFUNDED",
                    refundReason: params.reason,
                    refundApprovedBy: params.supervisorName,
                    refundedAt: new Date().toISOString(),
                    refundMethod: "CASH",
                  }),
            }
          : null
      );
    }

    setIsRefundModalOpen(false);
    setRefundOrderTarget(null);
    return { ok: true };
  };

  return (
    <div className="flex flex-col gap-6">
      <OrdersToolbar
        queue={orderQueue}
        onQueueChange={handleQueueChange}
        counts={queueCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
        onOpenPayment={handleOpenPayment}
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
        requiresPin={requiresPinForVoidRefund}
        onConfirmRefund={handleConfirmRefund}
      />

      {/* PDF Report Modal */}
      <OrdersReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        orders={displayedOrders}
        outletName={displayedOrders[0]?.outletName || "Singaraja"}
      />

      {/* POS Thermal Receipt Modal for Reprinting (Customer) */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        receiptData={receiptModalOrder}
        onClose={() => setIsReceiptModalOpen(false)}
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
