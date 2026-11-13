"use client";

import React from "react";
import type { CommunityEvent, EventTicketOrder } from "@/types/event";
import { OrganizerQRScannerDialog } from "@/features/events-portal/OrganizerQRScannerDialog";

export interface OrganizerQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizerEmail: string;
  selectedEventId: string;
  events: CommunityEvent[];
  bookings: EventTicketOrder[];
  onCheckInSuccess: (updatedBooking: EventTicketOrder, message: string) => void;
}

export function OrganizerQRScannerModal({
  isOpen,
  onClose,
  organizerEmail,
  selectedEventId,
  events,
  bookings,
  onCheckInSuccess,
}: OrganizerQRScannerModalProps) {
  return (
    <OrganizerQRScannerDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      organizerEmail={organizerEmail}
      selectedEventId={selectedEventId}
      events={events}
      bookings={bookings}
      onCheckInSuccess={onCheckInSuccess}
    />
  );
}
