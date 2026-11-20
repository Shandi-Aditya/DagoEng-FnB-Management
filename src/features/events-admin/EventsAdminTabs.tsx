"use client";

import { Calendar, CreditCard, Settings, Wallet, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AdminSectionType = "MODERATION" | "PAYMENTS" | "PAYOUTS" | "REFUNDS" | "SETTINGS";

export interface EventsAdminTabsProps {
  currentSection: AdminSectionType;
  onSectionChange: (section: AdminSectionType) => void;
  pendingReviewsCount?: number;
  pendingPaymentsCount?: number;
  pendingPayoutsCount?: number;
  pendingRefundsCount?: number;
}

export function EventsAdminTabs({
  currentSection,
  onSectionChange,
  pendingReviewsCount = 0,
  pendingPaymentsCount = 0,
  pendingPayoutsCount = 0,
  pendingRefundsCount = 0,
}: EventsAdminTabsProps) {
  return (
    <Tabs
      value={currentSection}
      onValueChange={(val) => onSectionChange(val as AdminSectionType)}
      className="w-full"
    >
      <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
        <TabsTrigger value="MODERATION" className="gap-2">
          <Calendar />
          <span>Moderasi</span>
          {pendingReviewsCount > 0 ? (
            <Badge variant="secondary">
              {pendingReviewsCount}
            </Badge>
          ) : null}
        </TabsTrigger>

        <TabsTrigger value="PAYMENTS" className="gap-2">
          <CreditCard />
          <span>Pembayaran tiket</span>
          {pendingPaymentsCount > 0 ? (
            <Badge variant="secondary">
              {pendingPaymentsCount}
            </Badge>
          ) : null}
        </TabsTrigger>

        <TabsTrigger value="PAYOUTS" className="gap-2">
          <Wallet />
          <span>Pencairan saldo</span>
          {pendingPayoutsCount > 0 ? (
            <Badge variant="secondary">
              {pendingPayoutsCount}
            </Badge>
          ) : null}
        </TabsTrigger>

        <TabsTrigger value="REFUNDS" className="gap-2">
          <RotateCcw />
          <span>Pengajuan refund</span>
          {pendingRefundsCount > 0 ? (
            <Badge variant="secondary">
              {pendingRefundsCount}
            </Badge>
          ) : null}
        </TabsTrigger>

        <TabsTrigger value="SETTINGS" className="gap-2">
          <Settings />
          <span>Pengaturan bisnis</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
