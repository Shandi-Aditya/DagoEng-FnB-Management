import { ScopeLevel, BusinessModuleCode } from "@/types/auth";

export interface CommunityOrganizerProfile {
  id: string; // e.g. "org-comm-barista"
  name: string; // e.g. "Dago Barista Guild"
  category: string; // e.g. "Komunitas Barista & Kopi Spesialti"
  contactPerson: string; // PIC name
  phone: string;
  email: string; // Login account identifier
  status: "ACTIVE" | "INACTIVE";
  serviceModule: BusinessModuleCode; // usually "CO_WORKING"
  scopeLevel: ScopeLevel; // "TENANT"
  roleName: string; // "Penyelenggara Event"
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Initial Seed Organizers matching demo community accounts
export const INITIAL_ORGANIZERS: CommunityOrganizerProfile[] = [
  {
    id: "org-comm-barista",
    name: "Dago Specialty Coffee Society (Barista Guild)",
    category: "Komunitas Barista & Kopi Spesialti",
    contactPerson: "Reza Pratama",
    phone: "+62 812-9876-5432",
    email: "baristaguild@dagocreative.id",
    status: "ACTIVE",
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara Event",
    notes: "Penyelenggara resmi Latte Art Throwdown & workshop kopi berkala.",
    createdAt: "2026-01-15T08:00:00.000Z",
    updatedAt: "2026-01-15T08:00:00.000Z",
  },
  {
    id: "org-comm-bandungdev",
    name: "Bandung Game Creators Collective",
    category: "Komunitas Teknologi & Game Developer",
    contactPerson: "Fajar Nugraha",
    phone: "+62 813-1122-3344",
    email: "halo@bandungdev.org",
    status: "ACTIVE",
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara Event",
    notes: "Komunitas inkubasi developer game indie se-Bandung Raya.",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "org-comm-aksara",
    name: "Studio Aksara Priangan",
    category: "Kolektif Seni Grafis & Tipografi",
    contactPerson: "Annisa Rahma",
    phone: "+62 817-2233-4455",
    email: "info@aksarapriangan.id",
    status: "ACTIVE",
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara Event",
    notes: "Studio workshop cetak risograph dan pelestarian aksara Nusantara.",
    createdAt: "2026-02-10T11:00:00.000Z",
    updatedAt: "2026-02-10T11:00:00.000Z",
  },
  {
    id: "org-comm-dagohijau",
    name: "Dago Hijau Berkelanjutan",
    category: "Komunitas Lingkungan & Circular Economy",
    contactPerson: "Budi Hartono",
    phone: "+62 819-8877-6655",
    email: "kontak@dagohijau.id",
    status: "ACTIVE",
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara Event",
    notes: "Inisiatif sirkular ekonomi, pengelolaan sampah kafe, dan eco-walk.",
    createdAt: "2026-02-15T09:00:00.000Z",
    updatedAt: "2026-02-15T09:00:00.000Z",
  },
];
