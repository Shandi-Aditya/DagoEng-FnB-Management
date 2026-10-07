"use client";

import React, { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrderContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useTables } from "@/contexts/TableContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useSettings } from "@/contexts/SettingsContext";
import { OrderRecord } from "@/types/order";
import { calculateOrderMetrics, formatMinutesToHuman } from "@/lib/order-analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  ClipboardList,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  ArrowRight,
  User,
  Download,
  CreditCard,
  Sparkles,
  Check,
  FileText,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import { PaymentModal } from "@/features/pos/PaymentModal";
import { POSCartItem, POSPaymentMethod, POSReceiptData } from "@/features/pos/types";
import { OrdersReportPDFModal } from "@/features/orders/OrdersReportPDFModal";
import { ReceiptModal } from "@/features/pos/ReceiptModal";
import { getTenantName } from "@/lib/tenant";

export default function OrdersPage() {
  const { user } = useAuth();
  const { filteredOrders, advanceOrderStatus } = useOrders();
  const { simulateBOMDeduction } = useInventory();
  const { members, addPoints } = useLoyalty();
  const { releaseTableToAvailable } = useTables();
  const { logActivity } = useActivityLog();
  const { settings } = useSettings();

  const isTenantOwner = user?.scopeLevel === "TENANT" && !!user?.tenant?.id;
  const userTenantId = user?.tenant?.id;

  // Strict tenant-aware order list
  const displayedOrders = useMemo(() => {
    if (!isTenantOwner || !userTenantId) return filteredOrders;
    return filteredOrders.filter((o) => o.items.some((it) => it.tenantId === userTenantId));
  }, [filteredOrders, isTenantOwner, userTenantId]);

  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<OrderRecord | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState<boolean>(false);
  const [receiptModalOrder, setReceiptModalOrder] = useState<POSReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const convertOrderToReceiptData = (order: OrderRecord): POSReceiptData => {
    const primaryTenantId = order.items[0]?.tenantId || "tenant-ks";
    const primaryTenantName = getTenantName(primaryTenantId) || "Kopi Senja";

    return {
      orderNumber: order.orderNumber,
      date: new Date(order.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      cashierName: "Kasir / Staff Bertugas",
      tenantId: primaryTenantId,
      tenantName: primaryTenantName,
      outletName: order.outletName ? `${primaryTenantName} — ${order.outletName}` : "Outlet Singaraja",
      outletAddress: "Jl. Veteran No. 18, Singaraja, Bali",
      outletPhone: "(0362) 23456",
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      orderType: (order.orderType as any) || "DINE_IN",
      items: order.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.quantity * i.unitPrice,
        modifiers: i.modifiers,
        notes: i.notes,
        tenantId: i.tenantId,
        tenantName: getTenantName(i.tenantId),
      })),
      subtotal: order.subtotal,
      tax: order.tax || 0,
      serviceCharge: 0,
      promoName: order.promoId,
      discount: order.discount || 0,
      grandTotal: order.total,
      paymentMethod: (order.paymentMethod as any) || "QRIS",
      amountPaid: order.total,
      changeDue: 0,
    };
  };

  const getOrderExportData = () => {
    const headers = [
      "No. Pesanan",
      "Meja",
      "Pelanggan",
      "Tipe Pesanan",
      "Promo",
      "Diskon (Rp)",
      "Total Tagihan (Rp)",
      "Status",
      "Metode Pembayaran",
      "Jumlah Item",
      "Waktu Dibuat",
    ];
    const rows = displayedOrders.map((o) => {
      const promoName = settings.promos.find((p) => p.id === o.promoId)?.name || o.promoId || "-";
      const discountVal = o.discount ?? Math.max(0, (o.subtotal + (o.tax || 0)) - o.total);
      return [
        o.orderNumber,
        o.tableNumber,
        o.customerName,
        o.orderType,
        promoName,
        discountVal > 0 ? `-Rp ${discountVal.toLocaleString("id-ID")}` : "Rp 0",
        `Rp ${o.total.toLocaleString("id-ID")}`,
        o.status,
        o.paymentMethod || "QRIS",
        o.items.length,
        new Date(o.createdAt).toLocaleString("id-ID"),
      ];
    });
    return { headers, rows };
  };

  const handleExportOrdersCSV = () => {
    const { headers, rows } = getOrderExportData();
    downloadCSV(`Daftar_Pesanan_Transaksi_${Date.now()}`, headers, rows);
  };

  const handleExportOrdersExcel = () => {
    const { headers, rows } = getOrderExportData();
    downloadExcel(`Daftar_Pesanan_Transaksi_${Date.now()}`, "Riwayat Pesanan", headers, rows);
  };

  const handleOpenPayment = (order: OrderRecord) => {
    setPaymentOrder(order);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (paymentData: {
    method: POSPaymentMethod;
    amountPaid: number;
    changeDue: number;
  }) => {
    if (!paymentOrder) return;

    const chosenMethod =
      paymentData.method === "CASH" ? "CASH" : paymentData.method === "EDC" ? "EDC" : "QRIS";

    // 1. Advance order status to COMPLETED and update payment
    advanceOrderStatus(
      paymentOrder.id,
      "COMPLETED",
      `Pembayaran lunas via ${paymentData.method} (${formatCurrencyIDR(paymentOrder.total)})`,
      {
        paymentStatus: "PAID",
        paymentMethod: chosenMethod,
      }
    );

    // 2. Inventory: Deduct ingredients based on Recipe BOM
    paymentOrder.items.forEach((item) => {
      simulateBOMDeduction(item.productName, item.quantity);
    });

    // 3. Loyalty: Add points if customer is registered
    const matchingMember = members.find(
      (m) => m.name.toLowerCase().trim() === paymentOrder.customerName.toLowerCase().trim()
    );
    let pointsAdded = 0;
    if (matchingMember) {
      pointsAdded = Math.floor(paymentOrder.total / 1000); // 1 pt per Rp 1.000 spend
      if (pointsAdded > 0) {
        addPoints(
          matchingMember.id,
          pointsAdded,
          `Penyelesaian Pesanan #${paymentOrder.orderNumber}`,
          paymentOrder.id
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
    const memberMsg = matchingMember ? ` +${pointsAdded} Poin Loyalty (${matchingMember.name})` : "";
    setSuccessToast(
      `Pesanan ${paymentOrder.orderNumber} berhasil dibayar (${paymentData.method}) & COMPLETED! Stok BOM dipotong, Meja ${paymentOrder.tableNumber} RELEASED.${memberMsg}`
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

    setTimeout(() => {
      setSuccessToast(null);
    }, 6000);
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

  return (
    <div className="space-y-6">
      {/* Success Notification Alert */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm flex items-start justify-between animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-full bg-emerald-600 text-white">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-emerald-950">Transaksi Selesai & Terintegrasi</p>
              <p className="text-xs text-emerald-800 mt-0.5">{successToast}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 text-brand-orange" />
            <span>Riwayat & Pelacakan Lifecycle Pesanan</span>
          </h2>
          <p className="text-xs text-slate-500">
            Pelacakan end-to-end waktu tunggu, status dapur, pembayaran, dan riwayat mutasi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportOrdersExcel}
            className="text-xs space-x-1.5 border-emerald-300 text-emerald-750 font-bold hover:bg-emerald-50 shadow-2xs text-emerald-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportOrdersCSV}
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
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                <tr>
                  <th className="p-3">No. Pesanan</th>
                  <th className="p-3">Meja / Pelanggan</th>
                  <th className="p-3">Status Lifecycle</th>
                  <th className="p-3">Waktu Tunggu</th>
                  <th className="p-3">SLA Status</th>
                  <th className="p-3">Total Tagihan</th>
                  <th className="p-3">Metode Bayar</th>
                  <th className="p-3 text-right">Aksi & Riwayat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      Belum ada riwayat transaksi pesanan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((o) => {
                    const metrics = calculateOrderMetrics(o);
                    const isDelayed = metrics.slaStatus === "DELAYED";
                    const isCompleted = o.status === "COMPLETED";

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{o.orderNumber}</td>
                        <td className="p-3 font-semibold">
                          <p className="text-slate-900 font-bold">{o.tableNumber}</p>
                          <p className="text-[10px] text-slate-400 font-normal">{o.customerName}</p>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isCompleted
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-brand-orange/10 text-brand-orange border border-brand-orange/20"
                            }`}
                          >
                            {o.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-semibold" suppressHydrationWarning>
                          {formatMinutesToHuman(metrics.totalCustomerWaitingMinutes)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDelayed
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : metrics.slaStatus === "AT_RISK"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {metrics.slaStatus.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{formatCurrencyIDR(o.total)}</td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              o.paymentStatus === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {o.paymentMethod || (o.paymentStatus === "PAID" ? "QRIS" : "PENDING")}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {!isCompleted && o.status !== "CANCELLED" && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenPayment(o)}
                                className="h-7 text-[11px] px-2.5 bg-brand-orange hover:bg-orange-600 text-white font-bold space-x-1 shadow-xs"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>Proses Pembayaran</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedOrder(o)}
                              className="h-7 text-[11px] px-2.5 space-x-1"
                            >
                              <History className="w-3 h-3 text-brand-orange" />
                              <span>Timeline</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Order Detail & Lifecycle History Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Timeline Lifecycle: {selectedOrder.orderNumber}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedOrder.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-brand-orange/10 text-brand-orange"
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Meja {selectedOrder.tableNumber} • {selectedOrder.customerName} • Total:{" "}
                  <strong className="text-slate-900">{formatCurrencyIDR(selectedOrder.total)}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Time Breakdown Cards */}
            {(() => {
              const m = calculateOrderMetrics(selectedOrder);
              return (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-cyan-50 border border-cyan-100">
                    <p className="text-[10px] text-cyan-700 font-bold uppercase">Kitchen Queue</p>
                    <p className="text-sm font-bold text-cyan-950 mt-0.5" suppressHydrationWarning>
                      {formatMinutesToHuman(m.kitchenQueueMinutes)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100">
                    <p className="text-[10px] text-orange-700 font-bold uppercase">Cooking Time</p>
                    <p className="text-sm font-bold text-orange-950 mt-0.5" suppressHydrationWarning>
                      {formatMinutesToHuman(m.cookingMinutes)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase">Serving Time</p>
                    <p className="text-sm font-bold text-emerald-950 mt-0.5" suppressHydrationWarning>
                      {formatMinutesToHuman(m.servingMinutes)}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Ordered Items Summary & Financial Breakdown */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
                  Item Pesanan ({selectedOrder.items.length}):
                </h4>
                <div className="space-y-1.5">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-slate-700">
                      <div>
                        <span className="font-bold text-slate-900">{item.quantity}x</span> {item.productName}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({item.modifiers.join(", ")})
                          </span>
                        )}
                      </div>
                      <span className="font-medium text-slate-900">
                        {formatCurrencyIDR(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation (Subtotal, Promo, Discount, Total) */}
              {(() => {
                const promoName = settings.promos.find((p) => p.id === selectedOrder.promoId)?.name || selectedOrder.promoId;
                const discountAmount = selectedOrder.discount ?? Math.max(0, (selectedOrder.subtotal + (selectedOrder.tax || 0)) - selectedOrder.total);

                return (
                  <div className="pt-2.5 border-t border-slate-200/80 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-slate-800">{formatCurrencyIDR(selectedOrder.subtotal)}</span>
                    </div>
                    {promoName && (
                      <div className="flex justify-between text-slate-700">
                        <span>Promo:</span>
                        <span className="font-bold text-purple-700">{promoName}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Discount:</span>
                        <span>-{formatCurrencyIDR(discountAmount)}</span>
                      </div>
                    )}
                    {selectedOrder.tax > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Pajak Restoran:</span>
                        <span>+{formatCurrencyIDR(selectedOrder.tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200 text-sm">
                      <span>Total:</span>
                      <span className="text-brand-orange">{formatCurrencyIDR(selectedOrder.total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Step Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Riwayat Perubahan Status:
              </h4>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {selectedOrder.statusHistory.map((item, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-brand-orange border-2 border-white ring-2 ring-orange-100" />
                    <div className="text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">
                          {item.toStatus.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      {item.actorName && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Oleh: <strong className="text-slate-700">{item.actorName}</strong>
                        </p>
                      )}
                      {item.note && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 mt-1">
                          💬 {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                {selectedOrder.status !== "COMPLETED" && selectedOrder.status !== "CANCELLED" && selectedOrder.paymentStatus !== "PAID" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const target = selectedOrder;
                      handleOpenPayment(target);
                    }}
                    className="text-xs bg-brand-orange hover:bg-orange-600 text-white font-bold space-x-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Proses Pembayaran</span>
                  </Button>
                )}

                {selectedOrder.paymentStatus === "PAID" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReceiptModalOrder(convertOrderToReceiptData(selectedOrder));
                      setIsReceiptModalOpen(true);
                    }}
                    className="text-xs font-bold space-x-1.5 border-slate-300"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Cetak Nota Struk</span>
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedOrder(null)}
                className="text-xs px-4"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* POS Payment Modal Integration */}
      {paymentOrder && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          cartItems={modalCartItems}
          subtotal={paymentOrder.subtotal}
          tax={paymentOrder.tax}
          serviceCharge={0}
          discount={paymentOrder.discount || 0}
          grandTotal={paymentOrder.total}
          tableNumber={paymentOrder.tableNumber}
          customerName={paymentOrder.customerName}
          orderType={paymentOrder.orderType === "TAKEAWAY" ? "TAKEAWAY" : "DINE_IN"}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* PDF Report Modal */}
      <OrdersReportPDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        orders={filteredOrders}
        outletName={filteredOrders[0]?.outletName || "Singaraja"}
      />

      {/* POS Thermal Receipt Modal for Reprinting */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        receiptData={receiptModalOrder}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
}
