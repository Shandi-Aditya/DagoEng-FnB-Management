export type EventStatus =
  | "PENDING"
  | "APPROVED"
  | "REVISION_REQUESTED"
  | "REJECTED"
  | "ARCHIVED";

export type EventCategory =
  | "WORKSHOP"
  | "MEETUP"
  | "CREATIVE"
  | "COMMUNITY"
  | "TECH"
  | "SEMINAR"
  | "OTHER";

export interface CommunityEvent {
  id: string;
  title: string;
  category: EventCategory;
  description: string;
  startDate: string; // ISO 8601 string
  endDate: string; // ISO 8601 string
  location: string;
  isPaid: boolean;
  price: number; // 0 if free, nominal if paid (in IDR)
  posterUrl: string;
  externalRegistrationUrl?: string | null;
  
  // Organizer details
  organizerName: string;
  organizerEmail: string; // PRIVATE: Admin only
  organizerPhone: string; // PRIVATE: Admin only
  
  // Moderation fields
  status: EventStatus;
  adminNotes?: string | null;
  rejectionReason?: string | null;
  revisionNotes?: string | null;
  
  // Capacity & Quota
  maxCapacity?: number;
  maxTicketsPerBooking?: number; // Override batas pembelian tiket khusus event
  destinationBankId?: string | null; // Override rekening bank tujuan khusus event

  // Collaboration requirements
  collaborationFacilities?: string[] | string | null;
  collaborationPromotion?: string[] | string | null;
  collaborationNotes?: string | null;

  // Revenue sharing & negotiation
  organizerFeePercent?: number; // e.g. 80 (default 80%)
  customPlatformFeePercent?: number | null; // e.g. 20 (default 20%)
  proposedRevenueSplit?: ProposedRevenueSplit | null;
  revenueSplitHistory?: RevenueSplitAgreementHistory[];

  // Payout tracking
  payoutStatus?: OrganizerPayoutStatus;
  payoutHistory?: PayoutRecord[];

  // Guidelines & attendee instructions
  guidelines?: string[] | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export type RevenueSplitParty = "ORGANIZER" | "ADMIN" | "DAGO_ADMIN";
export type RevenueSplitNegotiationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface ProposedRevenueSplit {
  id?: string;
  organizerPercent: number; // e.g. 85
  platformPercent: number;  // e.g. 15
  proposedBy: RevenueSplitParty;
  reason?: string;
  status: RevenueSplitNegotiationStatus;
  proposedAt?: string; // ISO string
  createdAt?: string;
  counterProposal?: {
    organizerPercent: number;
    platformPercent: number;
    notes?: string;
    proposedAt: string;
  } | null;
}

export interface RevenueSplitAgreementHistory {
  id: string;
  previousOrganizerPercent: number;
  previousPlatformPercent: number;
  newOrganizerPercent?: number;
  newPlatformPercent?: number;
  agreedOrganizerPercent?: number;
  agreedPlatformPercent?: number;
  proposedBy?: RevenueSplitParty;
  reason?: string;
  approvedBy?: string;
  approvedAt?: string;
  agreedBy?: string;
  agreedAt?: string;
  effectiveDate: string; // ISO string
  notes?: string;
}

export type OrganizerPayoutStatus =
  | "UNQUALIFIED"
  | "PENDING_VERIFICATION"
  | "AVAILABLE"
  | "REQUESTED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "UNELIGIBLE";

export interface PayoutRecord {
  id: string;
  eventId?: string;
  amount: number;
  requestedAt: string;
  processedAt?: string | null;
  processedBy?: string | null;
  status: OrganizerPayoutStatus;
  referenceNo?: string | null;
  notes?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  rejectionReason?: string | null;
}

/**
 * Publicly sanitized event representation.
 * Organizer email and phone, as well as internal admin notes are stripped.
 */
export interface PublicCommunityEvent {
  id: string;
  title: string;
  category: EventCategory;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  maxCapacity?: number;
  maxTicketsPerBooking?: number;
  destinationBank?: EventBankAccountSnapshot | null;
  paymentInstructions?: string | null;
  activePaymentMethod?: "MANUAL_TRANSFER" | "DOKU_CHECKOUT";
  isPaid: boolean;
  price: number;
  posterUrl: string;
  externalRegistrationUrl?: string | null;
  organizerName: string;
  status: "APPROVED";
  guidelines?: string[] | null;
  availability?: EventTicketAvailability;
  createdAt: string;
}

export interface EventSubmissionPayload {
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  title: string;
  category: EventCategory;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  maxCapacity?: number;
  maxTicketsPerBooking?: number;
  destinationBankId?: string;
  isPaid: boolean;
  price?: number;
  posterUrl: string;
  externalRegistrationUrl?: string;
  guidelines?: string[] | string | null;
  honeypot?: string; // Anti-spam trap

