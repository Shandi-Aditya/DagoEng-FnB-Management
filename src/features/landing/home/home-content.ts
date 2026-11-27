/**
 * Copy and pictures for the Ink landing page. Facts (prices, partner kitchens, address, hours)
 * are derived from the catalog sources so landing copy stays aligned with operational modules.
 */
import { DAGO_SPACES } from "@/features/coworking/coworking-data";
import { CONTACT } from "@/features/landing/landing-content";
import {
  type LandingWorkspaceRow,
  selectLandingFeaturedProducts,
  selectLandingKitchens,
  selectLandingWorkspaces,
} from "@/features/landing/landing-logic";
import { OFFICIAL_CS_DISPLAY_PHONE, buildOfficialCsWhatsAppUrl } from "@/lib/contact-config";
import { INITIAL_PRODUCTS } from "@/lib/master-data-defaults";
import { SEED_FNB_TENANTS } from "@/lib/sync-domains/config-spec";

export const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/#kerja", label: "Ruang kerja" },
  { href: "/#makan", label: "Makan" },
  { href: "/#event", label: "Event" },
];

export const HOURS = "Senin sampai Jumat, 09.00 sampai 18.00 WITA";
export const ADDRESS_SHORT = "Jl. Teleng No. 1, Banyuasri";
export const ADDRESS = CONTACT.address;
export const INSTAGRAM = {
  handle: CONTACT.instagram.label,
  url: CONTACT.instagram.href,
};
export const WHATSAPP_DISPLAY = OFFICIAL_CS_DISPLAY_PHONE;
export const WHATSAPP_URL = buildOfficialCsWhatsAppUrl();
export const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.address)}`;

export const WORKSPACES: readonly LandingWorkspaceRow[] = selectLandingWorkspaces(DAGO_SPACES);

export const KITCHENS: readonly string[] = selectLandingKitchens(SEED_FNB_TENANTS);

export const SAMPLE_PRICES: readonly { name: string; price: string }[] =
  selectLandingFeaturedProducts(INITIAL_PRODUCTS);

export const WORK_FEATURES: readonly string[] = [
  ...WORKSPACES.map((space) => space.name),
  "Internet fiber",
  "Smart TV",
  "Paket mingguan & bulanan",
  "Pesan dari ponsel",
];

export const FOOD_FEATURES: readonly string[] = KITCHENS;

export const EVENT_FEATURES: readonly string[] = [
  "Tiket online",
  "Kelola pembayaran",
  "Check-in QR",
  "Kelola event",
  "Ajukan event",
];

export type PartnerRoleId = "kitchen" | "tenant" | "organizer" | "staff";

/** Who works inside the hub and what the shared system gives each of them. Every line is an existing module. */
export const PARTNER_ROLES: readonly { id: PartnerRoleId; title: string; line: string }[] = [
  { id: "kitchen", title: "Dapur mitra", line: "Pesanan dari kasir dan QR meja masuk ke layar dapur Anda, lengkap dengan resep dan stok bahan." },
  { id: "tenant", title: "Tenant komersial", line: "Kontrak sewa, tagihan, dan pembayaran unit Anda tercatat di satu tempat." },
  { id: "organizer", title: "Penyelenggara event", line: "Ajukan event, jual tiket, dan check-in peserta dengan QR." },
  { id: "staff", title: "Staf dan kasir", line: "Kasir, buka tutup shift, dan meja dalam satu aplikasi." },
];

export interface LibraryPhoto {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  /** What the hub's own photograph for this slot should show. */
  wanted: string;
  credit: { author: string; href: string; license: string };
}

export const HERO_PHOTO: LibraryPhoto = {
  src: "/images/events/coworking1.jpeg",
  srcSet: "/images/events/coworking1.jpeg",
  width: 2560,
  height: 1706,
  alt: "Ruang kerja Dago Creative Hub dengan meja bersama, kursi ergonomis, dan jendela besar",
  wanted: "Ruang kerja Dago Creative Hub di siang hari, meja bersama terisi orang yang bekerja",
  credit: { author: "Dago Creative Hub", href: "", license: "Dokumentasi internal" },
};

export const FOOD_PHOTO: LibraryPhoto = {
  src: "/images/fnb.jpg",
  srcSet: "/images/fnb.jpg",
  width: 1000,
  height: 667,
  alt: "Area kuliner dan dapur mitra Dago Creative Hub",
  wanted: "Bar Kopi Senja atau satu hidangan dari dapur mitra, difoto dekat",
  credit: { author: "Dago Creative Hub", href: "", license: "Dokumentasi internal" },
};

export const EVENT_PHOTO: LibraryPhoto = {
  src: "/images/events/sunny-go-happy-hours.jpg",
  srcSet: "/images/events/sunny-go-happy-hours.jpg",
  width: 1200,
  height: 800,
  alt: "Peserta event komunitas di Dago Creative Hub",
  wanted: "Suasana workshop atau kegiatan komunitas di Dago Creative Hub",
  credit: { author: "Dago Creative Hub", href: "", license: "Dokumentasi internal" },
};
