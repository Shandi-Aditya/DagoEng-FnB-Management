"use client";

import Link from "next/link";
import { ArrowRight, Calendar, ExternalLink, QrCode, Ticket, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyIDR } from "@/lib/utils";
import type { EventTicketOrder } from "@/types/event";

export interface CustomerProfileTabProps {
  member: any;
  user: any;
  myEventTickets: EventTicketOrder[];
  onOpenTicketPass: (ticket: EventTicketOrder) => void;
  onOpenOrganizerOnboarding?: () => void;
}

export function CustomerProfileTab({
  member,
  user,
  myEventTickets,
  onOpenTicketPass,
  onOpenOrganizerOnboarding,
}: CustomerProfileTabProps) {
  const isOrganizer = user?.role?.slug === "COMMUNITY_ORGANIZER" || user?.role?.slug === "ORGANIZER";
  const memberCode = member?.phone || member?.email || user?.phone || "MEMBER-DAGO";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Kartu Digital Member dengan QR Code */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{member?.tier || "Bronze"}</Badge>
              <span className="text-xs text-muted-foreground">Kartu Member Digital</span>
            </div>
            <CardTitle className="text-xl font-medium">{member?.name || user?.name || "Tamu Member"}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono">{member?.phone || user?.phone || "—"}</p>
            <p className="text-xs text-muted-foreground">{member?.email || user?.email || "—"}</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="font-mono text-2xl font-medium text-foreground tabular-nums">
                {member?.points || 0}
              </span>
              <span className="text-xs text-muted-foreground">poin loyalty</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-3.5 shadow-xs">
            <QRCodeSVG value={memberCode} size={130} level="M" />
            <span className="font-mono text-xs text-muted-foreground font-medium">
              {memberCode}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Status Penyelenggara Event Komunitas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Penyelenggara event komunitas</CardTitle>
            {isOrganizer ? (
              <Badge variant="default">Penyelenggara aktif</Badge>
            ) : (
              <Badge variant="outline">Member umum</Badge>
            )}
          </div>
          <CardDescription>
            {isOrganizer
              ? "Akun Anda terhubung sebagai penyelenggara event di Dago Creative Hub."
              : "Daftarkan komunitas Anda untuk membuat dan mempublikasikan event di hub kami."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isOrganizer ? (
            <Button
              size="sm"
              render={<Link href="/events/portal" />}
              nativeButton={false}
            >
              <span>Buka portal penyelenggara</span>
              <ExternalLink />
            </Button>
          ) : onOpenOrganizerOnboarding ? (
            <Button size="sm" variant="outline" onClick={onOpenOrganizerOnboarding}>
              <span>Daftar jadi penyelenggara</span>
              <ArrowRight />
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Tiket Event Saya */}
      {myEventTickets.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Tiket event saya ({myEventTickets.length})</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myEventTickets.map((ticket) => (
              <Card key={ticket.id} className="flex flex-col justify-between">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-foreground">{ticket.ticketCode}</span>
                    <Badge variant={ticket.paymentStatus === "PAID" ? "default" : "secondary"}>
                      {ticket.paymentStatus === "PAID" ? "Lunas" : "Menunggu"}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-medium mt-1">{ticket.eventTitle}</CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(ticket.eventDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })} · {ticket.eventLocation}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-1 flex items-center justify-between border-t mt-2">
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    {ticket.ticketCount || 1} tiket · {formatCurrencyIDR(ticket.totalPrice)}
                  </span>
                  <Button type="button" size="sm" onClick={() => onOpenTicketPass(ticket)}>
                    <Ticket />
                    <span>Lihat tiket</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