  // Collaboration requirements
  collaborationFacilities?: string[] | string | null;
  collaborationPromotion?: string[] | string | null;
  collaborationNotes?: string | null;

  // Revenue sharing proposal
  proposedOrganizerPercent?: number;
  proposedPlatformPercent?: number;
  revenueSplitReason?: string;
}

export type TicketPaymentMethod = "FREE" | "QRIS" | "CASH" | "TRANSFER" | "DOKU_CHECKOUT" | "MANUAL_TRANSFER";
export type TicketPaymentStatus = "PAID" | "PENDING" | "CANCELLED" | "EXPIRED";
export type AttendeeCheckInStatus = "REGISTERED" | "PARTIALLY_CHECKED_IN" | "CHECKED_IN";

export type EventBankAccountType = "PLATFORM" | "EVENT_OVERRIDE" | "ORGANIZER";
export type EventBankAccountApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface EventBankAccountSnapshot {
  bankId?: string;
  label?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string;
  accountType?: EventBankAccountType;
}

export interface EventBankAccount {
  id: string;
  label: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string;
  badge?: string;
  isDefault: boolean;
  isActive: boolean;
  accountType: EventBankAccountType;
  eventId?: string | null;
  organizerEmail?: string | null;
  approvalStatus?: EventBankAccountApprovalStatus;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventTicketAvailability {
  totalCapacity: number;
  ticketsReserved: number;
  ticketsRemaining: number;
  occupancyRate: number;
  isConfirmed: boolean;
  capacitySource: string;
  capacityDescription: string;
  isSoldOut: boolean;
}

export interface EventTicketOrder {
  id: string; // e.g. "tkt-1729000-abc12"
  ticketCode: string; // e.g. "DAGO-EVT-93821"
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  institution?: string | null;
  ticketCount: number;
  checkedInQty?: number; // Jumlah tiket yang sudah check-in (0 <= checkedInQty <= ticketCount)
  unitPrice: number;
  totalPrice: number;
  platformFeePercent: number; // e.g. 20%
  platformFeeAmount: number;
  organizerRevenueAmount: number;
  paymentMethod: TicketPaymentMethod;
  paymentStatus: TicketPaymentStatus;
  destinationBankSnapshot?: EventBankAccountSnapshot | null;
  paymentVerificationNote?: string | null;
  paymentVerifiedAt?: string | null;
  paymentVerifiedBy?: string | null;
  paymentRejectionReason?: string | null;
  checkInStatus: AttendeeCheckInStatus;
  checkInTime?: string | null;
  dokuInvoiceNumber?: string | null;
  dokuPaymentUrl?: string | null;
  paidAt?: string | null;
  expiresAt?: string | null;
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentProofNote?: string | null;
  guestToken?: string; // High-entropy random token for secure guest access
  createdAt: string;
  updatedAt: string;
}

export interface EventBookingPayload {
  eventId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  institution?: string;
  ticketCount: number;
  paymentMethod?: TicketPaymentMethod;
  destinationBankId?: string;
  honeypot?: string;
}

export interface EventOperationalStats {
  totalEvents: number;
  approvedEvents: number;
  pendingEvents: number;
  totalAttendees: number;
  totalTicketsSold: number;
  totalTicketRevenue: number;
  platformCommissionRevenue: number;
  organizerPayoutTotal: number;
}

export interface EventBankAccountHistoryEntry {
  id: string;
  changedAt: string;
  changedBy: string;
  action: "CREATE" | "UPDATE" | "SET_DEFAULT" | "TOGGLE_ACTIVE" | "DELETE" | "APPROVE" | "REJECT";
  bankId: string;
  details: string;
}

export interface EventRevenueSharingPolicy {
  defaultPlatformFeePercent: number; // default 20 (20% DAGO Platform)
  defaultOrganizerSharePercent: number; // default 80 (80% Penyelenggara)
  minPlatformFeePercent: number; // default 0
  maxPlatformFeePercent: number; // default 100
  bookingPaymentExpiryMinutes?: number; // default 60 menit
  maxTicketsPerBooking?: number; // default 5 tiket
  activePaymentMethod?: "MANUAL_TRANSFER" | "DOKU_CHECKOUT";
  allowOrganizerBankAccounts?: boolean;
  allowEventBankOverride?: boolean;
  paymentInstructions?: string;
  allowedProofFormats?: string[];
  maxProofFileSizeMb?: number;
  bankAccounts?: EventBankAccount[];
  bankHistory?: EventBankAccountHistoryEntry[];
  effectiveDate: string; // ISO date
  policyNotes?: string;
  updatedAt?: string;
  updatedBy?: string;
  history?: Array<{
    id: string;
    changedAt: string;
    changedBy: string;
    previousPlatformFeePercent: number;
    newPlatformFeePercent: number;
    reason: string;
  }>;
}

export const DEFAULT_EVENT_BANK_ACCOUNTS: EventBankAccount[] = [
  {
    id: "bank-bca-plat",
    label: "BCA Platform Utama",
    bankName: "BCA (Bank Central Asia)",
    accountNumber: "1420993821",
    accountHolder: "PT DAGO CREATIVE HUB",
    branch: "KCU Dago Bandung",
    badge: "Utama / Rekomendasi",
    isDefault: true,
    isActive: true,
    accountType: "PLATFORM",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "bank-mandiri-plat",
    label: "Mandiri Platform",
    bankName: "Bank Mandiri",
    accountNumber: "1300098234120",
    accountHolder: "PT DAGO CREATIVE HUB",
    branch: "KC Bandung Surapati",
    badge: "Bebas Biaya Admin",
    isDefault: false,
    isActive: true,
    accountType: "PLATFORM",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "bank-bri-plat",
    label: "BRI Platform",
    bankName: "Bank BRI",
    accountNumber: "034101000928301",
    accountHolder: "PT DAGO CREATIVE HUB",
    branch: "KC Dago Bandung",
    badge: "Jaringan Luas",
    isDefault: false,
    isActive: true,
    accountType: "PLATFORM",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

export const DEFAULT_EVENT_POLICY: EventRevenueSharingPolicy = {
  defaultPlatformFeePercent: 20,
  defaultOrganizerSharePercent: 80,
  minPlatformFeePercent: 0,
  maxPlatformFeePercent: 100,
  bookingPaymentExpiryMinutes: 60,
  maxTicketsPerBooking: 5,
  activePaymentMethod: "MANUAL_TRANSFER",
  allowOrganizerBankAccounts: true,
  allowEventBankOverride: true,
  paymentInstructions: "Silakan transfer tepat sesuai total nominal ke rekening resmi Dago Creative Hub. Setelah transfer, unggah foto bukti struk/screenshot transfer Anda pada halaman tiket untuk diverifikasi oleh tim admin.",
  allowedProofFormats: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  maxProofFileSizeMb: 5,
  bankAccounts: DEFAULT_EVENT_BANK_ACCOUNTS,
  bankHistory: [
    {
      id: "bhist-init-2026",
      changedAt: "2026-01-01T00:00:00.000Z",
      changedBy: "Platform Super Admin",
      action: "SET_DEFAULT",
      bankId: "bank-bca-plat",
      details: "Inisialisasi rekening bank default BCA (PT DAGO CREATIVE HUB - 1420993821)",
    },
  ],
  effectiveDate: "2026-01-01T00:00:00.000Z",
  policyNotes: "Kebijakan komisi standar platform DAGO Creative Hub (20% Platform / 80% Penyelenggara Komunitas).",
  history: [
    {
      id: "hist-init-2026",
      changedAt: "2026-01-01T00:00:00.000Z",
      changedBy: "Platform Super Admin",
      previousPlatformFeePercent: 20,
      newPlatformFeePercent: 20,
      reason: "Inisialisasi kebijakan bagi hasil awal Dago Creative Hub.",
    },
  ],
};

export interface OrganizerPortalSummary {
  organizerEmail: string;
  organizerName: string;
  totalEvents: number;
  approvedEvents: number;
  pendingEvents: number;
  revisionEvents: number;
  totalAttendees: number;
  totalTicketsSold: number;
  grossRevenue: number;
  eligibleRevenue?: number;
  platformFeeAmount: number;
  organizerPayoutAmount: number; // calculated according to agreed split
  availablePayoutAmount?: number;
  requestedPayoutAmount?: number;
  paidPayoutAmount?: number;
  payoutStatus?: OrganizerPayoutStatus;
}

export interface AccessibleCommunitySummary {
  id: string;
  name: string;
  email: string;
  category?: string;
}

export interface OrganizerPortalData {
  summary: OrganizerPortalSummary;
  events: CommunityEvent[];
  bookings: EventTicketOrder[];
  organizerEmail?: string;
  isAdmin?: boolean;
  accessibleCommunities?: AccessibleCommunitySummary[];
}
