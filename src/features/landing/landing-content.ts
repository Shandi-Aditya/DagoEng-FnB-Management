/** Static copy for the public landing page. Kept apart from markup so sections stay small. */

import { DAGO_SPACES } from "@/features/coworking/coworking-data";
import { OFFICIAL_CS_DISPLAY_PHONE, OFFICIAL_HUB_ADDRESS } from "@/lib/contact-config";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import { SEED_FNB_TENANTS } from "@/lib/sync-domains/config-spec";

import {
  selectLandingFeaturedProducts,
  selectLandingKitchens,
  selectLandingWorkspaces,
} from "./landing-logic";

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

const fnbSampleProducts: PriceLine[] = selectLandingFeaturedProducts(INITIAL_PRODUCTS);

const activeKitchenList = selectLandingKitchens(SEED_FNB_TENANTS);

export const SERVICES: readonly ServiceContent[] = [
  {
    id: "fnb",
    title: "Makan dan minum",
    description: `Menu dari ${activeKitchenList.join(", ")}. Pesan dari meja lewat QR, pesanan langsung masuk ke dapur mitra.`,
    highlights: ["Pesan dari meja tanpa antre di kasir", "Struk digital dan poin member tercatat otomatis"],
    priceCaption: "Contoh harga",
    prices: fnbSampleProducts,
    cta: { label: "Lihat menu", href: "/customer?tab=MENU" },
  },
  {
    id: "coworking",
    title: "Ruang kerja",
    description:
      "Open Space, Space Monitor, Small Meeting Room (6 orang), dan Large Meeting Room (12 orang). Internet fiber, Smart TV, dan audio conference.",
    highlights: [
      "Sewa per jam, paket 2–8 jam, atau membership mingguan & bulanan",
      "Small & Large Meeting Room dengan Smart TV dan audio conference",
    ],
    priceCaption: "Tarif per jam",
    prices: selectLandingWorkspaces(DAGO_SPACES).map(({ name, price }) => ({ name, price })),
    cta: { label: "Pesan ruang", href: "/customer?tab=COWORKING" },
  },
];

export const ABOUT = {
  title: "Satu sistem untuk tamu, kasir, dan dapur",
  description:
    "Pesanan dari QR meja, kasir, dan reservasi ruang tercatat di sistem yang sama, jadi tamu tidak perlu mengulang pesanan dan mitra bisa melihat penjualannya sendiri.",
  points: [
    { title: "Pesanan langsung ke dapur", description: "Pesanan dari meja dikirim ke layar dapur mitra yang bersangkutan." },
    { title: "Ruang kerja yang fleksibel", description: "Dari Open Space per jam sampai Large Meeting Room, dipesan dari ponsel." },
    { title: "Poin di setiap transaksi", description: "Belanja makanan dan sewa ruang sama-sama menambah poin member." },
  ],
} as const;

export const LOYALTY = {
  title: "Kumpulkan poin di setiap transaksi",
  description: "Tukar poin dengan diskon, jam co-working gratis, atau voucher. Daftar gratis dan langsung dapat 50 poin.",
  cta: { label: "Lihat program member", href: "/customer?tab=LOYALTY" },
} as const;

export const CONTACT = {
  address: OFFICIAL_HUB_ADDRESS,
  hours: "Senin sampai Jumat, 09.00 sampai 18.00 WITA",
  phone: OFFICIAL_CS_DISPLAY_PHONE,
  instagram: { label: "@dagocreativehub", href: "https://www.instagram.com/dagocreativehub/" },
} as const;

export const FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: "Menu", href: "/customer?tab=MENU" },
  { label: "Ruang kerja", href: "/customer?tab=COWORKING" },
  { label: "Program member", href: "/customer?tab=LOYALTY" },
  { label: "Event komunitas", href: "/events" },
  { label: "Masuk staf", href: "/login" },
];
