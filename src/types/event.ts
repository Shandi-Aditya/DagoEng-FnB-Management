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
  isPaid: boolean;
  price?: number;
  posterUrl: string;
  externalRegistrationUrl?: string;
  guidelines?: string[] | string | null;
  honeypot?: string; // Anti-spam trap
}
