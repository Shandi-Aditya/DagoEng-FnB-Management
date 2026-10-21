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
