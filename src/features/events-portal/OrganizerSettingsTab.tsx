"use client";

import React from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface BankSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
}

interface OrganizerSettingsTabProps {
  organizerName: string;
  organizerEmail: string;
  bankSettings: BankSettings;
  setBankSettings: React.Dispatch<React.SetStateAction<BankSettings>>;
  onSaveBank: (e: React.FormEvent) => void;
  onLogout: () => void;
}

const BANK_FIELDS: readonly { key: keyof BankSettings; label: string; placeholder: string; required: boolean; hint?: string }[] = [
  { key: "bankName", label: "Nama bank", placeholder: "BCA, Mandiri, BNI, BRI", required: true },
  { key: "accountNumber", label: "Nomor rekening", placeholder: "1234567890", required: true },
  { key: "accountHolder", label: "Nama pemilik", placeholder: "Sesuai buku tabungan", required: true, hint: "Harus sama dengan nama di buku tabungan." },
  { key: "branch", label: "Kantor cabang", placeholder: "KCU Singaraja", required: false, hint: "Boleh dikosongkan." },
];

/** Only what the organizer can actually change here: the payout account. Profile data comes from the hub's records. */
export function OrganizerSettingsTab({
  organizerName,
  organizerEmail,
  bankSettings,
  setBankSettings,
  onSaveBank,
  onLogout,
}: OrganizerSettingsTabProps) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <form onSubmit={onSaveBank} className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle>Rekening pencairan</CardTitle>
            <CardDescription>Bagian Anda dari penjualan tiket ditransfer ke rekening ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {BANK_FIELDS.map((field) => (
                <Field key={field.key}>
                  <FieldLabel htmlFor={`bank-${field.key}`}>{field.label}</FieldLabel>
                  <Input
                    id={`bank-${field.key}`}
                    required={field.required}
                    value={bankSettings[field.key]}
                    onChange={(e) => setBankSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    inputMode={field.key === "accountNumber" ? "numeric" : undefined}
                  />
                  {field.hint ? <FieldDescription>{field.hint}</FieldDescription> : null}
                </Field>
              ))}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Simpan rekening</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Akun penyelenggara</CardTitle>
          <CardDescription>Untuk mengubah nama komunitas atau email, hubungi admin Dago Creative Hub.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Nama komunitas</dt>
              <dd className="font-medium">{organizerName || "Belum tercatat"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium break-all">{organizerEmail || "Belum tercatat"}</dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={onLogout}>
            <LogOut />
            Keluar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
