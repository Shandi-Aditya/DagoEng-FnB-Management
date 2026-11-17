"use client";

import { useEffect, useMemo, useState } from "react";

import { notify } from "@/components/app/notify";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useOrders } from "@/contexts/OrderContext";
import { usePrinter } from "@/contexts/PrinterContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTables } from "@/contexts/TableContext";
import { KitchenOrderReceiptModal } from "@/features/pos/KitchenOrderReceiptModal";
import { PaymentModal } from "@/features/pos/PaymentModal";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import type { POSCartItem, POSPaymentMethod, POSReceiptData, SplitGuestBill } from "@/features/pos/types";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
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

export default function OrdersPage() {
  const { user } = useAuth();
  const { filteredOrders, advanceOrderStatus } = useOrders();
  const { deductOrderBOM } = useInventory();
  const { members, addPoints } = useLoyalty();
  const { releaseTableToAvailable } = useTables();
  const { logActivity } = useActivityLog();
  const { settings } = useSettings();
  const { recordShiftTransaction } = useEmployeeShift();
  const { queue } = usePrinter();

  const isTenantOwner = user?.scopeLevel === "TENANT" && !!user?.tenant?.id;
  const userTenantId = user?.tenant?.id;

  const roleSlug = user?.role?.slug || (typeof user?.role === "string" ? user.role : "");
  const isKitchenStaff = roleSlug === "KITCHEN_STAFF";
  const canExportNominalReports =
    roleSlug === "SUPER_ADMIN" ||
    roleSlug === "OWNER" ||
    roleSlug === "MANAGER" ||
    (user?.scopeLevel === "TENANT" && !!user?.tenant?.id);
  const canViewNominals = !isKitchenStaff;
  const canProcessPayment =
    roleSlug === "CASHIER" ||
    roleSlug === "SUPER_ADMIN" ||
    roleSlug === "OWNER" ||
    roleSlug === "MANAGER";

  // Strict tenant-aware order list
  const displayedOrders = useMemo(() => {
    return filterOrdersByTenant(filteredOrders, userTenantId, isTenantOwner);
  }, [filteredOrders, userTenantId, isTenantOwner]);

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
    setPaymentOrder(order);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
    splitDetails?: SplitGuestBill[];
  }) => {
    if (!paymentOrder) return;

    const chosenMethod = paymentData.method;
    const pBreakdown = getOrderTaxBreakdown(paymentOrder);

    // 1. Advance order status to COMPLETED and update payment
    advanceOrderStatus(
      paymentOrder.id,
      "COMPLETED",
      `Pembayaran lunas via ${paymentData.method} (${formatCurrencyIDR(paymentOrder.total)})`,
      {
        paymentStatus: "PAID",
        paymentMethod: chosenMethod,
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

    // 2. Inventory: Deduct ingredients based on Recipe BOM
    const bomItems = paymentOrder.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      modifiers: it.modifiers,
    }));
    deductOrderBOM(bomItems);

    // 3. Loyalty: Add points if customer is registered
    const matchingMember = members.find(
      (m) => m.name.toLowerCase().trim() === paymentOrder.customerName.toLowerCase().trim()
    );
    let pointsAdded = 0;
    if (matchingMember) {
      pointsAdded = Math.floor(paymentOrder.total / 1000);
      if (pointsAdded > 0) {
        addPoints(
          matchingMember.id,
          pointsAdded,
          `Penyelesaian Pesanan #${paymentOrder.orderNumber}`,
          paymentOrder.id,
          paymentOrder.total
        );
      }
    }

    // 4. Table: Release table to AVAILABLE if Dine-in
    if (
      paymentOrder.orderType === "DINE_IN" &&
      paymentOrder.tableNumber &&
      paymentOrder.tableNumber !== "TAKEAWAY"
    ) {
      releaseTableToAvailable(paymentOrder.tableNumber);
    }

    // 5. Activity Log: Record transaction settlement audit trail
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

    // 6. UI Toast Feedback
    const memberMsg = matchingMember ? ` · ${matchingMember.name} +${pointsAdded} poin` : "";
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
            }
          : null
      );
    }
  };

  const modalCartItems: POSCartItem[] = paymentOrder
    ? paymentOrder.items.map((it, idx) => ({
        cartItemId: it.id || `ord-it-${idx}`,
        productId: it.id || `prod-${idx}`,
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
    setReceiptModalOrder(buildOrderReceiptData(order));
    setIsReceiptModalOpen(true);
  };

  const handlePrintKitchenTicket = (order: OrderRecord, purpose: PrintPurpose) => {
    setKitchenModalTicket(buildReprintKitchenTicket(order, purpose, user?.name));
    setIsKitchenModalOpen(true);
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
        promos={settings.promos}
        onOpenPayment={handleOpenPayment}
        onPrintReceipt={handlePrintReceipt}
        onPrintKitchenTicket={handlePrintKitchenTicket}
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

      {/* PDF Report Modal */}
      <OrdersReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        orders={filteredOrders}
        outletName={filteredOrders[0]?.outletName || "Singaraja"}
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
