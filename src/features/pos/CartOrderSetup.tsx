"use client";

import { Building2, Crown, Ticket, Users, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isTableSelectableForPos } from "@/contexts/TableContext";
import { getTodayWitaDateString } from "@/features/coworking/coworking-domain";
import {
  checkSlotAvailability,
  COWORKING_TIME_SLOTS,
  getValidOperationalTime,
  isSlotPast,
} from "@/features/pos/pos-coworking";
import type { CoworkingBooking, CoworkingSpaceItem } from "@/types/coworking";
import type { CorporateBillingType, CorporateOrderDraft } from "@/types/order";
import { DEFAULT_CORPORATE_DRAFT } from "@/types/order";

export type PosOrderType = "DINE_IN" | "TAKEAWAY";

export interface TableAreaOption {
  id: string;
  name: string;
  outletName?: string;
  tables: {
    id: string;
    number?: string;
    cap?: number;
    status: string;
    area?: string;
    customer?: string;
    total?: string;
    activeOrderId?: string;
    paymentStatus?: string;
    currentBillTotal?: number;
  }[];
}

export interface MemberOption {
  id: string;
  name: string;
  tier: string;
  points: number;
}

interface CartOrderSetupProps {
  orderType: PosOrderType;
  onOrderTypeChange: (type: PosOrderType) => void;
  areas: readonly TableAreaOption[];
  availableTableCount: number;
  selectedTable: string;
  onTableChange: (table: string) => void;
  members: readonly MemberOption[];
  selectedMember: MemberOption | null;
  onMemberChange: (memberId: string) => void;
  appliedVoucherTitle: string | null;
  onOpenVouchers: () => void;
  onRemoveVoucher: () => void;
  orderNotes?: string;
  onOrderNotesChange?: (notes: string) => void;
  // Unified Corporate Order Props
  corporateDraft?: CorporateOrderDraft;
  onCorporateDraftChange?: (draft: CorporateOrderDraft) => void;
  meetingRooms?: { id: string; name: string; hourlyRate: number; capacity?: number }[];
  onSelectedMeetingRoomChange?: (roomId: string) => void;
  coworkingBookings?: CoworkingBooking[];
  coworkingSpaces?: CoworkingSpaceItem[];
}

