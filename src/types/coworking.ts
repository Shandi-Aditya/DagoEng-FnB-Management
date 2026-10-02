export type SpaceType = "HOT_DESK" | "DEDICATED_DESK" | "MEETING_ROOM" | "PRIVATE_POD";
export type SpaceStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

export interface CoworkingSpaceItem {
  id: string;
  name: string;
  type: SpaceType;
  area: "Ground Floor Main" | "Mezzanine Quiet Zone" | "VIP Meeting Wing";
  capacity: number;
  hourlyRate: number;
  dailyRate: number;
  monthlyRate?: number;
  status: SpaceStatus;
  amenities: string[];
  currentSession?: {
    guestName: string;
    company?: string;
    checkInTime: string;
    endTime: string;
    bookingCode: string;
  };
}

export type CoworkingSpace = CoworkingSpaceItem;

export interface CoworkingMember {
  id: string;
  memberId: string;
  name: string;
  contact: string;
  email: string;
  packageName: string;
  startDate: string;
  expiryDate: string;
  status: "ACTIVE" | "EXPIRED";
  totalSpent: number;
}

export interface CoworkingBooking {
  id: string;
  bookingCode: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  company?: string;
  spaceId: string;
  spaceName: string;
  spaceType: SpaceType;
  bookingType: "HOURLY" | "DAILY" | "MONTHLY";
  date: string;
  startTime: string;
  duration: number; // in hours or days
  totalAmount: number;
  paymentStatus: "PAID" | "PENDING";
  checkInStatus: "RESERVED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED";
  fnbVoucherApplied?: string;
  notes?: string;
}

export interface CoworkingMembershipPlan {
  id: string;
  name: string;
  priceFormatted: string;
  priceNumber: number;
  billingCycle: "Harian" | "Bulanan" | "Paket 10 Hari";
  popular?: boolean;
  color: string;
  deskAccess: string;
  meetingCredits: string;
  fnbPerk: string; // Cross-business F&B discount integration
  fnbVoucherCode: string;
  amenities: string[];
}

export interface VirtualOfficeApplication {
  id: string;
  registrationNumber: string;
  companyName: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string;
  planName: "VO Starter (Alamat Bisnis)" | "VO Professional (Alamat + Kuota Meeting)" | "VO Enterprise (Lengkap + Domisili)";
  businessType: string;
  startDate: string;
  expiryDate: string;
  legalDocumentName: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "EXPIRED" | "REJECTED";
  annualFee: number;
  paymentStatus: "PAID" | "PENDING";
  domicileLetterIssued: boolean;
  notes?: string;
}
