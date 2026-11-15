/** Static copy for the public landing page. Kept apart from markup so sections stay small. */

export interface LandingNavItem {
  id: string;
  label: string;
}

export interface PriceLine {
  name: string;
  price: string;
}

export interface ServiceContent {
  id: "fnb" | "coworking";
  title: string;
  description: string;
  highlights: readonly string[];
  priceCaption: string;
  prices: readonly PriceLine[];
  cta: { label: string; href: string };
}

export const LANDING_NAV: readonly LandingNavItem[] = [
  { id: "services", label: "Layanan" },
  { id: "events", label: "Event" },
  { id: "about", label: "Tentang" },
  { id: "contact", label: "Kontak" },
];

export const HERO = {
  title: "Kerja, makan, dan event di satu tempat",
  description:
    "DagoEng Creative Hub di Singaraja: kopi dan makanan dari empat mitra dapur, ruang kerja yang bisa dipesan per jam, dan event dari komunitas sekitar.",
  image: "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=1920&auto=format&fit=crop",
  imageAlt: "Ruang kerja bersama DagoEng Creative Hub",
} as const;

export const SERVICES: readonly ServiceContent[] = [
  {
    id: "fnb",
    title: "Makan dan minum",
    description:
      "Menu dari Kopi Senja, Dapur Mama, Manis Bakery, dan Warung Bu Narti. Pesan dari meja lewat QR, pesanan langsung masuk ke dapur mitra.",
    highlights: ["Pesan dari meja tanpa antre di kasir", "Struk digital dan poin member tercatat otomatis"],
    priceCaption: "Contoh harga",
    prices: [
      { name: "Kopi Senja", price: "Rp 24.000" },
      { name: "Beef bowl", price: "Rp 45.000" },
      { name: "Croissant", price: "Rp 20.000" },
    ],
    cta: { label: "Lihat menu", href: "/customer?tab=MENU" },
  },
  {
    id: "coworking",
    title: "Ruang kerja",
    description:
      "Hot desk, dedicated desk, audio pod, dan meeting room untuk sepuluh orang. Internet fiber, smart TV, dan air minum gratis.",
    highlights: ["Sewa per jam, harian, atau bulanan", "Meeting room dengan audio conference"],
    priceCaption: "Tarif per jam",
    prices: [
      { name: "Hot desk", price: "Rp 15.000" },
      { name: "Audio pod", price: "Rp 35.000" },
      { name: "Meeting room", price: "Rp 150.000" },
    ],
    cta: { label: "Pesan ruang", href: "/customer?tab=COWORKING" },
  },
];

export const ABOUT = {
  title: "Satu sistem untuk tamu, kasir, dan dapur",
  description:
    "Pesanan dari QR meja, kasir, dan reservasi ruang tercatat di sistem yang sama, jadi tamu tidak perlu mengulang pesanan dan mitra bisa melihat penjualannya sendiri.",
  points: [
    { title: "Pesanan langsung ke dapur", description: "Pesanan dari meja dikirim ke layar dapur mitra yang bersangkutan." },
    { title: "Ruang kerja yang fleksibel", description: "Dari hot desk harian sampai meeting room, dipesan dari ponsel." },
    { title: "Poin di setiap transaksi", description: "Belanja makanan dan sewa ruang sama-sama menambah poin member." },
  ],
} as const;

export const LOYALTY = {
  title: "Kumpulkan poin di setiap transaksi",
  description: "Tukar poin dengan diskon, jam co-working gratis, atau voucher. Daftar gratis dan langsung dapat 50 poin.",
  cta: { label: "Lihat program member", href: "/customer?tab=LOYALTY" },
} as const;

export const CONTACT = {
  address: "Jl. Teleng No. 1, Banyuasri, Kec. Buleleng, Kabupaten Buleleng, Bali 81116",
  hours: "Setiap hari, 08:00–22:00 WITA",
  phone: "+62 811-2233-4455",
  email: "info@dagoeng.com",
  instagram: { label: "@dagocreativehub", href: "https://www.instagram.com/dagocreativehub/" },
} as const;

export const FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: "Menu", href: "/customer?tab=MENU" },
  { label: "Ruang kerja", href: "/customer?tab=COWORKING" },
  { label: "Program member", href: "/customer?tab=LOYALTY" },
  { label: "Event komunitas", href: "/events" },
  { label: "Masuk staf", href: "/login" },
];
