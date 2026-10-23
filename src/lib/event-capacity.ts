import { CommunityEvent } from "@/types/event";

export type VenueCapacitySource =
  | "ORGANIZER_SPECIFIED"
  | "COWORKING_FACILITY_SPEC"
  | "UNCONFIRMED_ESTIMATE";

export interface VenueCapacityResolution {
  capacity: number;
  isConfirmed: boolean;
  source: VenueCapacitySource;
  sourceType: VenueCapacitySource;
  sourceDescription: string;
}

/**
 * Resolves venue seating capacity and traces data origin.
 * IMPORTANT AUDIT COMPLIANCE:
 * - Only coworking meeting rooms (Seminyak: 6, Ubud: 12) have confirmed specs in codebase.
 * - Public hub venues (Amphitheater, Main Hall, Tech Lab, Maker Space) do not have official database tables yet.
 *   They are explicitly flagged as UNCONFIRMED_ESTIMATE so assumed numbers are never treated as facts.
 */
export function resolveVenueCapacity(
  eventOrLocation: string | Pick<CommunityEvent, "location" | "maxCapacity">,
  explicitMaxCapacity?: number
): VenueCapacityResolution {
  const location =
    typeof eventOrLocation === "string" ? eventOrLocation : eventOrLocation.location;
  const maxCapacity =
    typeof eventOrLocation === "string"
      ? explicitMaxCapacity
      : eventOrLocation.maxCapacity ?? explicitMaxCapacity;

  // 1. Explicit quota specified by organizer or hub curator
  if (typeof maxCapacity === "number" && maxCapacity > 0) {
    return {
      capacity: maxCapacity,
      isConfirmed: true,
      source: "ORGANIZER_SPECIFIED",
      sourceType: "ORGANIZER_SPECIFIED",
      sourceDescription: "Kuota tiket ditentukan secara definitif oleh penyelenggara/admin pada formulir event.",
    };
  }

  const loc = (location || "").toLowerCase();

  // 2. Confirmed facility specifications from Coworking Module (src/features/coworking/coworking-data.ts)
  if (loc.includes("boardroom") || (loc.includes("meeting") && loc.includes("12"))) {
    return {
      capacity: 12,
      isConfirmed: true,
      source: "COWORKING_FACILITY_SPEC",
      sourceType: "COWORKING_FACILITY_SPEC",
      sourceDescription: "Berdasarkan spesifikasi fasilitas resmi Boardroom Ubud (12 Pax).",
    };
  }
  if (loc.includes("seminyak") || (loc.includes("meeting") && loc.includes("6"))) {
    return {
      capacity: 6,
      isConfirmed: true,
      source: "COWORKING_FACILITY_SPEC",
      sourceType: "COWORKING_FACILITY_SPEC",
      sourceDescription: "Berdasarkan spesifikasi fasilitas resmi Meeting Room Seminyak (6 Pax).",
    };
  }

  // 3. Unconfirmed Public Hub Venues (Estimates only - NOT yet confirmed by official hub master configuration)
  let estimatedCap = 50;
  if (loc.includes("main hall")) estimatedCap = 120;
  else if (loc.includes("amphitheater")) estimatedCap = 80;
  else if (loc.includes("tech lab")) estimatedCap = 35;
  else if (loc.includes("maker space") || loc.includes("maker")) estimatedCap = 25;

  return {
    capacity: estimatedCap,
    isConfirmed: false,
    source: "UNCONFIRMED_ESTIMATE",
    sourceType: "UNCONFIRMED_ESTIMATE",
    sourceDescription: `Kapasitas fisik belum memiliki master data resmi (belum dikonfirmasi di database, estimasi default operasional sementara: ${estimatedCap} pax).`,
  };
}

/**
 * Returns the maximum seating/ticket capacity for an event.
 * Uses event.maxCapacity if specified, otherwise matches venue name or defaults to 50.
 */
export function getEventCapacity(event: Pick<CommunityEvent, "location" | "maxCapacity">): number {
  return resolveVenueCapacity(event).capacity;
}
