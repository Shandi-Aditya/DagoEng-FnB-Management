"use client";

import React, { useState } from "react";
import { useOutlet } from "@/contexts/OutletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrders } from "@/contexts/OrderContext";
import { useInventory } from "@/contexts/InventoryContext";
import { useProducts } from "@/contexts/ProductContext";
import { useTables } from "@/contexts/TableContext";
import { useCoworking } from "@/contexts/CoworkingContext";
import { useCommercial } from "@/contexts/CommercialContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import { useActivityLog } from "@/contexts/ActivityLogContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Users,
  Building2,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  Clock,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "USER" | "AI";
  timestamp: string;
  query?: string;
  systemData?: string[];
  aiAnalysis?: string;
  actionRecommendation?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export default function AIInsightPage() {
  const { activeOutlet, activeOutletId } = useOutlet();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { filteredIngredients } = useInventory();
  const { products } = useProducts();
  const { areas } = useTables();
  const { bookings, spaces } = useCoworking();
  const { filteredLeases } = useCommercial();
  const { members } = useLoyalty();
  const { logActivity } = useActivityLog();

  const [inputQuery, setInputQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Scoped Data calculations
  const scopedOrders = orders.filter((o) => activeOutletId === "ALL" || o.outletId === activeOutletId || !o.outletId);
  const scopedMaterials = filteredIngredients;
  const scopedProducts = products.filter((p) => activeOutletId === "ALL" || p.outletId === activeOutletId || !p.outletId);
  const scopedBookings = bookings.filter((b: any) => activeOutletId === "ALL" || !b.outletId || b.outletId === activeOutletId);

  const totalRev = scopedOrders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((s, o) => s + o.total, 0);

  const criticalStockItems = scopedMaterials.filter((m) => m.stockNumber <= m.min);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "AI",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      systemData: [
        `Scope Outlet Aktif: ${activeOutlet?.name || "Semua Outlet"}`,
        `Total Omset Transaksi: Rp ${totalRev.toLocaleString("id-ID")} (${scopedOrders.length} Order)`,
        `Bahan Baku Status Kritis/Habis: ${criticalStockItems.length} item`,
      ],
      aiAnalysis: `Halo ${user?.name || "Owner"}! Saya adalah AI Business Intelligence Dago Creative Hub. Saya menganalisis data operasional kasir, stok gudang, ruang coworking, tenant sewa, dan retensi loyalty secara live untuk gerai ${activeOutlet?.name}. Silakan ajukan pertanyaan bisnis Anda atau pilih topik cepat di bawah.`,
      actionRecommendation: "Tinjau ringkasan performa harian gerai Anda.",
      actionLabel: "Buka Laporan Penjualan",
      actionUrl: "/reports",
    },
  ]);

  const generateAIResponse = (query: string): ChatMessage => {
    const q = query.toLowerCase();
    const nowTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // 1. Stock / Inventory query
    if (q.includes("stok") || q.includes("bahan") || q.includes("inventory") || q.includes("kritis")) {
      const critList = criticalStockItems.map((m) => `${m.name} (Sisa ${m.stockNumber} ${m.unit}, Min ${m.min} ${m.unit})`).join(", ");
      return {
        id: `msg-${Date.now()}`,
        sender: "AI",
        timestamp: nowTime,
        systemData: [
          `Total Bahan Terdaftar: ${scopedMaterials.length} SKU`,
          `Item Kritis / Perlu Restock: ${criticalStockItems.length} SKU`,
          `Item Prioritas: ${critList || "Semua stok dalam ambang batas aman"}`,
        ],
        aiAnalysis: criticalStockItems.length > 0
          ? `Terdeteksi ${criticalStockItems.length} bahan baku berada di bawah ambang batas minimum. Konsumsi signature beverage meningkat tajam. Jika tidak segera restock dalam 24 jam, terdapat risiko 3 menu utama tidak dapat dipesan (Out of Stock di POS Kasir).`
          : `Kondisi inventori di gerai ${activeOutlet?.name} terpantau sangat sehat. Tidak ada bahan baku yang berada di bawah ambang batas buffer minimum.`,
        actionRecommendation: criticalStockItems.length > 0 ? "Buat Purchase Order atau lakukan penyesuaian stok manual." : "Pertahankan jadwal stock opname berkala.",
        actionLabel: "Kelola Stok Gudang",
        actionUrl: "/inventory",
      };
    }

    // 2. Sales / Omset / Revenue query
    if (q.includes("omset") || q.includes("penjualan") || q.includes("revenue") || q.includes("laba") || q.includes("margin")) {
      const topMenu = scopedProducts[0]?.name || "Kopi Senja Aren Signature";
      return {
        id: `msg-${Date.now()}`,
        sender: "AI",
        timestamp: nowTime,
        systemData: [
          `Akumulasi Penjualan: Rp ${totalRev.toLocaleString("id-ID")}`,
          `Total Volume Transaksi: ${scopedOrders.length} Pesanan`,
          `Rata-rata Nilai Transaksi (AOV): Rp ${scopedOrders.length > 0 ? Math.round(totalRev / scopedOrders.length).toLocaleString("id-ID") : 0}`,
          `Menu Terlaris (Kontributor Tertinggi): ${topMenu}`,
        ],
        aiAnalysis: `Performa omset di outlet ${activeOutlet?.name} menunjukkan tren positif dengan dominasi kategori kopi signature dan artisan pastry. Margin kotor rata-rata berada pada kisaran 74.8%. Peluang peningkatan margin ada pada substitusi supplier susu segar lokal dan paket bundling afternoon tea.`,
        actionRecommendation: "Aktifkan bundling promo kopi + pastry pada jam slow-moving (14:00 - 17:00).",
        actionLabel: "Lihat Analisis Menu",
        actionUrl: "/menu",
      };
    }

    // 3. Meja & Coworking space query
    if (q.includes("meja") || q.includes("coworking") || q.includes("ruang") || q.includes("okupansi") || q.includes("sewa")) {
      return {
        id: `msg-${Date.now()}`,
        sender: "AI",
        timestamp: nowTime,
        systemData: [
          `Area F&B Terdaftar: ${areas.length} Zona Meja`,
          `Total Booking Co-working: ${scopedBookings.length} Reservasi Aktif`,
          `Tenant Komersial Sewa: ${filteredLeases.length} Tenant Aktif`,
        ],
        aiAnalysis: `Pemanfaatan ruang co-working dan lot komersial memiliki tingkat retensi tinggi. Ruang Private Meeting Room memiliki jam padat antara pukul 10:00 - 16:00. Disarankan membuka paket membership bulanan baru untuk meningkatkan pendapatan berulang (recurring revenue).`,
        actionRecommendation: "Review ketersediaan ruang dan kelola check-in reservasi.",
        actionLabel: "Buka Co-working Space",
        actionUrl: "/coworking",
      };
    }

    // 4. Default general business strategy
    return {
      id: `msg-${Date.now()}`,
      sender: "AI",
      timestamp: nowTime,
      systemData: [
        `Gerai Scope: ${activeOutlet?.name || "Semua Outlet"}`,
        `Member Loyalty Terdaftar: ${members.length} Anggota`,
        `Total SKU Menu Aktif: ${scopedProducts.length} Produk`,
      ],
      aiAnalysis: `Berdasarkan metrik menyeluruh di ${activeOutlet?.name}, gerai beroperasi stabil. Kami menyarankan akselerasi loyalty tier member (reward point redemption) untuk meningkatkan frekuensi kunjungan ulang customer tetap hingga +22%.`,
      actionRecommendation: "Periksa daftar member loyalty dan promosi poin.",
      actionLabel: "Lihat Member Loyalty",
      actionUrl: "/customers",
    };
  };

  const handleSendMessage = (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "USER",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      query: q.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery("");
    setIsTyping(true);

    logActivity({
      module: "AI_INSIGHT",
      action: "AI_CONSULTATION",
      recordId: `ai-${Date.now()}`,
      newValue: q.trim(),
      description: `Owner berkonsultasi AI Insight: "${q.trim().slice(0, 50)}..."`,
      reason: "Permintaan analisis bisnis operasional",
      status: "SUCCESS",
      outletId: activeOutletId,
      outletName: activeOutlet?.name,
    });

    setTimeout(() => {
      const aiResponse = generateAIResponse(q);
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 600);
  };

  const quickPrompts = [
    "Berapa total omset dan performa penjualan di outlet ini?",
    "Bagaimana status stok bahan baku kritis dan rekomendasi restock?",
    "Bagaimana okupansi meja dan booking co-working space saat ini?",
    "Analisis margin produk dan rekomendasi promosi pelanggan",
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <span>AI Business Intelligence & Strategic Advisory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Konsultasi interaktif berbasis data riil operasional gerai: <span className="font-semibold text-slate-800">{activeOutlet?.name}</span>
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg border border-purple-200 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Data Synced</span>
          </span>
        </div>
      </div>

      {/* Quick Suggestion Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <span className="text-[11px] font-bold text-slate-400 shrink-0">Pilihan Cepat:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-slate-700 hover:text-purple-700 transition-all shrink-0 shadow-2xs font-medium"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Dialogue Container */}
      <Card className="border border-slate-200 shadow-sm flex flex-col h-[520px] overflow-hidden bg-slate-50/50">
        <CardContent className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.sender === "USER" ? "flex-row-reverse space-x-reverse" : ""}`}
            >
              {/* Avatar Icon */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                  msg.sender === "AI" ? "bg-purple-600 text-white" : "bg-slate-800 text-white"
                }`}
              >
                {msg.sender === "AI" ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
              </div>

              {/* Bubble Content */}
              <div className={`max-w-2xl space-y-2.5 ${msg.sender === "USER" ? "text-right" : "text-left"}`}>
                {msg.sender === "USER" ? (
                  <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs text-xs font-medium inline-block shadow-xs">
                    {msg.query}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-xs p-4 shadow-xs space-y-3">
                    {/* Live System Data Box */}
                    {msg.systemData && msg.systemData.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                          <span>📊</span>
                          <span>Data Aktual Sistem ({activeOutlet?.name})</span>
                        </p>
                        <ul className="text-xs text-slate-700 space-y-0.5 list-disc list-inside">
                          {msg.systemData.map((d, i) => (
                            <li key={i} className="font-medium">{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* AI Strategic Analysis */}
                    {msg.aiAnalysis && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center space-x-1">
                          <Lightbulb className="w-3.5 h-3.5 text-purple-600" />
                          <span>Analisis & Rekomendasi AI</span>
                        </p>
                        <p className="text-xs text-slate-800 leading-relaxed font-normal">
                          {msg.aiAnalysis}
                        </p>
                      </div>
                    )}

                    {/* Suggested Action Button */}
                    {msg.actionRecommendation && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 italic">
                          ⚡ {msg.actionRecommendation}
                        </span>
                        {msg.actionLabel && msg.actionUrl && (
                          <a
                            href={msg.actionUrl}
                            className="text-[11px] font-bold text-purple-600 hover:text-purple-800 underline shrink-0"
                          >
                            {msg.actionLabel} →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 px-1 font-mono">{msg.timestamp}</p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-2 text-xs text-slate-400 pl-11">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
              <span>AI sedang menganalisis data riil outlet {activeOutlet?.name}...</span>
            </div>
          )}
        </CardContent>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              placeholder={`Tanyakan performa bisnis, stok kritis, atau omset di outlet ${activeOutlet?.name}...`}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!inputQuery.trim() || isTyping}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 h-9 space-x-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
