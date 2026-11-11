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
  "Berapa total omset dan performa penjualan di outlet ini?",
  "Bagaimana status stok bahan baku kritis dan rekomendasi restock?",
  "Bagaimana okupansi meja dan booking co-working space saat ini?",
  "Analisis margin produk dan rekomendasi promosi pelanggan",
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

  return {
    id: "msg-welcome",
    sender: "AI",
    timestamp: nowTime,
    systemData: [
      `Scope Outlet Aktif: ${params.outletName}`,
      `Total Omset Transaksi: Rp ${params.totalRevenue.toLocaleString("id-ID")} (${params.ordersCount} Order)`,
      `Bahan Baku Status Kritis/Habis: ${params.criticalItemsCount} item`,
    ],
    aiAnalysis: `Halo ${params.userName}. Saya asisten AI Business Intelligence Dago Creative Hub. Saya menganalisis data operasional kasir, stok gudang, ruang coworking, tenant sewa, dan retensi loyalty secara langsung untuk gerai ${params.outletName}. Ajukan pertanyaan bisnis Anda atau gunakan pilihan cepat di bawah.`,
    actionRecommendation: "Tinjau ringkasan performa harian gerai Anda.",
    actionLabel: "Buka Laporan Penjualan",
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
        `Total Bahan Terdaftar: ${materialsCount} SKU`,
        `Item Kritis / Perlu Restock: ${criticalItems.length} SKU`,
        `Item Prioritas: ${critList || "Semua stok dalam ambang batas aman"}`,
      ],
      aiAnalysis:
        criticalItems.length > 0
          ? `Terdeteksi ${criticalItems.length} bahan baku berada di bawah ambang batas minimum. Konsumsi menu utama meningkat. Jika tidak segera restock dalam 24 jam, terdapat risiko bahan baku habis saat operasional kasir.`
          : `Kondisi inventori di gerai ${outletName} berada pada level aman. Tidak ada bahan baku yang berada di bawah ambang batas minimum.`,
      actionRecommendation:
        criticalItems.length > 0
          ? "Buat Purchase Order atau lakukan penyesuaian stok manual."
          : "Pertahankan jadwal stock opname berkala.",
      actionLabel: "Kelola Stok Gudang",
      actionUrl: "/inventory",
    };
  }

  // 2. Sales / Omset / Revenue query
  if (
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
        `Akumulasi Penjualan: Rp ${totalRevenue.toLocaleString("id-ID")}`,
        `Total Volume Transaksi: ${ordersCount} Pesanan`,
        `Rata-rata Nilai Transaksi (AOV): Rp ${aov.toLocaleString("id-ID")}`,
        `Menu Utama: ${topProductName}`,
      ],
      aiAnalysis: `Performa omset di gerai ${outletName} menunjukkan kontribusi utama dari kategori produk unggulan. Margin kotor rata-rata berada pada kisaran optimal. Rekomendasi peningkatan margin difokuskan pada bundling menu minuman dengan pendamping di jam reguler.`,
      actionRecommendation:
        "Aktifkan program promo bundling pada jam operasional sore hari.",
      actionLabel: "Lihat Analisis Menu",
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
        `Area F&B Terdaftar: ${areasCount} Zona Meja`,
        `Total Booking Co-working: ${bookingsCount} Reservasi Aktif`,
        `Tenant Komersial Sewa: ${leasesCount} Tenant Aktif`,
      ],
      aiAnalysis: `Pemanfaatan ruang co-working dan lot komersial memiliki tingkat retensi yang stabil. Disarankan meninjau kapasitas ruang rapat dan jadwal reservasi untuk memastikan rotasi pelanggan berjalan lancar.`,
      actionRecommendation:
        "Tinjau ketersediaan ruang dan kelola status check-in reservasi.",
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
      `Gerai Scope: ${outletName}`,
      `Member Loyalty Terdaftar: ${membersCount} Anggota`,
      `Total SKU Menu Aktif: ${productsCount} Produk`,
    ],
    aiAnalysis: `Berdasarkan metrik menyeluruh di ${outletName}, operasional berjalan stabil. Kami menyarankan penguatan program loyalitas pelanggan untuk meningkatkan frekuensi kunjungan ulang pelanggan tetap.`,
    actionRecommendation: "Periksa daftar member loyalty dan promosi poin.",
    actionLabel: "Lihat Member Loyalty",
    actionUrl: "/customers",
  };
}
