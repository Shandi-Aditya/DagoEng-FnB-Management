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

  // Revenue sharing override (Admin only)
  customPlatformFeePercent?: number | null;

  // Guidelines & attendee instructions
  guidelines?: string[] | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
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
  isPaid: boolean;
  price: number;
  posterUrl: string;
  externalRegistrationUrl?: string | null;
  organizerName: string;
  status: "APPROVED";
  guidelines?: string[] | null;
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
  isPaid: boolean;
  price?: number;
  posterUrl: string;
  externalRegistrationUrl?: string;
  guidelines?: string[] | string | null;
  honeypot?: string; // Anti-spam trap
}

export type TicketPaymentMethod = "FREE" | "QRIS" | "CASH" | "TRANSFER";
export type TicketPaymentStatus = "PAID" | "PENDING" | "CANCELLED";
export type AttendeeCheckInStatus = "REGISTERED" | "CHECKED_IN";

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
  unitPrice: number;
  totalPrice: number;
  platformFeePercent: number; // e.g. 20%
  platformFeeAmount: number;
  organizerRevenueAmount: number;
  paymentMethod: TicketPaymentMethod;
  paymentStatus: TicketPaymentStatus;
  checkInStatus: AttendeeCheckInStatus;
  checkInTime?: string | null;
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

export interface EventRevenueSharingPolicy {
  defaultPlatformFeePercent: number; // default 20 (20% DAGO Platform)
  defaultOrganizerSharePercent: number; // default 80 (80% Penyelenggara)
  minPlatformFeePercent: number; // default 0
  maxPlatformFeePercent: number; // default 100
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

export const DEFAULT_EVENT_POLICY: EventRevenueSharingPolicy = {
  defaultPlatformFeePercent: 20,
  defaultOrganizerSharePercent: 80,
  minPlatformFeePercent: 0,
  maxPlatformFeePercent: 100,
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
  platformFeeAmount: number;
  organizerPayoutAmount: number; // 80% payout
}

export interface OrganizerPortalData {
  summary: OrganizerPortalSummary;
  events: CommunityEvent[];
  bookings: EventTicketOrder[];
}