/** Who the order is for: dine in table or takeaway, plus the loyalty member. */
export function CartOrderSetup({
  orderType,
  onOrderTypeChange,
  areas,
  availableTableCount,
  selectedTable,
  onTableChange,
  members,
  selectedMember,
  onMemberChange,
  appliedVoucherTitle,
  onOpenVouchers,
  onRemoveVoucher,
  orderNotes,
  onOrderNotesChange,
  corporateDraft = DEFAULT_CORPORATE_DRAFT,
  onCorporateDraftChange,
  meetingRooms = [],
  onSelectedMeetingRoomChange,
  coworkingBookings = [],
  coworkingSpaces = [],
}: CartOrderSetupProps) {
  const isCorporateOrder = corporateDraft.enabled;
  const companyName = corporateDraft.companyName;
  const picName = corporateDraft.picName;
  const picPhone = corporateDraft.picPhone;
  const headcount = corporateDraft.headcount;
  const billingType = corporateDraft.billingType;
  const selectedMeetingRoomId = corporateDraft.meetingRoomId || "";

  const todayWita = getTodayWitaDateString();
  const meetingBookingDate = corporateDraft.meetingBookingDate || todayWita;
  const meetingStartTime = corporateDraft.meetingStartTime || getValidOperationalTime(meetingBookingDate);
  const meetingDurationHours = corporateDraft.meetingDurationHours || 1;

  const updateDraft = (patch: Partial<CorporateOrderDraft>) => {
    onCorporateDraftChange?.({ ...corporateDraft, ...patch });
  };
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={orderType} onValueChange={(value) => onOrderTypeChange(value as PosOrderType)}>
        <TabsList className="w-full">
          <TabsTrigger value="DINE_IN">Dine in</TabsTrigger>
          <TabsTrigger value="TAKEAWAY">Takeaway</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {orderType === "DINE_IN" ? (
          <Field className="min-w-0 gap-1">
            <FieldLabel htmlFor="pos-table" className="justify-between">
              Meja
              <span className="font-normal text-muted-foreground tabular-nums">{availableTableCount} kosong</span>
            </FieldLabel>
            {availableTableCount === 0 ? (
              <p className="text-xs text-destructive">Semua meja terisi.</p>
            ) : (
              <NativeSelect id="pos-table" className="w-full" value={selectedTable} onChange={(e) => onTableChange(e.target.value)}>
                <NativeSelectOption value="">Pilih meja</NativeSelectOption>
                {areas.map((area) => {
                  const selectable = area.tables.filter(isTableSelectableForPos);
                  if (selectable.length === 0) return null;
                  return (
                    <NativeSelectOptGroup key={area.id} label={area.outletName ? `${area.name} · ${area.outletName}` : area.name}>
                      {selectable.map((table) => (
                        <NativeSelectOption key={table.id} value={table.number || table.id}>
                          {table.status === "OCCUPIED"
                            ? `${table.number || table.id} (${table.area || area.name} - Tamu duduk)`
                            : `Meja ${table.number || table.id}${table.cap ? ` · ${table.cap} orang` : ""}`}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  );
                })}
              </NativeSelect>
            )}
          </Field>
        ) : null}

        <Field className={orderType === "DINE_IN" ? "min-w-0 gap-1" : "min-w-0 gap-1 sm:col-span-2"}>
          <FieldLabel htmlFor="pos-member">Member</FieldLabel>
          <NativeSelect id="pos-member" className="w-full" value={selectedMember?.id ?? ""} onChange={(e) => onMemberChange(e.target.value)}>
            <NativeSelectOption value="">Tamu (bukan member)</NativeSelectOption>
            {members.map((member) => (
              <NativeSelectOption key={member.id} value={member.id}>
                {member.name} · {member.tier} · {member.points} poin
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {/* Corporate Order Toggle */}
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold leading-tight text-foreground">Order perusahaan</span>
              <span className="text-xs text-muted-foreground leading-tight truncate">Tim, instansi, atau paket konsumsi + meeting room</span>
            </div>
          </div>
          <Button
            type="button"
            variant={isCorporateOrder ? "default" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => updateDraft({ enabled: !isCorporateOrder })}
            aria-pressed={isCorporateOrder}
          >
            {isCorporateOrder ? "Aktif" : "Aktifkan"}
          </Button>
        </div>

        {isCorporateOrder ? (
          <div className="flex flex-col gap-2.5 pt-1 border-t mt-1">
            <Field className="gap-1">
              <FieldLabel htmlFor="pos-corporate-company" className="text-xs">
                Nama perusahaan atau instansi <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="pos-corporate-company"
                className="h-8 text-xs"
                value={companyName}
                onChange={(e) => updateDraft({ companyName: e.target.value })}
                placeholder="Contoh: PT Dago Eng Kreatif"
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field className="gap-1">
                <FieldLabel htmlFor="pos-corporate-pic" className="text-xs">
                  Nama PIC <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="pos-corporate-pic"
                  className="h-8 text-xs"
                  value={picName}
                  onChange={(e) => updateDraft({ picName: e.target.value })}
                  placeholder="Nama PIC tim"
                  required
                />
              </Field>

              <Field className="gap-1">
                <FieldLabel htmlFor="pos-corporate-phone" className="text-xs">
                  WhatsApp PIC <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="pos-corporate-phone"
                  className="h-8 text-xs"
                  value={picPhone}
                  onChange={(e) => updateDraft({ picPhone: e.target.value })}
                  placeholder="0812xxxx"
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field className="gap-1">
                <FieldLabel htmlFor="pos-corporate-headcount" className="text-xs">
                  Jumlah peserta
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="pos-corporate-headcount"
                    type="number"
                    min={1}
                    max={200}
                    className="h-8 text-xs pl-7 font-mono"
                    value={headcount || 1}
                    onChange={(e) => updateDraft({ headcount: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                  <Users className="size-3.5 absolute left-2 top-2.5 text-muted-foreground" aria-hidden="true" />
                </div>
              </Field>

              <Field className="gap-1">
                <FieldLabel htmlFor="pos-corporate-billing" className="text-xs">
                  Skema penagihan
                </FieldLabel>
                <NativeSelect
                  id="pos-corporate-billing"
                  className="h-8 text-xs w-full"
                  value={billingType}
                  onChange={(e) => updateDraft({ billingType: e.target.value as CorporateBillingType })}
                >
                  <NativeSelectOption value="PREPAID">Bayar di muka</NativeSelectOption>
                  <NativeSelectOption value="INVOICE">Tagihan bertempo (14 hari)</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            {meetingRooms.length > 0 ? (
              <>
                <Field className="gap-1">
                  <FieldLabel htmlFor="pos-corporate-room" className="text-xs">
                    Sewa ruang pertemuan (opsional)
                  </FieldLabel>
                  <NativeSelect
                    id="pos-corporate-room"
                    className="h-8 text-xs w-full"
                    value={selectedMeetingRoomId}
                    onChange={(e) => {
                      updateDraft({
                        meetingRoomId: e.target.value,
                        meetingBookingDate: meetingBookingDate || todayWita,
                        meetingStartTime: meetingStartTime || "09:00",
                        meetingDurationHours: meetingDurationHours || 1,
                      });
                      onSelectedMeetingRoomChange?.(e.target.value);
                    }}
                  >
                    <NativeSelectOption value="">Tanpa ruang pertemuan (hanya F&B)</NativeSelectOption>
                    {meetingRooms.map((room) => (
                      <NativeSelectOption key={room.id} value={room.id}>
                        {room.name} · Rp {room.hourlyRate.toLocaleString("id-ID")}/jam
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                {selectedMeetingRoomId ? (
                  <div className="flex flex-col gap-2 rounded border bg-background/50 p-2">
                    <Field className="gap-1">
                      <FieldLabel htmlFor="pos-corporate-date" className="text-xs">
                        Tanggal sewa ruang pertemuan
                      </FieldLabel>
                      <Input
                        id="pos-corporate-date"
                        type="date"
                        min={todayWita}
                        className="h-8 text-xs font-mono"
                        value={meetingBookingDate}
                        onChange={(e) => updateDraft({ meetingBookingDate: e.target.value })}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-2">
                      <Field className="gap-1">
                        <FieldLabel htmlFor="pos-corporate-time" className="text-xs">
                          Jam mulai
                        </FieldLabel>
                        <NativeSelect
                          id="pos-corporate-time"
                          className="h-8 text-xs w-full font-mono"
                          value={meetingStartTime}
                          onChange={(e) => updateDraft({ meetingStartTime: e.target.value })}
                        >
                          {COWORKING_TIME_SLOTS.map((slot) => {
                            const hour = parseInt(slot.split(":")[0], 10);
                            const slotAvailability =
                              coworkingSpaces.length > 0
                                ? checkSlotAvailability({
                                    spaceId: selectedMeetingRoomId,
                                    spaces: coworkingSpaces,
                                    bookings: coworkingBookings,
                                    targetDate: meetingBookingDate,
                                    startHour: hour,
                                    durationHours: meetingDurationHours,
                                    checkPast: true,
                                  })
                                : null;
                            const isPast = isSlotPast(meetingBookingDate, slot);
                            const isTaken = slotAvailability ? !slotAvailability.isAvailable : false;
                            const label = slotAvailability
                              ? `${slot} · ${slotAvailability.label}`
                              : isPast
                              ? `${slot} (Lewat)`
                              : slot;
                            return (
                              <NativeSelectOption
                                key={slot}
                                value={slot}
                                disabled={isPast || isTaken}
                              >
                                {label}
                              </NativeSelectOption>
                            );
                          })}
                        </NativeSelect>
                      </Field>

                      <Field className="gap-1">
                        <FieldLabel htmlFor="pos-corporate-duration" className="text-xs">
                          Durasi (jam)
                        </FieldLabel>
                        <Input
                          id="pos-corporate-duration"
                          type="number"
                          min={1}
                          max={12}
                          className="h-8 text-xs font-mono"
                          value={meetingDurationHours}
                          onChange={(e) =>
                            updateDraft({
                              meetingDurationHours: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <Field className="gap-1">
        <FieldLabel htmlFor="pos-order-notes">Catatan pesanan</FieldLabel>
        <Input
          id="pos-order-notes"
          value={orderNotes || ""}
          onChange={(e) => onOrderNotesChange?.(e.target.value)}
          placeholder='Contoh: "TES QA - abaikan"'
        />
      </Field>

      {selectedMember ? (
        <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Crown className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="truncate">{selectedMember.name}</span>
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {selectedMember.tier} · {selectedMember.points} poin
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenVouchers}>
            <Ticket />
            {appliedVoucherTitle ? "Ganti voucher" : "Pakai voucher"}
          </Button>
        </div>
      ) : null}

      {appliedVoucherTitle ? (
        <Alert className="py-2">
          <Ticket />
          <AlertDescription className="flex items-center justify-between gap-2 text-foreground">
            {appliedVoucherTitle}
            <Button variant="ghost" size="icon-xs" onClick={onRemoveVoucher} aria-label="Lepas voucher">
              <X />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
