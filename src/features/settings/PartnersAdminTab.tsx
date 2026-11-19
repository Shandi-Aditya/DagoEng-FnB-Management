"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Calendar,
  ExternalLink,
  Eye,
  History,
  Key,
  MoreHorizontal,
  Plus,
  Power,
  Save,
  Search,
  Store,
} from "lucide-react";

import { DataPagination } from "@/components/app/data-pagination";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TenantOperationConfig } from "@/lib/operating-hours";
import { DEFAULT_TENANT_REVENUE_SPLITS, type TenantRevenueSplitConfig } from "@/lib/settlement";
import {
  SETTLEMENT_BASIS_OPTIONS,
  type SettlementBasisMode,
} from "@/lib/settlement-receipt-policy";
import { getTenantProfile } from "@/lib/tenant";
import { formatCurrencyIDR } from "@/lib/utils";
import type { CommunityEvent } from "@/types/event";
import type { CommunityOrganizerProfile } from "@/types/organizer";

import {
  filterPartners,
  formatSettingsDateTime,
  organizerActivationLabel,
  organizerActivationTone,
  productStatusLabel,
  productStatusTone,
  type UnifiedPartnerRow,
} from "./settings-domain";

export type PartnerSubTabId = "MANAJEMEN_MITRA" | "BAGI_HASIL_FNB" | "BAGI_HASIL_EVENTS";

export interface PartnersAdminTabProps {
  partnerSubTab: PartnerSubTabId;
  onPartnerSubTabChange: (tab: PartnerSubTabId) => void;
  partnerTypeFilter: "ALL" | "FNB" | "EVENT";
  onPartnerTypeFilterChange: (val: "ALL" | "FNB" | "EVENT") => void;
  partnerStatusFilter: "ALL" | "ACTIVE" | "INACTIVE";
  onPartnerStatusFilterChange: (val: "ALL" | "ACTIVE" | "INACTIVE") => void;
  partnerSearchQuery: string;
  onPartnerSearchQueryChange: (val: string) => void;
  localTenants: { id: string; name: string; code: string; badge: string }[];
  allTenantStatuses: Record<string, "ACTIVE" | "INACTIVE">;
  organizers: CommunityOrganizerProfile[];
  onOpenAddOrganizer: () => void;
  onOpenAddTenant: () => void;
  onSelectPartnerDetail: (partner: UnifiedPartnerRow) => void;
  onToggleOrganizerStatus: (orgId: string, status: "ACTIVE" | "INACTIVE") => void;
  onGenerateActivationLink: (orgId: string) => void;
  isGeneratingInvite: boolean;
  tenantOps: Record<string, TenantOperationConfig>;
  onUpdateTenantOperation: (tenantId: string, field: keyof TenantOperationConfig, value: unknown) => void;
  onToggleTenantOrderStatus: (tenantId: string, name: string, nextAccepting: boolean) => void;
  onSaveTenantOperations?: () => void;
  isSavingTenantOperations?: boolean;
  revenueSplits: Record<string, TenantRevenueSplitConfig>;
  revenueSplitErrors: Record<string, string>;
  splitSaveFeedback: string;
  settlementBasis?: SettlementBasisMode;
  onSettlementBasisChange?: (basis: SettlementBasisMode) => void;
  canEditSettlementPolicy?: boolean;
  onTenantSplitChange: (tenantId: string, tenantShare: number) => void;
  onSaveTenantSplits: () => void;
  eventPlatformFee: number;
  onEventPlatformFeeChange: (val: number) => void;
  eventPolicyEffectiveDate: string;
  onEventPolicyEffectiveDateChange: (val: string) => void;
  eventPolicyNotes: string;
  onEventPolicyNotesChange: (val: string) => void;
  eventPolicyFeedback: string;
  isSavingEventPolicy: boolean;
  onSaveEventRevenuePolicy: () => void;
  eventSimTicketPrice: number;
  onEventSimTicketPriceChange: (val: number) => void;
  eventSimTicketQty: number;
  onEventSimTicketQtyChange: (val: number) => void;
  activeAdminEvents: CommunityEvent[];
  eventOverrides: Record<string, number | null>;
  onEventOverrideDraftChange: (eventId: string, value: number | null) => void;
  onSaveEventOverride: (eventId: string, customFeePercent: number | null) => void;
  eventPolicyHistory: Array<{
    id?: string;
    updatedAt?: string;
    platformFeePercent?: number;
    notes?: string;
    updatedBy?: string;
  }>;
}

