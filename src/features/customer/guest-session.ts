import type { CoworkingBooking } from "@/types/coworking";
import type { OrderRecord } from "@/types/order";

/** Who the visitor is on the customer app: a member account or a guest who left a phone at checkout. */
export interface GuestIdentity {
  phone?: string;
  name?: string;
}

const TABLE_PATTERN = /^[A-Z0-9]{1,6}(-[A-Z0-9]{1,6})?$/;

/** One comparable form for Indonesian phone numbers: digits only, leading 62 turned into 0. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
}

function samePhone(a: string | undefined, b: string | undefined): boolean {
  const left = normalizePhone(a);
  return left !== "" && left === normalizePhone(b);
}

/**
 * Orders that belong to this visitor. Matched by phone only: matching by name showed one guest
 * another guest's orders whenever two people shared a first name. Orders without a phone are not shown.
 */
export function filterGuestOrders(orders: readonly OrderRecord[], guest: GuestIdentity): OrderRecord[] {
  return orders.filter((order) => samePhone(order.customerPhone, guest.phone));
}

/** Co-working bookings that belong to this visitor, matched by the booking's guest phone. */
export function filterGuestBookings(bookings: readonly CoworkingBooking[], guest: GuestIdentity): CoworkingBooking[] {
  return bookings.filter((booking) => samePhone(booking.guestPhone, guest.phone));
}

/**
 * The table from a QR link (`/customer?meja=T-04`). Accepts only a well-formed code, and when the
 * outlet's tables are known, only one of them. Returns the code in its canonical upper-case form.
 */
export function parseTableParam(raw: string | null | undefined, knownTables: readonly string[]): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  if (!TABLE_PATTERN.test(code)) return null;
  if (knownTables.length === 0) return code;
  return knownTables.find((table) => table.toUpperCase() === code) ?? null;
}
