import { isPastUnapproved } from "@/features/events-admin/events-admin-domain";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";

const DEFAULT_ORGANIZER_PERCENT = 80;
const COMMITTED_PAYOUT = new Set(["REQUESTED", "PROCESSING", "PAID"]);
const PENDING_PAYOUT = new Set(["REQUESTED", "PROCESSING"]);

export interface OrganizerEventGroups {
  /** Waiting on the organizer: a revision request or a split the admin proposed. */
  needsAction: CommunityEvent[];
  /** Submitted and waiting for the admin. */
  inReview: CommunityEvent[];
  /** Approved and not yet over, soonest first. */
  upcoming: CommunityEvent[];
  /** Over, rejected or archived, latest first. */
  past: CommunityEvent[];
}

function waitsOnOrganizer(event: CommunityEvent): boolean {
  if (event.status === "REVISION_REQUESTED") return true;
  const split = event.proposedRevenueSplit;
  return Boolean(split && split.status === "PENDING" && split.proposedBy !== "ORGANIZER");
}

const time = (iso: string): number => new Date(iso).getTime();

/** Sorts the organizer's events by what they need to do next. */
export function groupOrganizerEvents(events: readonly CommunityEvent[], now: Date): OrganizerEventGroups {
  const nowMs = now.getTime();
  const needsAction: CommunityEvent[] = [];
  const inReview: CommunityEvent[] = [];
  const upcoming: CommunityEvent[] = [];
  const past: CommunityEvent[] = [];

  for (const event of events) {
    // A submission whose date has passed can no longer be approved or fixed.
    if (isPastUnapproved(event, nowMs)) past.push(event);
    else if (waitsOnOrganizer(event)) needsAction.push(event);
    else if (event.status === "PENDING") inReview.push(event);
    else if (event.status === "APPROVED" && time(event.endDate) >= nowMs) upcoming.push(event);
    else past.push(event);
  }

  return {
    needsAction,
    inReview,
    upcoming: [...upcoming].sort((a, b) => time(a.startDate) - time(b.startDate)),
    past: [...past].sort((a, b) => time(b.startDate) - time(a.startDate)),
  };
}

/** The organizer's share of ticket sales agreed for this event. */
export function organizerSharePercent(event: CommunityEvent): number {
  if (typeof event.organizerFeePercent === "number") return event.organizerFeePercent;
  if (typeof event.customPlatformFeePercent === "number") return 100 - event.customPlatformFeePercent;
  return DEFAULT_ORGANIZER_PERCENT;
}

export interface EventBalanceRow {
  eventId: string;
  title: string;
  sharePercent: number;
  gross: number;
  earnings: number;
  paidOut: number;
  pending: number;
  available: number;
}

export interface EventBalanceTotals {
  gross: number;
  earnings: number;
  paidOut: number;
  pending: number;
  available: number;
}

/**
 * What each event earned the organizer from paid tickets (the amount recorded on the ticket, so the
 * split in force when it was sold), and what is left after payouts already requested or paid.
 */
export function eventBalances(
  events: readonly CommunityEvent[],
  bookings: readonly EventTicketOrder[],
): { rows: EventBalanceRow[]; totals: EventBalanceTotals } {
  const rows = events.map((event): EventBalanceRow => {
    const paid = bookings.filter((b) => b.eventId === event.id && b.paymentStatus === "PAID");
    const gross = paid.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const earnings = paid.reduce((sum, b) => sum + (b.organizerRevenueAmount || 0), 0);
    const history = event.payoutHistory ?? [];
    const committed = history.filter((p) => COMMITTED_PAYOUT.has(p.status)).reduce((s, p) => s + p.amount, 0);
    const pending = history.filter((p) => PENDING_PAYOUT.has(p.status)).reduce((s, p) => s + p.amount, 0);
    const paidOut = history.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
    return {
      eventId: event.id,
      title: event.title,
      sharePercent: organizerSharePercent(event),
      gross,
      earnings,
      paidOut,
      pending,
      available: Math.max(0, earnings - committed),
    };
  });

  const totals = rows.reduce<EventBalanceTotals>(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      earnings: acc.earnings + r.earnings,
      paidOut: acc.paidOut + r.paidOut,
      pending: acc.pending + r.pending,
      available: acc.available + r.available,
    }),
    { gross: 0, earnings: 0, paidOut: 0, pending: 0, available: 0 },
  );

  return { rows, totals };
}

/** Guests already through the door for one event, counted per ticket seat. */
export function checkedInGuests(eventId: string, bookings: readonly EventTicketOrder[]): number {
  return bookings
    .filter((b) => b.eventId === eventId && b.paymentStatus === "PAID")
    .reduce((sum, b) => {
      if (typeof b.checkedInQty === "number") return sum + b.checkedInQty;
      return sum + (b.checkInStatus === "CHECKED_IN" ? b.ticketCount : 0);
    }, 0);
}

/** What the organizer has to do for an event in "needs action". */
export function pendingAction(event: CommunityEvent): "revision" | "split" | null {
  if (event.status === "REVISION_REQUESTED") return "revision";
  return waitsOnOrganizer(event) ? "split" : null;
}
