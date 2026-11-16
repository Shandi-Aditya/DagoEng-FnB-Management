"use client";

import { Crown, Ticket, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PosOrderType = "DINE_IN" | "TAKEAWAY";

export interface TableAreaOption {
  id: string;
  name: string;
  outletName?: string;
  tables: { id: string; number?: string; cap?: number; status: string }[];
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
}: CartOrderSetupProps) {
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={orderType} onValueChange={(value) => onOrderTypeChange(value as PosOrderType)}>
        <TabsList className="w-full">
          <TabsTrigger value="DINE_IN">Dine in</TabsTrigger>
          <TabsTrigger value="TAKEAWAY">Takeaway</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-2 gap-2">
        {orderType === "DINE_IN" ? (
          <Field className="gap-1">
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
                  const free = area.tables.filter((table) => table.status === "AVAILABLE");
                  if (free.length === 0) return null;
                  return (
                    <NativeSelectOptGroup key={area.id} label={area.outletName ? `${area.name} · ${area.outletName}` : area.name}>
                      {free.map((table) => (
                        <NativeSelectOption key={table.id} value={table.number || table.id}>
                          Meja {table.number || table.id}
                          {table.cap ? ` · ${table.cap} orang` : ""}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  );
                })}
              </NativeSelect>
            )}
          </Field>
        ) : null}

        <Field className={orderType === "DINE_IN" ? "gap-1" : "col-span-2 gap-1"}>
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