export function PartnersAdminTab(props: PartnersAdminTabProps) {
  const {
    partnerSubTab,
    onPartnerSubTabChange,
    partnerTypeFilter,
    onPartnerTypeFilterChange,
    partnerStatusFilter,
    onPartnerStatusFilterChange,
    partnerSearchQuery,
    onPartnerSearchQueryChange,
    localTenants,
    allTenantStatuses,
    organizers,
    onOpenAddOrganizer,
    onOpenAddTenant,
    onSelectPartnerDetail,
    onToggleOrganizerStatus,
    onGenerateActivationLink,
    isGeneratingInvite,
    tenantOps,
    onUpdateTenantOperation,
    onToggleTenantOrderStatus,
    onSaveTenantOperations,
    isSavingTenantOperations,
    revenueSplits,
    revenueSplitErrors,
    splitSaveFeedback,
    settlementBasis = "RECEIPT_NET_BEFORE_TAX",
    onSettlementBasisChange,
    canEditSettlementPolicy = true,
    onTenantSplitChange,
    onSaveTenantSplits,
    eventPlatformFee,
    onEventPlatformFeeChange,
    eventPolicyEffectiveDate,
    onEventPolicyEffectiveDateChange,
    eventPolicyNotes,
    onEventPolicyNotesChange,
    eventPolicyFeedback,
    isSavingEventPolicy,
    onSaveEventRevenuePolicy,
    eventSimTicketPrice,
    onEventSimTicketPriceChange,
    eventSimTicketQty,
    onEventSimTicketQtyChange,
    activeAdminEvents,
    eventOverrides,
    onEventOverrideDraftChange,
    onSaveEventOverride,
    eventPolicyHistory,
  } = props;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fnbRows: UnifiedPartnerRow[] = localTenants.map((t) => {
    const status = allTenantStatuses[t.id] || "ACTIVE";
    const prof = getTenantProfile(t.id);
    return {
      id: t.id,
      name: t.name,
      type: "FNB",
      categoryOrBadge: t.badge,
      contactPerson: "—",
      phone: prof.contactPhone || "—",
      email: "—",
      status,
      serviceModule: "FNB",
      scopeLevel: "TENANT",
      roleName: "Pemilik mitra F&B",
      permissions: [
        "dashboard:view",
        "orders:view",
        "tables:view",
        "inventory:view",
        "menu:view",
        "menu:manage",
        "reports:view",
      ],
      bankInfo:
        prof.bankAccountNumber && prof.bankAccountNumber !== "-"
          ? {
              bankName: prof.bankName || "BCA",
              accountNumber: prof.bankAccountNumber,
              accountHolder: prof.bankAccountHolder || t.name,
            }
          : undefined,
      notes: "Mitra gerai kuliner F&B terhubung dengan POS multi-mitra.",
    };
  });

  const eventRows: UnifiedPartnerRow[] = organizers.map((o) => ({
    id: o.id,
    name: o.name,
    type: "EVENT",
    categoryOrBadge: o.category,
    contactPerson: o.contactPerson,
    phone: o.phone,
    email: o.email,
    status: o.status,
    activationStatus:
      (o as unknown as { activationStatus?: string }).activationStatus ||
      (o.status === "INACTIVE" ? "INACTIVE" : "PENDING_ACTIVATION"),
    serviceModule: "CO_WORKING",
    scopeLevel: "TENANT",
    roleName: "Penyelenggara event",
    permissions: [
      "events:manage_own",
      "events:portal_access",
      "events:checkin_attendee",
      "events:view_revenue",
    ],
    notes: o.notes || "Mitra komunitas penyelenggara event.",
  }));

  const filteredPartners = filterPartners([...fnbRows, ...eventRows], {
    type: partnerTypeFilter,
    status: partnerStatusFilter,
    searchQuery: partnerSearchQuery,
  });

  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filteredPartners.length / pageSize)));
  const pagedPartners = filteredPartners.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasPartnerFilter =
    partnerTypeFilter !== "ALL" || partnerStatusFilter !== "ALL" || partnerSearchQuery.trim() !== "";

  const simGross = eventSimTicketPrice * eventSimTicketQty;
  const simPlatform = Math.round(simGross * (eventPlatformFee / 100));
  const simOrganizer = simGross - simPlatform;

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={partnerSubTab}
        onValueChange={(val) => onPartnerSubTabChange(val as PartnerSubTabId)}
      >
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger value="MANAJEMEN_MITRA">Direktori mitra</TabsTrigger>
          <TabsTrigger value="BAGI_HASIL_FNB">Operasional & bagi hasil F&B</TabsTrigger>
          <TabsTrigger value="BAGI_HASIL_EVENTS">Bagi hasil event</TabsTrigger>
        </TabsList>
      </Tabs>

      {partnerSubTab === "MANAJEMEN_MITRA" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <InputGroup className="w-full sm:max-w-xs">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  value={partnerSearchQuery}
                  onChange={(e) => {
                    onPartnerSearchQueryChange(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Cari nama mitra, PIC, atau email"
                  aria-label="Cari mitra"
                />
              </InputGroup>

              <NativeSelect
                value={partnerTypeFilter}
                onChange={(e) => {
                  onPartnerTypeFilterChange(e.target.value as "ALL" | "FNB" | "EVENT");
                  setCurrentPage(1);
                }}
                aria-label="Tipe mitra"
              >
                <NativeSelectOption value="ALL">Semua tipe</NativeSelectOption>
                <NativeSelectOption value="FNB">Mitra F&B</NativeSelectOption>
                <NativeSelectOption value="EVENT">Penyelenggara event</NativeSelectOption>
              </NativeSelect>

              <NativeSelect
                value={partnerStatusFilter}
                onChange={(e) => {
                  onPartnerStatusFilterChange(e.target.value as "ALL" | "ACTIVE" | "INACTIVE");
                  setCurrentPage(1);
                }}
                aria-label="Status mitra"
              >
                <NativeSelectOption value="ALL">Semua status</NativeSelectOption>
                <NativeSelectOption value="ACTIVE">Aktif</NativeSelectOption>
                <NativeSelectOption value="INACTIVE">Nonaktif</NativeSelectOption>
              </NativeSelect>

              {hasPartnerFilter ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onPartnerSearchQueryChange("");
                    onPartnerTypeFilterChange("ALL");
                    onPartnerStatusFilterChange("ALL");
                    setCurrentPage(1);
                  }}
                >
                  Reset filter
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" size="lg" variant="outline" onClick={onOpenAddTenant}>
                <Plus />
                <span>Mitra F&B</span>
              </Button>
              <Button type="button" size="lg" onClick={onOpenAddOrganizer}>
                <Plus />
                <span>Penyelenggara</span>
              </Button>
            </div>
          </div>

          {filteredPartners.length === 0 ? (
            <EmptyState
              className="border"
              icon={<Store />}
              title={hasPartnerFilter ? "Mitra tidak ditemukan" : "Belum ada mitra"}
              description={
                hasPartnerFilter
                  ? "Ubah kata kunci atau filter tipe dan status."
                  : "Daftarkan mitra F&B atau penyelenggara event."
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mitra</TableHead>
                      <TableHead className="hidden sm:table-cell">Tipe</TableHead>
                      <TableHead className="hidden md:table-cell">Kontak</TableHead>
                      <TableHead className="hidden lg:table-cell">Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-0 text-right">
                        <span className="sr-only">Aksi</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedPartners.map((p) => (
                      <TableRow key={`${p.type}-${p.id}`}>
                        <TableCell className="whitespace-normal">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                              {p.type === "FNB" ? (
                                <Store className="size-4" />
                              ) : (
                                <Calendar className="size-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.categoryOrBadge}
                                <span className="sm:hidden"> · {p.type === "FNB" ? "Mitra F&B" : "Event"}</span>
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline">
                            {p.type === "FNB" ? "Mitra F&B" : "Penyelenggara"}
                          </Badge>
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-xs">
                          <p className="text-foreground">{p.contactPerson}</p>
                          <p className="text-muted-foreground">{p.phone}</p>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {p.email}
                        </TableCell>

                        <TableCell>
                          {p.type === "EVENT" ? (
                            <StatusBadge
                              status={organizerActivationTone(
                                p.status === "INACTIVE" ? "INACTIVE" : p.activationStatus
                              )}
                            >
                              {organizerActivationLabel(
                                p.status === "INACTIVE" ? "INACTIVE" : p.activationStatus
                              )}
                            </StatusBadge>
                          ) : (
                            <StatusBadge status={productStatusTone(p.status)}>
                              {productStatusLabel(p.status)}
                            </StatusBadge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onSelectPartnerDetail(p)}
                              aria-label={`Detail ${p.name}`}
                            >
                              <Eye />
                              <span className="hidden sm:inline">Detail</span>
                            </Button>

                            {p.type === "EVENT" ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      type="button"
                                      size="icon-xs"
                                      variant="ghost"
                                      aria-label={`Menu aksi ${p.name}`}
                                    />
                                  }
                                >
                                  <MoreHorizontal />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => onGenerateActivationLink(p.id)}
                                    disabled={isGeneratingInvite}
                                  >
                                    <Key />
                                    <span>Terbitkan tautan aktivasi</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onToggleOrganizerStatus(p.id, p.status)}
                                  >
                                    <Power />
                                    <span>{p.status === "ACTIVE" ? "Nonaktifkan akun" : "Aktifkan akun"}</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataPagination
                currentPage={safePage}
                totalItems={filteredPartners.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                itemLabel="mitra"
              />
            </div>
          )}
        </div>
      ) : null}

      {partnerSubTab === "BAGI_HASIL_FNB" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Jam operasional & status mitra</h3>
                <p className="text-xs text-muted-foreground">
                  Atur jam operasional rutin. Tombol Buka/Tutup manual mengalahkan jadwal operasional.
                </p>
              </div>
              {onSaveTenantOperations && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onSaveTenantOperations}
                  disabled={isSavingTenantOperations}
                >
                  <Save />
                  <span>{isSavingTenantOperations ? "Menyimpan..." : "Simpan jam operasional"}</span>
                </Button>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitra F&B</TableHead>
                    <TableHead className="hidden sm:table-cell">Jam buka–tutup</TableHead>
                    <TableHead>Terima pesanan</TableHead>
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localTenants.map((t) => {
                    const op = tenantOps[t.id] || {
                      tenantId: t.id,
                      tenantName: t.name,
                      isAcceptingOrders: (allTenantStatuses[t.id] || "ACTIVE") === "ACTIVE",
                      openTime: "08:00",
                      closeTime: "21:00",
                    };
                    const isAccepting = op.manualOverride
                      ? op.manualOverride === "OPEN"
                      : (op.isAcceptingOrders ?? true);

                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.badge}</p>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="time"
                              value={op.openTime || "08:00"}
                              onChange={(e) => onUpdateTenantOperation(t.id, "openTime", e.target.value)}
                              aria-label={`Jam buka ${t.name}`}
                              className="w-28 font-mono tabular-nums"
                            />
                            <span className="text-muted-foreground">–</span>
                            <Input
                              type="time"
                              value={op.closeTime || "21:00"}
                              onChange={(e) => onUpdateTenantOperation(t.id, "closeTime", e.target.value)}
                              aria-label={`Jam tutup ${t.name}`}
                              className="w-28 font-mono tabular-nums"
                            />
                          </div>
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={isAccepting ? "success" : "destructive"}>
                            {op.manualOverride === "OPEN"
                              ? "Buka (Manual)"
                              : op.manualOverride === "CLOSED"
                                ? "Tutup (Manual)"
                                : isAccepting
                                  ? "Buka"
                                  : "Tutup sementara"}
                          </StatusBadge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onToggleTenantOrderStatus(t.id, t.name, !isAccepting)}
                          >
                            <Power />
                            <span>{isAccepting ? "Tutup" : "Buka"}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Bagi hasil mitra F&B</CardTitle>
                <CardDescription>
                  Persentase dan dasar perhitungan bagi hasil berlaku untuk setiap struk lunas.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="lg"
                onClick={onSaveTenantSplits}
                disabled={!canEditSettlementPolicy}
              >
                <Save />
                <span>Simpan bagi hasil</span>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {splitSaveFeedback ? (
                <Alert>
                  <AlertDescription>{splitSaveFeedback}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="settlement-basis-select">Dasar perhitungan bagi hasil</Label>
                    <p className="text-xs text-muted-foreground">
                      {
                        SETTLEMENT_BASIS_OPTIONS.find((opt) => opt.value === settlementBasis)
                          ?.description
                      }
                    </p>
                  </div>
                  <NativeSelect
                    id="settlement-basis-select"
                    value={settlementBasis}
                    disabled={!canEditSettlementPolicy || !onSettlementBasisChange}
                    onChange={(e) =>
                      onSettlementBasisChange?.(e.target.value as SettlementBasisMode)
                    }
                    aria-label="Dasar perhitungan bagi hasil"
                    className="w-full sm:w-80"
                  >
                    {SETTLEMENT_BASIS_OPTIONS.map((opt) => (
                      <NativeSelectOption key={opt.value} value={opt.value}>
                        {opt.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                {!canEditSettlementPolicy ? (
                  <p className="text-xs text-muted-foreground">
                    Hanya Owner organisasi atau Super Admin yang dapat mengubah kebijakan bagi hasil.
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {localTenants.map((tenant) => {
                  const cfg = revenueSplits[tenant.id] ||
                    DEFAULT_TENANT_REVENUE_SPLITS[tenant.id] || {
                      tenantId: tenant.id,
                      tenantName: tenant.name,
                      tenantSharePercent: 85,
                      dagoSharePercent: 15,
                      status: "ACTIVE",
                    };
                  const errMsg = revenueSplitErrors[tenant.id];
                  const simTenant = Math.round(100000 * (cfg.tenantSharePercent / 100));
                  const simDago = 100000 - simTenant;

                  return (
                    <div key={tenant.id} className="flex flex-col gap-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{tenant.name}</span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {cfg.tenantSharePercent}% / {cfg.dagoSharePercent}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`split-${tenant.id}`}>Bagian mitra (%)</Label>
                          <Input
                            id={`split-${tenant.id}`}
                            type="number"
                            min={0}
                            max={100}
                            disabled={!canEditSettlementPolicy}
                            value={cfg.tenantSharePercent}
                            onChange={(e) => onTenantSplitChange(tenant.id, Number(e.target.value))}
                            className="font-mono tabular-nums"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>Bagian Dago (%)</Label>
                          <Input
                            type="number"
                            disabled
                            value={cfg.dagoSharePercent}
                            className="font-mono tabular-nums"
                          />
                        </div>
                      </div>

                      {errMsg ? <p className="text-xs text-destructive">{errMsg}</p> : null}

                      <p className="text-xs text-muted-foreground">
                        Contoh Rp 100.000: mitra{" "}
                        <span className="font-mono text-foreground tabular-nums">
                          {formatCurrencyIDR(simTenant)}
                        </span>{" "}
                        · Dago{" "}
                        <span className="font-mono text-foreground tabular-nums">
                          {formatCurrencyIDR(simDago)}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {partnerSubTab === "BAGI_HASIL_EVENTS" ? (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Kebijakan komisi event (Template)</CardTitle>
                <CardDescription>
                  Komisi standar platform dikelola secara terpusat di Events Admin.
                </CardDescription>
              </div>
              <Link
                href="/events-admin?tab=SETTINGS"
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <ExternalLink className="size-3.5" />
                <span>Kelola kebijakan di Events Admin</span>
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="eventPlatformFee">Komisi standar Dago (%)</Label>
                  <Input
                    id="eventPlatformFee"
                    type="number"
                    disabled
                    value={eventPlatformFee}
                    className="font-mono tabular-nums bg-muted"
                  />
                  <span className="text-xs text-muted-foreground">
                    Diatur di halaman Events Admin &bull; Settings.
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Bagian standar penyelenggara (%)</Label>
                  <Input
                    type="number"
                    disabled
                    value={100 - eventPlatformFee}
                    className="font-mono tabular-nums bg-muted"
                  />
                  <span className="text-xs text-muted-foreground">
                    Dihitung otomatis: 100% - komisi platform.
                  </span>
                </div>
              </div>

              {eventPolicyFeedback ? (
                <Alert variant={eventPolicyFeedback.startsWith("Error") ? "destructive" : "default"}>
                  <AlertDescription>{eventPolicyFeedback}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Calculator className="size-4 text-muted-foreground" />
                Simulasi pembagian tiket
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="simTicketPrice">Harga tiket (Rp)</Label>
                  <Input
                    id="simTicketPrice"
                    type="number"
                    min={0}
                    step={5000}
                    value={eventSimTicketPrice}
                    onChange={(e) =>
                      onEventSimTicketPriceChange(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="simTicketQty">Jumlah tiket</Label>
                  <Input
                    id="simTicketQty"
                    type="number"
                    min={1}
                    value={eventSimTicketQty}
                    onChange={(e) =>
                      onEventSimTicketQtyChange(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Penjualan kotor</span>
                  <p className="font-mono text-sm font-medium text-foreground tabular-nums">
                    {formatCurrencyIDR(simGross)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Komisi Dago ({eventPlatformFee}%)</span>
                  <p className="font-mono text-sm font-medium text-foreground tabular-nums">
                    {formatCurrencyIDR(simPlatform)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Hak penyelenggara</span>
                  <p className="font-mono text-sm font-medium text-success tabular-nums">
                    {formatCurrencyIDR(simOrganizer)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {activeAdminEvents.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-foreground">Penyesuaian komisi per event</h3>
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead className="hidden sm:table-cell">Penyelenggara</TableHead>
                      <TableHead className="text-right">Komisi Dago (%)</TableHead>
                      <TableHead className="w-0 text-right">
                        <span className="sr-only">Aksi</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAdminEvents.slice(0, 10).map((evt) => {
                      const draftVal = eventOverrides[evt.id];
                      return (
                        <TableRow key={evt.id}>
                          <TableCell className="whitespace-normal">
                            <p className="text-sm font-medium text-foreground">{evt.title}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{evt.organizerName}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {evt.organizerName}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              placeholder={String(eventPlatformFee)}
                              value={draftVal ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                onEventOverrideDraftChange(
                                  evt.id,
                                  raw === "" ? null : Number(raw),
                                );
                              }}
                              aria-label={`Komisi khusus ${evt.title}`}
                              className="ml-auto w-24 text-right font-mono tabular-nums"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onSaveEventOverride(evt.id, draftVal ?? null)}
                            >
                              Simpan
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {eventPolicyHistory.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <History className="size-4 text-muted-foreground" />
                Riwayat perubahan kebijakan
              </h3>
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead className="text-right">Komisi</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventPolicyHistory.slice(0, 5).map((h, i) => (
                      <TableRow key={h.id || i}>
                        <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                          {formatSettingsDateTime(h.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                          {h.platformFeePercent ?? "—"}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {h.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
