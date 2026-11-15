"use client";

import React, { useState } from "react";
import {
  Building2,
  Copy,
  Check,
  Upload,
  Eye,
  ImageIcon,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyIDR } from "@/lib/utils";
import { notify } from "@/components/app/notify";
import { formatTicketEventDate } from "./ticket-pass-domain";

interface BankAccountInfo {
  bankId?: string;
  label?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string;
  badge?: string;
}

interface TicketPaymentTransferSectionProps {
  totalPrice: number;
  banks: BankAccountInfo[];
  isOriginalBankDeactivated?: boolean;
  paymentRejectionReason?: string | null;
  paymentProofUrl?: string | null;
  paymentProofUploadedAt?: string | null;
  paymentProofNote?: string | null;
  onUploadProof: (file: File, note: string) => Promise<void>;
  isUploading: boolean;
  onViewProof: () => void;
}

export function TicketPaymentTransferSection({
  totalPrice,
  banks,
  isOriginalBankDeactivated,
  paymentRejectionReason,
  paymentProofUrl,
  paymentProofUploadedAt,
  paymentProofNote,
  onUploadProof,
  isUploading,
  onViewProof,
}: TicketPaymentTransferSectionProps) {
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [isCopiedTotal, setIsCopiedTotal] = useState(false);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [isReuploading, setIsReuploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCopyTotal = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(totalPrice.toString());
    setIsCopiedTotal(true);
    notify.success("Nominal disalin", `Nominal ${formatCurrencyIDR(totalPrice)} telah disalin.`);
    setTimeout(() => setIsCopiedTotal(false), 2000);
  };

  const handleCopyAccount = (acc: string) => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(acc);
    setCopiedAccount(acc);
    notify.success("Nomor rekening disalin", `Nomor rekening ${acc} telah disalin.`);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Pilih file gambar berformat JPG, PNG, atau WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Ukuran file gambar maksimal 5MB.");
      return;
    }

    setProofFile(file);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofFile) {
      setErrorMessage("Pilih file bukti transfer terlebih dahulu.");
      return;
    }

    try {
      await onUploadProof(proofFile, proofNote);
      setProofFile(null);
      setProofPreview(null);
      setIsReuploading(false);
    } catch {
      // error handled in page callback
    }
  };

  return (
    <div className="space-y-4 pt-1 text-xs">
      {/* Transfer Amount Card */}
      <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2">
        <span className="text-xs text-muted-foreground font-medium block">
          Total nominal transfer pas
        </span>
        <div className="flex items-center justify-between">
          <span className="text-xl sm:text-2xl font-semibold text-foreground font-mono tabular-nums">
            {formatCurrencyIDR(totalPrice)}
          </span>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={handleCopyTotal}
          >
            {isCopiedTotal ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            <span>{isCopiedTotal ? "Tersalin" : "Salin nominal"}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground italic">
          *Pastikan nominal transfer pas hingga digit terakhir agar verifikasi otomatis berjalan lancar.
        </p>
      </div>

      {/* Destination Bank Accounts */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Building2 className="size-4 text-primary" />
          <span>Rekening resmi tujuan transfer:</span>
        </span>

        {isOriginalBankDeactivated && (
          <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs space-y-1">
            <p className="font-medium text-foreground">Pembaruan rekening pembayaran:</p>
            <p className="text-muted-foreground leading-snug">
              Rekening tujuan yang tertera saat pemesanan awal telah diperbarui. Harap lakukan pembayaran ke rekening resmi yang aktif di bawah ini.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {banks.map((bank) => (
            <div
              key={bank.accountNumber}
              className="p-3.5 bg-card rounded-xl border border-border flex items-center justify-between shadow-2xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{bank.bankName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {bank.label || bank.badge || "Resmi"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-sm text-foreground">
                    {bank.accountNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    a.n. {bank.accountHolder}
                  </span>
                </div>
                {bank.branch && (
                  <span className="text-xs text-muted-foreground block">
                    Cabang: {bank.branch}
                  </span>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleCopyAccount(bank.accountNumber)}
                className="text-xs"
              >
                {copiedAccount === bank.accountNumber ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span>{copiedAccount === bank.accountNumber ? "Disalin" : "Salin"}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Rejection Note */}
      {paymentRejectionReason && (
        <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="size-4 shrink-0" />
            <span>Bukti pembayaran perlu diperbaiki:</span>
          </div>
          <p className="leading-relaxed">{paymentRejectionReason}</p>
          <p className="text-xs text-muted-foreground pt-0.5">
            Unggah ulang foto bukti transfer baru yang jelas di bawah ini.
          </p>
        </div>
      )}

      {/* Upload Bukti Transfer Box */}
      <div className="pt-2 border-t border-border space-y-3">
        {paymentProofUrl && !isReuploading ? (
          <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Check className="size-4 text-success" />
                <span className="font-medium text-foreground">
                  Bukti transfer telah diunggah
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                Menunggu verifikasi
              </Badge>
            </div>

            <div className="flex items-center gap-3 p-2.5 bg-card rounded-lg border border-border">
              <button
                type="button"
                onClick={onViewProof}
                className="relative size-14 rounded-md overflow-hidden border border-border bg-muted shrink-0 cursor-pointer"
                title="Lihat foto bukti transfer ukuran penuh"
              >
                <img
                  src={paymentProofUrl}
                  alt="Bukti Transfer"
                  className="w-full h-full object-cover"
                />
              </button>

              <div className="space-y-0.5 min-w-0 flex-1">
                <span className="font-medium text-foreground block truncate">
                  Foto struk pembayaran
                </span>
                <span className="text-xs text-muted-foreground block">
                  {paymentProofUploadedAt
                    ? formatTicketEventDate(paymentProofUploadedAt)
                    : "Baru saja diunggah"}
                </span>
                {paymentProofNote && (
                  <p className="text-xs text-muted-foreground italic truncate">
                    Catatan: &quot;{paymentProofNote}&quot;
                  </p>
                )}
              </div>

              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={onViewProof}
              >
                <Eye className="size-3.5" />
                <span>Lihat</span>
              </Button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsReuploading(true)}
                className="text-xs text-primary"
              >
                <span>Unggah ulang bukti lain</span>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Upload className="size-4 text-primary" />
                <span>Unggah bukti transfer pembayaran:</span>
              </span>
              {isReuploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsReuploading(false);
                    setProofFile(null);
                    setProofPreview(null);
                  }}
                  className="text-xs"
                >
                  Batal
                </Button>
              )}
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Dropzone */}
            <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border hover:border-primary rounded-xl bg-card cursor-pointer transition-colors text-center space-y-2">
              {proofPreview ? (
                <div className="space-y-2">
                  <img
                    src={proofPreview}
                    alt="Preview Bukti"
                    className="max-h-36 mx-auto rounded-md shadow-xs border border-border object-contain"
                  />
                  <span className="text-xs font-medium text-primary block">
                    Ganti foto / file bukti
                  </span>
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <ImageIcon className="size-4" />
                  </div>
                  <span className="text-xs font-medium text-foreground block">
                    Klik untuk memilih foto bukti transfer
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Format JPG, PNG, atau WEBP (maksimal 5MB)
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium block">
                Catatan rekening pengirim (opsional):
              </label>
              <input
                type="text"
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="Contoh: Transfer m-BCA a.n. Budi Santoso"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              variant="default"
              disabled={!proofFile || isUploading}
              className="w-full py-3 sm:py-2.5 font-medium"
            >
              {isUploading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload />
              )}
              <span>{isUploading ? "Mengunggah bukti..." : "Kirim bukti pembayaran"}</span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
