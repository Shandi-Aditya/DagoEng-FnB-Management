/**
 * Domain murni AI Business Intelligence & Strategic Advisory.
 * Mengelola pemrosesan query, analisis data operasional gerai, dan perumusan rekomendasi bisnis.
 *
 * Importer:
 * - src/app/(dashboard)/ai-insight/page.tsx
 * - src/features/ai-insight/AIInsightChatContainer.tsx
 * - tests/ai-insight-domain.test.ts
 */

import { IngredientItem } from "@/types/inventory";

export interface AIChatMessage {
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

export interface AIResponseParams {
  query: string;
  outletName: string;
  totalRevenue: number;
  ordersCount: number;
  materialsCount: number;
  criticalItems: IngredientItem[];
  topProductName: string;
  areasCount: number;
  bookingsCount: number;
  leasesCount: number;
  membersCount: number;
  productsCount: number;
}

export const QUICK_PROMPTS = [
  "Berapa total omzet dan performa penjualan di outlet ini?",
  "Bagaimana status stok bahan kritis dan rekomendasi restock?",
  "Bagaimana okupansi meja dan booking ruang kerja saat ini?",
  "Analisis rata-rata nilai pesanan dan rekomendasi promosi pelanggan",
];

/**
 * Menghasilkan pesan pembuka default saat sesi konsultasi dimulai.
 */
export function createWelcomeMessage(params: {
  userName: string;
  outletName: string;
  totalRevenue: number;
  ordersCount: number;
  criticalItemsCount: number;
}): AIChatMessage {
  const nowTime = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const outlet = params.outletName?.trim() ? params.outletName : "Semua outlet";

  return {
    id: "msg-welcome",
    sender: "AI",
    timestamp: nowTime,
    systemData: [
      `Outlet: ${outlet}`,
      `Omzet: Rp ${params.totalRevenue.toLocaleString("id-ID")} dari ${params.ordersCount} pesanan`,
      `Bahan kritis atau habis: ${params.criticalItemsCount}`,
    ],
    aiAnalysis: `Halo ${params.userName}. Saya merangkum data kasir, stok, ruang kerja, dan member di ${outlet}. Ajukan pertanyaan atau pilih pertanyaan cepat di bawah.`,
    actionRecommendation: "Lihat rincian penjualan per periode di Laporan.",
    actionLabel: "Buka laporan",
    actionUrl: "/reports",
  };
}

/**
 * Menganalisis pertanyaan bisnis dan menghasilkan data aktual serta rekomendasi strategi.
 */
export function generateAIInsightResponse(params: AIResponseParams): AIChatMessage {
  const {
    query,
    outletName,
    totalRevenue,
    ordersCount,
    materialsCount,
    criticalItems,
    topProductName,
    areasCount,
    bookingsCount,
    leasesCount,
    membersCount,
    productsCount,
  } = params;

  const q = query.toLowerCase();
  const nowTime = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1. Stock / Inventory query
  if (
    q.includes("stok") ||
    q.includes("bahan") ||
    q.includes("inventory") ||
    q.includes("kritis")
  ) {
    const critList = criticalItems
      .map((m) => `${m.name} (Sisa ${m.stockNumber} ${m.unit}, Min ${m.min} ${m.unit})`)
      .join(", ");

    return {
      id: `msg-${Date.now()}`,
      sender: "AI",
      timestamp: nowTime,
      systemData: [
        `Bahan terdaftar: ${materialsCount}`,
        `Perlu dibeli: ${criticalItems.length} bahan`,
        `Prioritas: ${critList || "tidak ada, semua di atas batas minimum"}`,
      ],
      aiAnalysis:
        criticalItems.length > 0
          ? `${criticalItems.length} bahan ada di bawah batas minimum. Bahan yang habis akan membuat menu terkait tidak bisa dipesan di kasir.`
          : `Semua bahan di ${outletName} masih di atas batas minimum.`,
      actionRecommendation:
        criticalItems.length > 0
          ? "Buat PO untuk bahan prioritas, atau sesuaikan stok kalau angkanya tidak cocok dengan fisik."
          : "Lanjutkan opname rutin supaya angka stok tetap akurat.",
      actionLabel: "Buka inventori",
      actionUrl: "/inventory",
    };
  }

  // 2. Sales / Omzet / Revenue query
  if (
    q.includes("omzet") ||
    q.includes("omset") ||
    q.includes("penjualan") ||
    q.includes("revenue") ||
    q.includes("laba") ||
    q.includes("margin")
  ) {
    const aov = ordersCount > 0 ? Math.round(totalRevenue / ordersCount) : 0;

    return {
      id: `msg-${Date.now()}`,
      sender: "AI",
      timestamp: nowTime,
      systemData: [
        `Omzet: Rp ${totalRevenue.toLocaleString("id-ID")}`,
        `Pesanan: ${ordersCount}`,
        `Rata-rata per pesanan: Rp ${aov.toLocaleString("id-ID")}`,
        `Paling laris: ${topProductName}`,
      ],
      aiAnalysis: `${outletName} mencatat omzet Rp ${totalRevenue.toLocaleString("id-ID")} dari ${ordersCount} pesanan, rata-rata Rp ${aov.toLocaleString("id-ID")} per pesanan. Menu paling laris: ${topProductName}.`,
      actionRecommendation:
        "Untuk menaikkan nilai per pesanan, coba paket menu laris dengan pendamping.",
      actionLabel: "Buka menu",
      actionUrl: "/menu",
    };
  }

  // 3. Meja & Coworking space query
  if (
    q.includes("meja") ||
    q.includes("coworking") ||
    q.includes("ruang") ||
    q.includes("okupansi") ||
    q.includes("sewa")
  ) {
    return {
      id: `msg-${Date.now()}`,
      sender: "AI",
      timestamp: nowTime,
      systemData: [
        `Area meja: ${areasCount}`,
        `Booking ruang kerja aktif: ${bookingsCount}`,
        `Penyewa komersial aktif: ${leasesCount}`,
      ],
      aiAnalysis: `Ada ${bookingsCount} booking ruang kerja aktif dan ${leasesCount} penyewa komersial aktif.`,
      actionRecommendation:
        "Cek jadwal ruang hari ini dan check-in tamu yang sudah datang.",
      actionLabel: "Buka co-working",
      actionUrl: "/coworking",
    };
  }

  // 4. Default general business strategy
  return {
    id: `msg-${Date.now()}`,
    sender: "AI",
    timestamp: nowTime,
    systemData: [
      `Outlet: ${outletName}`,
      `Member terdaftar: ${membersCount}`,
      `Menu aktif: ${productsCount}`,
    ],
    aiAnalysis: `${outletName} punya ${membersCount} member dan ${productsCount} menu aktif. Coba tanyakan soal penjualan, stok, atau ruang kerja untuk angka yang lebih rinci.`,
    actionRecommendation: "Lihat member yang paling sering datang dan saldo poinnya.",
    actionLabel: "Buka pelanggan",
    actionUrl: "/customers",
  };
}
