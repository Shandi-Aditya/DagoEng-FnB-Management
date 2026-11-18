"use client";

import React, { useEffect, useState } from "react";
import { Landmark, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { DataPagination } from "@/components/app/data-pagination";
import { BrandRings } from "@/features/landing/home/BrandRings";
import { formatCurrencyIDR } from "@/lib/utils";
import { maskAccountNumber } from "@/lib/payout";
import type { PayoutRecord } from "@/types/event";
import { formatDateSafe, payoutStatusLabel, payoutStatusTone } from "./events-portal-domain";
import type { EventBalanceRow, EventBalanceTotals } from "./events-portal-groups";

interface BankAccountInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string;
}

interface OrganizerFinanceTabProps {
  rows: EventBalanceRow[];
  totals: EventBalanceTotals;
  payouts: (PayoutRecord & { eventTitle: string })[];
  bankSettings: BankAccountInfo;
  onOpenPayout: () => void;
  onGoToSettings: () => void;
}

const PAGE_SIZE = 10;

/** Balance first with one way to withdraw it, then where it came from, then what was already paid. */
export function OrganizerFinanceTab({ rows, totals, payouts, bankSettings, onOpenPayout, onGoToSettings }: OrganizerFinanceTabProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [payouts]);
  const hasBankAccount = Boolean(bankSettings.accountNumber && bankSettings.bankName);
  const earningRows = rows.filter((row) => row.gross > 0 || row.paidOut > 0 || row.pending > 0);
  const pagePayouts = payouts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-2xl bg-unit-loyalty/10 p-4 sm:p-6">
        <BrandRings className="absolute -top-24 -right-16 -z-10 h-[160%] opacity-20" />
        <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm sm:max-w-xl">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Siap dicairkan</p>
            <p className="text-3xl font-medium tabular-nums sm:text-4xl">{formatCurrencyIDR(totals.available)}</p>
            <p className="text-sm text-muted-foreground">
              {totals.pending > 0
                ? `${formatCurrencyIDR(totals.pending)} sedang diproses tim finance.`
                : "Dihitung dari bagian Anda pada tiket yang sudah lunas."}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
            <Landmark className="size-4 shrink-0 text-muted-foreground" />
            {hasBankAccount ? (
              <span className="min-w-0 flex-1 truncate">
                {bankSettings.bankName} · {maskAccountNumber(bankSettings.accountNumber)} · {bankSettings.accountHolder}
              </span>
            ) : (
              <span className="flex-1 text-muted-foreground">Rekening tujuan belum diisi.</span>
            )}
            <Button size="sm" variant="ghost" onClick={onGoToSettings}>
              {hasBankAccount ? "Ubah" : "Isi rekening"}
            </Button>
          </div>

          <Button className="self-start" onClick={onOpenPayout} disabled={totals.available <= 0}>
            <Wallet />
            Cairkan saldo
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Pendapatan per event</CardTitle>
          <CardDescription>
            Bagian Anda sesuai bagi hasil yang berlaku saat tiket terjual. Total omzet {formatCurrencyIDR(totals.gross)}, bagian Anda{" "}
            {formatCurrencyIDR(totals.earnings)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {earningRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada tiket berbayar yang lunas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Omzet</TableHead>
                  <TableHead className="text-right">Bagian Anda</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Sudah cair</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earningRows.map((row) => (
                  <TableRow key={row.eventId}>
                    <TableCell className="max-w-56">
                      <span className="block truncate font-medium">{row.title}</span>
                      <span className="text-muted-foreground">Bagi hasil {row.sharePercent}%</span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatCurrencyIDR(row.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyIDR(row.earnings)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrencyIDR(row.paidOut)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrencyIDR(row.available)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Riwayat pencairan</h2>
        {payouts.length === 0 ? (
          <EmptyState
            icon={<Wallet />}
            title="Belum ada pencairan"
            description="Setiap pengajuan pencairan dan statusnya tercatat di sini."
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Diajukan</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="hidden sm:table-cell">Rekening</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagePayouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{formatDateSafe(p.requestedAt, true)}</TableCell>
                      <TableCell className="max-w-48 truncate font-medium">{p.eventTitle}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrencyIDR(p.amount)}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {p.bankName ? `${p.bankName} · ${maskAccountNumber(p.accountNumber ?? "")}` : "Tidak tercatat"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payoutStatusTone(p.status)}>{payoutStatusLabel(p.status)}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {payouts.length > PAGE_SIZE && (
              <DataPagination currentPage={page} pageSize={PAGE_SIZE} totalItems={payouts.length} onPageChange={setPage} itemLabel="pencairan" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
