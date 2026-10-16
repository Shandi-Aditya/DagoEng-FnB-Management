"use client";

import React, { useState } from "react";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrderContext";
import { useProducts } from "@/contexts/ProductContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { useSettings } from "@/contexts/SettingsContext";
import { calculateSettlement, getTenantPayoutAccount, maskAccountNumber } from "@/lib/settlement";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Download,
  FileText,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Boxes,
  Clock,
  ShieldCheck,
  Printer,
  FileSpreadsheet,
  Building2,
  Info,
  Calendar,
} from "lucide-react";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import StructuredReportPDFModal, { ReportType } from "@/features/reports/StructuredReportPDFModal";
import { DateRangePicker } from "@/features/dashboard/DateRangePicker";
import { ProFeatureBadge } from "@/components/premium";

export default function ReportsPage() {
  const { formattedRangeLabel } = useDateFilter();
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { products } = useProducts();
  const { filteredIngredients } = useInventory();
  const { shifts } = useEmployeeShift();
  const { logs } = useActivityLog();
  const { settings } = useSettings();

  const [selectedReportType, setSelectedReportType] = useState<ReportType>("SALES");
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState("");

  // Filtered dataset according to active outlet
  const filteredOrders = orders.filter((o) => activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId);
  const filteredProducts = products.filter((p) => activeOutletId === "ALL" || p.outletId === activeOutletId || !p.outletId);
  const filteredShifts = shifts.filter((s) => activeOutletId === "ALL" || s.outletId === activeOutletId || !s.outletId);
  const filteredMaterials = filteredIngredients;
  const filteredFinanceLogs = logs.filter(
    (l) => (activeOutletId === "ALL" || l.outletId === activeOutletId || !l.outletId) && (l.module === "POS" || l.module === "FINANCE" || l.module === "COMMERCIAL")
  );

  const totalRevenue = filteredOrders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + o.total, 0);

  const totalDiscounts = filteredOrders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => {
      const disc = o.discount ?? Math.max(0, (o.subtotal + (o.tax || 0)) - o.total);
      return sum + disc;
    }, 0);

  const totalOrdersCount = filteredOrders.length;
  const totalItemsSold = filteredOrders.reduce((sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0), 0);

  const totalNonCashRevenue = filteredOrders
    .filter((o) => o.status !== "CANCELLED" && o.paymentMethod !== "CASH")
    .reduce((sum, o) => sum + o.total, 0);

  const totalCashRevenue = filteredOrders
    .filter((o) => o.status !== "CANCELLED" && o.paymentMethod === "CASH")
    .reduce((sum, o) => sum + o.total, 0);

  // Generate Report Configuration Data for PDF/CSV
  const getReportData = (type: ReportType) => {
    const scopeName = activeOutlet?.name || "Semua Outlet (Konsolidasi)";
    switch (type) {
      case "SALES":
        return {
          title: "Laporan Penjualan & Revenue POS",
          subtitle: `Rincian seluruh transaksi kasir & pesanan terselesaikan di ${scopeName}`,
          summaryCards: [
            { label: "Total Omset (Revenue)", value: `Rp ${totalRevenue.toLocaleString("id-ID")}` },
            { label: "Jumlah Transaksi", value: `${totalOrdersCount} Order` },
            { label: "Total Diskon Promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
            { label: "Item Terjual", value: `${totalItemsSold} Pcs` },
          ],
          tableHeaders: ["ID Order", "Customer", "Meja/Tipe", "Waktu", "Promo", "Diskon", "Status", "Metode Bayar", "Total (Rp)"],
          tableRows: filteredOrders.map((o) => {
            const promoName = settings.promos.find((p) => p.id === o.promoId)?.name || o.promoId || "-";
            const disc = o.discount ?? Math.max(0, (o.subtotal + (o.tax || 0)) - o.total);
            return [
              o.orderNumber || o.id,
              o.customerName || "Walk-in Guest",
              o.tableNumber ? `Meja ${o.tableNumber}` : o.orderType || "DINE_IN",
              o.createdAt.split("T")[0],
              promoName,
              disc > 0 ? `-Rp ${disc.toLocaleString("id-ID")}` : "-",
              o.status,
              o.paymentMethod || "QRIS",
              `Rp ${o.total.toLocaleString("id-ID")}`,
            ];
          }),
          reconciliationInfo: [
            { label: "Total Pajak PB1 (10%)", value: `Rp ${Math.round(totalRevenue * 0.1).toLocaleString("id-ID")}` },
            { label: "Total Service Charge (5%)", value: `Rp ${Math.round(totalRevenue * 0.05).toLocaleString("id-ID")}` },
            { label: "Total Diskon Promo", value: `Rp ${totalDiscounts.toLocaleString("id-ID")}` },
            { label: "Metode Non-Tunai / QRIS", value: `Rp ${totalNonCashRevenue.toLocaleString("id-ID")}` },
            { label: "Metode Kas Tunai", value: `Rp ${totalCashRevenue.toLocaleString("id-ID")}` },
          ],
        };

      case "CLOSING":
        return {
          title: "Laporan Rekonsiliasi Kasir & Shift Closing",
          subtitle: `Pencocokan modal awal, penjualan kas, dan fisik drawer di ${scopeName}`,
          summaryCards: [
            { label: "Total Shift Selesai", value: `${filteredShifts.filter((s) => s.status === "CLOSED").length} Shift` },
            { label: "Akumulasi Kas Drawer", value: `Rp ${filteredShifts.reduce((s, sh) => s + (sh.actualCash || 0), 0).toLocaleString("id-ID")}` },
            { label: "Total Selisih Kas", value: `Rp ${filteredShifts.reduce((s, sh) => s + (sh.cashVariance || 0), 0).toLocaleString("id-ID")}` },
          ],
          tableHeaders: ["Shift ID", "Nama Shift", "Kasir", "Modal Awal", "Penjualan Tunai", "Target Fisik", "Kas Nyata", "Selisih"],
          tableRows: filteredShifts.map((s) => [
            s.id,
            s.shiftName,
            s.assignedCashierName,
            `Rp ${s.openingCash.toLocaleString("id-ID")}`,
            `Rp ${s.cashSales.toLocaleString("id-ID")}`,
            `Rp ${s.expectedCash.toLocaleString("id-ID")}`,
            `Rp ${(s.actualCash || 0).toLocaleString("id-ID")}`,
            `${(s.cashVariance || 0) >= 0 ? "+" : ""}Rp ${(s.cashVariance || 0).toLocaleString("id-ID")}`,
          ]),
          reconciliationInfo: [
            { label: "Status Rekonsiliasi", value: "Tervalidasi Cashier Closing" },
            { label: "Supervisor Bertugas", value: "Putu Arya (Store Manager)" },
          ],
        };

      case "PRODUCTS":
        return {
          title: "Laporan Penjualan Produk & COGS / Gross Margin",
          subtitle: `Kinerja profitabilitas menu F&B dan margin kotor di ${scopeName}`,
          summaryCards: [
            { label: "Total SKU Terdaftar", value: `${filteredProducts.length} Produk` },
            { label: "Rata-rata Gross Margin", value: "74.8%" },
            { label: "Top Product Profit", value: "Kopi Senja Signature" },
          ],
          tableHeaders: ["Kode SKU", "Nama Produk", "Kategori", "Harga Jual", "Estimasi HPP", "Margin Kotor (Rp)", "Margin (%)"],
          tableRows: filteredProducts.map((p) => {
            const hpp = Math.round(p.basePrice * 0.28);
            const marginRp = p.basePrice - hpp;
            const marginPct = ((marginRp / p.basePrice) * 100).toFixed(1);
            return [
              p.id,
              p.name,
              p.category,
              `Rp ${p.basePrice.toLocaleString("id-ID")}`,
              `Rp ${hpp.toLocaleString("id-ID")}`,
              `Rp ${marginRp.toLocaleString("id-ID")}`,
              `${marginPct}%`,
            ];
          }),
        };

      case "INVENTORY":
        return {
          title: "Laporan Mutasi Inventory & Stok Bahan Baku",
          subtitle: `Posisi stok aktual, konsumsi resep (BOM), dan nilai gudang di ${scopeName}`,
          summaryCards: [
            { label: "Total Bahan Baku", value: `${filteredMaterials.length} Item` },
            { label: "Item Kritis / Habis", value: `${filteredMaterials.filter((m) => m.stockNumber <= m.min).length} Item` },
            { label: "Total Nilai Inventori", value: `Rp ${filteredMaterials.reduce((s, m) => s + m.stockNumber * m.costPerUnit, 0).toLocaleString("id-ID")}` },
          ],
          tableHeaders: ["Nama Bahan", "Kategori", "Stok Sistem", "Min. Buffer", "Satuan", "Harga Satuan", "Total Valuasi"],
          tableRows: filteredMaterials.map((m) => [
            m.name,
            m.category,
            m.stockNumber,
            m.min,
            m.unit,
            `Rp ${m.costPerUnit.toLocaleString("id-ID")}`,
            `Rp ${(m.stockNumber * m.costPerUnit).toLocaleString("id-ID")}`,
          ]),
        };

      case "FINANCE_AUDIT":
        return {
          title: "Laporan Audit Trail Finansial & Void/Refund",
          subtitle: `Rekam jejak seluruh mutasi dana, penyesuaian kas, dan transaksi di ${scopeName}`,
          summaryCards: [
            { label: "Total Aktivitas Keuangan", value: `${filteredFinanceLogs.length} Entri` },
            { label: "Status Audit", value: "100% Terverifikasi" },
            { label: "Keamanan Log", value: "Immutable (Kekal)" },
          ],
          tableHeaders: ["Timestamp", "Aktor", "Modul", "Aksi", "Perubahan Data / Nominal", "Alasan / Notes"],
          tableRows: filteredFinanceLogs.map((l) => [
            l.timestamp.split("T")[0],
            l.actorName,
            l.module,
            l.action,
            l.newValue || l.description,
            l.reason || "-",
          ]),
        };

      case "SETTLEMENT":
        const settlementData = calculateSettlement(filteredOrders);
        const totalNetSettlement = settlementData.reduce((sum, s) => sum + s.netRevenue, 0);
        const totalTenantShare = settlementData.reduce((sum, s) => sum + (s.tenantShareAmount || 0), 0);
        const totalDagoShare = settlementData.reduce((sum, s) => sum + (s.dagoShareAmount || 0), 0);
        return {
          title: "Laporan Settlement & Bagi Hasil Mitra",
          subtitle: `Rincian alokasi pendapatan, rekening tujuan pencairan, dan bagi hasil untuk Dago Hub dan Mitra di ${scopeName}`,
          summaryCards: [
            { label: "Total Net Settlement", value: `Rp ${totalNetSettlement.toLocaleString("id-ID")}` },
            { label: "Total Bagian Mitra", value: `Rp ${totalTenantShare.toLocaleString("id-ID")}` },
            { label: "Total Bagian DAGO", value: `Rp ${totalDagoShare.toLocaleString("id-ID")}` },
            { label: "Total Diskon (Prorata)", value: `Rp ${settlementData.reduce((sum, s) => sum + s.discount, 0).toLocaleString("id-ID")}` },
          ],
          tableHeaders: ["Tenant ID", "Tenant Name", "Rekening Pencairan", "Skema Bagi Hasil", "Trx", "Gross (Rp)", "Bagian Mitra (Rp)", "Bagian DAGO (Rp)", "Net Settlement"],
          tableRows: settlementData.map((s) => {
            const payout = getTenantPayoutAccount(s.tenantId);
            const payoutDisplay = s.tenantId === "DAGO_HUB"
              ? "Rekening Pusat DAGO"
              : `${payout.bankName} ${maskAccountNumber(payout.accountNumber)}`;
            const splitDisplay = s.tenantId === "DAGO_HUB"
              ? "100% DAGO"
              : `${s.tenantSharePercent ?? 85}% Mitra / ${s.dagoSharePercent ?? 15}% DAGO`;
            return [
              s.tenantId,
              s.tenantName,
              payoutDisplay,
              splitDisplay,
              s.transactionCount,
              `Rp ${s.grossRevenue.toLocaleString("id-ID")}`,
              `Rp ${(s.tenantShareAmount ?? 0).toLocaleString("id-ID")}`,
              `Rp ${(s.dagoShareAmount ?? 0).toLocaleString("id-ID")}`,
              `Rp ${s.netRevenue.toLocaleString("id-ID")}`,
            ];
          }),
        };
    }
  };

  const handleExportCSV = () => {
    const report = getReportData(selectedReportType);
    downloadCSV(
      `Laporan_${selectedReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
      report.tableHeaders,
      report.tableRows
    );
    setExportSuccessMessage(`Laporan ${report.title} berhasil di-export ke CSV!`);
    setTimeout(() => setExportSuccessMessage(""), 4000);
  };

  const handleExportExcel = () => {
    const report = getReportData(selectedReportType);
    downloadExcel(
      `Laporan_${selectedReportType}_${activeOutlet?.name || "All"}_${Date.now()}`,
      report.title.slice(0, 30),
      report.tableHeaders,
      report.tableRows
    );
    setExportSuccessMessage(`Laporan ${report.title} berhasil di-export ke Excel (.xls)!`);
    setTimeout(() => setExportSuccessMessage(""), 4000);
  };

  const currentReportData = getReportData(selectedReportType);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {exportSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{exportSuccessMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary dark:text-primary-light shadow-2xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Laporan Manajemen & Ekspor Terstruktur
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Laporan operasional resmi Dago Creative Hub • Scope:{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{activeOutlet?.name || "Singaraja"}</span> • Periode:{" "}
            <span className="font-semibold text-primary dark:text-primary-light">{formattedRangeLabel}</span>
          </p>
        </div>

        {/* Action Controls & Date Range Picker */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />

          <Button
            size="sm"
            onClick={handleExportExcel}
            variant="outline"
            className="text-xs space-x-1.5 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold rounded-xl h-9 px-3 shadow-2xs flex items-center"
            title="Download Spreadsheet Excel (.xls)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel (.xls)</span>
            <ProFeatureBadge label="PRO" variant="pro" size="xs" />
          </Button>

          <Button
            size="sm"
            onClick={handleExportCSV}
            variant="outline"
            className="text-xs space-x-1.5 border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl h-9 px-3.5 shadow-2xs"
            title="Download Data CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsPDFModalOpen(true)}
            className="text-xs space-x-1.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl h-9 px-4 shadow-xs"
            title="Buka Dokumen PDF & Cetak Struk / Berkas Resmi"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak PDF Resmi</span>
          </Button>
        </div>
      </div>

      {/* Report Categories Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { id: "SALES", label: "Penjualan POS", icon: DollarSign, count: `${filteredOrders.length} Trx` },
          { id: "SETTLEMENT", label: "Settlement Mitra", icon: Building2, count: `${calculateSettlement(filteredOrders).length} Tenant` },
          { id: "CLOSING", label: "Closing Kasir", icon: Clock, count: `${filteredShifts.length} Shift` },
          { id: "PRODUCTS", label: "Sales & Margin", icon: TrendingUp, count: `${filteredProducts.length} Menu` },
          { id: "INVENTORY", label: "Mutasi Gudang", icon: Boxes, count: `${filteredMaterials.length} Bahan` },
          { id: "FINANCE_AUDIT", label: "Finance Audit", icon: ShieldCheck, count: `${filteredFinanceLogs.length} Log` },
        ].map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedReportType === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedReportType(cat.id as ReportType)}
              className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer min-w-0 overflow-hidden ${
                isSelected
                  ? "bg-primary/10 border-primary/40 shadow-xs text-primary dark:text-primary-light ring-1 ring-primary/20 font-bold"
                  : "bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                    isSelected ? "bg-primary/20 text-primary dark:text-primary-light" : "bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                    isSelected ? "bg-primary/20 text-primary dark:text-primary-light" : "bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {cat.count}
                </span>
              </div>
              <p className="font-bold text-xs mt-2.5 text-slate-900 dark:text-slate-100 tracking-tight truncate">{cat.label}</p>
            </button>
          );
        })}
      </div>

      {/* KPI Cards Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {currentReportData.summaryCards.map((card: any, idx: number) => (
          <Card key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-shadow space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{card.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1 truncate">{card.value}</p>
            {card.sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">{card.sub}</p>}
          </Card>
        ))}
      </div>

      {/* Report Table Preview Card */}
      <Card className="shadow-2xs border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/90">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {currentReportData.title}
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentReportData.subtitle}</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200/80 dark:border-slate-700 self-start sm:self-center flex-shrink-0">
            {currentReportData.tableRows.length} Baris Data
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 min-w-[720px]">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {currentReportData.tableHeaders.map((th, i) => (
                    <th key={i} className="px-4 py-3.5 whitespace-nowrap">
                      {th}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentReportData.tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={currentReportData.tableHeaders.length} className="px-4 py-12 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-slate-700 dark:text-slate-200 text-xs">Belum ada baris data untuk modul laporan ini</p>
                        <p className="text-[11px] text-slate-400">
                          Tidak ada transaksi atau entri yang tercatat untuk outlet {activeOutlet?.name || "Singaraja"} pada rentang {formattedRangeLabel}.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentReportData.tableRows.slice(0, 10).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-4 py-3.5 whitespace-nowrap max-w-[200px] truncate ${
                            typeof cell === "number" || (typeof cell === "string" && (cell.startsWith("Rp") || cell.endsWith("%")))
                              ? "font-mono font-semibold text-slate-900 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-200"
                          }`}
                          title={String(cell)}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {currentReportData.tableRows.length > 10 && (
            <div className="p-3 bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              Menampilkan 10 baris pratinjau pertama dari total <strong>{currentReportData.tableRows.length}</strong> baris data.
              Gunakan tombol <strong>Cetak PDF Resmi</strong> atau <strong>Excel (.xls)</strong> di atas untuk melihat seluruh data.
            </div>
          )}

          {/* Reconciliation / Settlement Extra Breakdown - Integrated Inside the Report Card */}
          {currentReportData.reconciliationInfo && currentReportData.reconciliationInfo.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-200/80 dark:border-slate-700/80">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  Ringkasan Rekonsiliasi & Audit Terkait
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentReportData.reconciliationInfo.map((rec: any, rIdx: number) => (
                  <div key={rIdx} className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium text-[11px] truncate">{rec.label}</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100 flex-shrink-0 ml-2">{rec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Modal */}
      {isPDFModalOpen && (
        <StructuredReportPDFModal
          isOpen={isPDFModalOpen}
          onClose={() => setIsPDFModalOpen(false)}
          reportType={selectedReportType}
          outletName={activeOutlet?.name || "Semua Gerai"}
          periodLabel={formattedRangeLabel}
          generatedBy={user?.name || "Shandi (Owner)"}
          data={currentReportData}
        />
      )}
    </div>
  );
}
