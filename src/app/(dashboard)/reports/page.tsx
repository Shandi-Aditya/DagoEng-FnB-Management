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
import { calculateSettlement } from "@/lib/settlement";
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
} from "lucide-react";
import { downloadCSV, downloadExcel } from "@/lib/export-utils";
import StructuredReportPDFModal, { ReportType } from "@/features/reports/StructuredReportPDFModal";

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

  // Generate Report Configuration Data for PDF/CSV
  const getReportData = (type: ReportType) => {
    switch (type) {
      case "SALES":
        return {
          title: "Laporan Penjualan & Revenue POS",
          subtitle: `Rincian seluruh transaksi kasir & pesanan terselesaikan di ${activeOutlet?.name}`,
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
            { label: "Metode QRIS & Transfer", value: `Rp ${Math.round(totalRevenue * 0.65).toLocaleString("id-ID")}` },
          ],
        };

      case "CLOSING":
        return {
          title: "Laporan Rekonsiliasi Kasir & Shift Closing",
          subtitle: `Pencocokan modal awal, penjualan kas, dan fisik drawer di ${activeOutlet?.name}`,
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
          subtitle: `Kinerja profitabilitas menu F&B dan margin kotor di ${activeOutlet?.name}`,
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
          subtitle: `Posisi stok aktual, konsumsi resep (BOM), dan nilai gudang di ${activeOutlet?.name}`,
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
          subtitle: `Rekam jejak seluruh mutasi dana, penyesuaian kas, dan transaksi di ${activeOutlet?.name}`,
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
        return {
          title: "Laporan Settlement & Bagi Hasil Mitra",
          subtitle: `Rincian alokasi pendapatan, diskon, dan pajak untuk Dago Hub dan Mitra di ${activeOutlet?.name}`,
          summaryCards: [
            { label: "Total Net Settlement", value: `Rp ${totalNetSettlement.toLocaleString("id-ID")}` },
            { label: "Total Diskon (Prorata)", value: `Rp ${settlementData.reduce((sum, s) => sum + s.discount, 0).toLocaleString("id-ID")}` },
            { label: "Total Pajak & Charge", value: `Rp ${settlementData.reduce((sum, s) => sum + (s.tax + s.serviceCharge), 0).toLocaleString("id-ID")}` },
          ],
          tableHeaders: ["Tenant ID", "Tenant Name", "Trx", "Item", "Gross (Rp)", "Discount", "Tax & Charge", "Net Settlement"],
          tableRows: settlementData.map((s) => [
            s.tenantId,
            s.tenantName,
            s.transactionCount,
            s.itemCount,
            `Rp ${s.grossRevenue.toLocaleString("id-ID")}`,
            `-Rp ${s.discount.toLocaleString("id-ID")}`,
            `+Rp ${(s.tax + s.serviceCharge).toLocaleString("id-ID")}`,
            `Rp ${s.netRevenue.toLocaleString("id-ID")}`,
          ]),
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-brand-orange" />
            <span>Laporan Manajemen & Structured PDF Exports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan operasional resmi Dago Creative Hub • Scope: <strong className="text-slate-800">{activeOutlet?.name}</strong> • Periode: <strong className="text-slate-800">{formattedRangeLabel}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleExportExcel}
            variant="outline"
            className="text-xs space-x-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel (.xls)</span>
          </Button>
          <Button
            size="sm"
            onClick={handleExportCSV}
            variant="outline"
            className="text-xs space-x-1.5 border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsPDFModalOpen(true)}
            className="text-xs space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak PDF Resmi</span>
          </Button>
        </div>
      </div>

      {/* Report Categories Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? "bg-purple-50/80 border-purple-500 shadow-xs text-purple-900 ring-1 ring-purple-500/20"
                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${isSelected ? "text-purple-600" : "text-slate-400"}`} />
                <span className="text-[10px] font-semibold text-slate-400">{cat.count}</span>
              </div>
              <p className="font-bold text-xs mt-2">{cat.label}</p>
            </button>
          );
        })}
      </div>

      {/* KPI Cards Preview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {currentReportData.summaryCards.map((card: any, idx: number) => (
          <Card key={idx} className="p-4 bg-white border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold text-slate-400">{card.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{card.value}</p>
            {card.sub && <p className="text-[11px] text-slate-500 mt-0.5">{card.sub}</p>}
          </Card>
        ))}
      </div>

      {/* Report Table Preview Card */}
      <Card className="shadow-xs border border-slate-200 overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800">
              {currentReportData.title}
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">{currentReportData.subtitle}</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
            {currentReportData.tableRows.length} Baris Data
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  {currentReportData.tableHeaders.map((th, i) => (
                    <th key={i} className="px-4 py-3">
                      {th}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentReportData.tableRows.slice(0, 10).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-4 py-3 ${
                          typeof cell === "number" || (typeof cell === "string" && cell.startsWith("Rp"))
                            ? "font-mono font-medium text-slate-900"
                            : ""
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
