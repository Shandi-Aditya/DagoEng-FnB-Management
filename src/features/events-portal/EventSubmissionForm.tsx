"use client";

import React, { useMemo, useState } from "react";
import { CalendarDays, MapPin, Ticket } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { resolveVenueCapacity } from "@/lib/event-capacity";
import { cn, formatCurrencyIDR } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isCheckInStaffRole, CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE } from "@/lib/event-validation";
import { TicketTiersEditor } from "@/components/events/TicketTiersEditor";
import { EventRefundPolicyEditor } from "@/components/events/EventRefundPolicyEditor";

import {
  EVENT_CATEGORIES,
  HUB_FACILITIES,
  HUB_PROMOTIONS,
  HUB_VENUES,
  buildSubmissionPayload,
  emptySubmissionForm,
  isHubVenue,
  validateSubmissionForm,
  type SubmissionErrors,
  type SubmissionField,
  type SubmissionForm,
} from "./event-submission";
import { PosterField } from "./PosterField";

const OTHER_VENUE = "__other__";

export interface SubmissionResult {
  eventId: string;
  user?: unknown;
}

interface EventSubmissionFormProps {
  /** "portal": signed-in organizer, contact comes from the account. "guest": the form also creates the account. */
  mode: "portal" | "guest";
  organizer?: { name?: string; email?: string; phone?: string };
  onSubmitted: (result: SubmissionResult) => void | Promise<void>;
  onCancel?: () => void;
  /** Guest mode for someone already signed in: the email is their account's and no password is asked. */
  signedIn?: boolean;
}

/** One page, four cards and a summary: everything the hub needs to review an event. */
export function EventSubmissionForm({ mode, organizer, onSubmitted, onCancel, signedIn = false }: EventSubmissionFormProps) {
  const { user } = useAuth();
  const isCheckInStaff = isCheckInStaffRole(user?.role);
  const needsPassword = mode === "guest" && !signedIn;
  const [form, setForm] = useState<SubmissionForm>(() => emptySubmissionForm(organizer));
  const [errors, setErrors] = useState<SubmissionErrors>({});
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [venueChoice, setVenueChoice] = useState<string>(HUB_VENUES[0]);

  const set = <K extends SubmissionField>(field: K, value: SubmissionForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const toggleIn = (field: "collaborationFacilities" | "collaborationPromotion", item: string, on: boolean) =>
    set(field, on ? [...form[field], item] : form[field].filter((value) => value !== item));

  const atHub = isHubVenue(form.location);
  const capacityHint = useMemo(() => resolveVenueCapacity(form.location), [form.location]);
  const err = (field: SubmissionField) => errors[field];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerErrors([]);

    if (isCheckInStaff) {
      setServerErrors([CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const found = validateSubmissionForm(form, { needsPassword });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector("[data-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSubmissionPayload(form)),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setServerErrors(Array.isArray(data.details) ? data.details : [data.error || "Pengajuan gagal dikirim."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      await onSubmitted({ eventId: data.data?.id ?? "", user: data.user });
    } catch {
      setServerErrors(["Koneksi terputus. Coba kirim lagi."]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="sr-only"
        value={form.honeypot}
        onChange={(e) => set("honeypot", e.target.value)}
      />

      <div className="flex min-w-0 flex-col gap-6">
        {isCheckInStaff ? (
          <Alert variant="destructive">
            <AlertTitle>Akses Pembuatan Event Ditolak</AlertTitle>
            <AlertDescription>{CHECKIN_STAFF_SUBMISSION_BLOCKED_MESSAGE}</AlertDescription>
          </Alert>
        ) : null}

        {serverErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Pengajuan belum terkirim</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {serverErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{mode === "guest" ? "Akun penyelenggara" : "Kontak penyelenggara"}</CardTitle>
            <CardDescription>
              {mode === "guest"
                ? "Akun ini dipakai untuk masuk ke portal dan memantau event Anda."
                : "Admin menghubungi nomor ini kalau ada yang perlu dikonfirmasi."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {mode === "guest" ? (
                <>
                  <TextField id="org-name" label="Nama komunitas" value={form.organizerName} onChange={(v) => set("organizerName", v)} error={err("organizerName")} />
                  <TextField
                    id="org-email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    readOnly={signedIn}
                    value={form.organizerEmail}
                    onChange={(v) => set("organizerEmail", v)}
                    error={err("organizerEmail")}
                    hint={signedIn ? "Email akun yang sedang masuk." : undefined}
                  />
                </>
              ) : (
                <div className="flex flex-col gap-0.5 text-sm sm:col-span-2">
                  <span className="font-medium">{form.organizerName || "Nama komunitas belum tercatat"}</span>
                  <span className="text-muted-foreground">{form.organizerEmail}</span>
                </div>
              )}
              <TextField id="org-phone" label="WhatsApp" type="tel" inputMode="tel" placeholder="081234567890" value={form.organizerPhone} onChange={(v) => set("organizerPhone", v)} error={err("organizerPhone")} />
              {needsPassword && (
                <TextField id="org-password" label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(v) => set("password", v)} error={err("password")} hint="Minimal 6 karakter." />
              )}
              {(err("organizerName") || err("organizerEmail")) && mode === "portal" ? (
                <FieldError className="sm:col-span-2">Nama atau email akun belum lengkap. Hubungi admin untuk melengkapinya.</FieldError>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tentang event</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              <TextField id="event-title" label="Judul" value={form.title} onChange={(v) => set("title", v)} error={err("title")} placeholder="Workshop latte art untuk pemula" />
              <Field>
                <FieldLabel htmlFor="event-category">Kategori</FieldLabel>
                <NativeSelect id="event-category" value={form.category} onChange={(e) => set("category", e.target.value as SubmissionForm["category"])}>
                  {EVENT_CATEGORIES.map((c) => (
                    <NativeSelectOption key={c.value} value={c.value}>
                      {c.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={Boolean(err("description")) || undefined}>
                <FieldLabel htmlFor="event-description">Deskripsi</FieldLabel>
                <Textarea
                  id="event-description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Apa yang akan peserta lakukan dan dapatkan?"
                  aria-invalid={Boolean(err("description")) || undefined}
                />
                {err("description") ? <FieldError>{err("description")}</FieldError> : null}
              </Field>
              <PosterField value={form.posterUrl} onChange={(url) => set("posterUrl", url)} error={err("posterUrl")} />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waktu dan tempat</CardTitle>
            <CardDescription>Waktu dalam WITA.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <TextField id="event-start" label="Mulai" type="datetime-local" value={form.startDate} onChange={(v) => set("startDate", v)} error={err("startDate")} />
              <TextField id="event-end" label="Selesai" type="datetime-local" value={form.endDate} onChange={(v) => set("endDate", v)} error={err("endDate")} />
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="event-venue">Tempat</FieldLabel>
                <NativeSelect
                  id="event-venue"
                  value={venueChoice}
                  onChange={(e) => {
                    setVenueChoice(e.target.value);
                    set("location", e.target.value === OTHER_VENUE ? "" : e.target.value);
                  }}
                >
                  {HUB_VENUES.map((venue) => (
                    <NativeSelectOption key={venue} value={venue}>
                      {venue}
                    </NativeSelectOption>
                  ))}
                  <NativeSelectOption value={OTHER_VENUE}>Tempat lain di luar hub</NativeSelectOption>
                </NativeSelect>
              </Field>
              {venueChoice === OTHER_VENUE && (
                <TextField className="sm:col-span-2" id="event-location" label="Alamat tempat" value={form.location} onChange={(v) => set("location", v)} error={err("location")} />
              )}
              <TextField
                id="event-capacity"
                label="Kuota peserta"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                step={1}
                value={String(form.maxCapacity || "")}
                onChange={(v) => set("maxCapacity", Number(v))}
                error={err("maxCapacity")}
                hint={capacityHint.isConfirmed && venueChoice !== OTHER_VENUE ? `Ruangan ini muat ${capacityHint.capacity} orang.` : undefined}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tiket</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              <div role="radiogroup" aria-label="Jenis tiket" className="grid grid-cols-2 gap-2 sm:max-w-sm">
                {[
                  { paid: false, label: "Gratis" },
                  { paid: true, label: "Berbayar" },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={form.isPaid === option.paid}
                    onClick={() => {
                      set("isPaid", option.paid);
                      if (option.paid && !(form.price > 0)) set("price", 25000);
                    }}
                    className={cn(
                      "h-9 rounded-md border text-sm font-medium transition-colors",
                      form.isPaid === option.paid ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {form.isPaid && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="event-price"
                    label="Harga tiket (Rp)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={String(form.price || "")}
                    onChange={(v) => set("price", Number(v))}
                    error={err("price")}
                  />
                  <TextField
                    id="event-share"
                    label="Usulan bagian Anda (%)"
                    type="number"
                    inputMode="numeric"
                    value={String(form.proposedOrganizerPercent)}
                    onChange={(v) => set("proposedOrganizerPercent", Number(v))}
                    error={err("proposedOrganizerPercent")}
                    hint={`Standarnya 80%. Dago Creative Hub menerima ${Math.max(0, 100 - form.proposedOrganizerPercent)}%.`}
                  />
                  {form.proposedOrganizerPercent !== 80 && (
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="event-share-reason">Alasan usulan bagi hasil</FieldLabel>
                      <Textarea id="event-share-reason" rows={2} value={form.revenueSplitReason} onChange={(e) => set("revenueSplitReason", e.target.value)} />
                    </Field>
                  )}
                </div>
              )}

              {/* Editor Jenis Tiket Bertingkat (Opsional jika ingin multi-tier) */}
              <div className="border-t pt-3">
                <TicketTiersEditor
                  tiers={form.ticketTiers || []}
                  onChange={(tiers) => {
                    set("ticketTiers", tiers);
                    const sumQ = tiers.reduce((acc, t) => acc + (Number(t.quota) || 0), 0);
                    if (sumQ > 0) set("maxCapacity", sumQ);
                    const hasPaid = tiers.some((t) => Number(t.price) > 0);
                    if (hasPaid) set("isPaid", true);
                  }}
                  maxVenueCapacity={capacityHint.capacity}
                />
              </div>

              {/* Kebijakan Refund (Hanya untuk event berbayar) */}
              {(form.isPaid || (form.ticketTiers && form.ticketTiers.some((t) => Number(t.price) > 0))) && (
                <div className="border-t pt-3">
                  <EventRefundPolicyEditor
                    value={form.refundPolicy || { policyType: "NO_REFUND" }}
                    onChange={(p) => set("refundPolicy", p)}
                  />
                </div>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dukungan dari hub</CardTitle>
            <CardDescription>Pilih yang Anda butuhkan. Admin mengonfirmasi saat meninjau.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              {atHub && (
                <CheckList legend="Fasilitas" items={HUB_FACILITIES} selected={form.collaborationFacilities} onToggle={(item, on) => toggleIn("collaborationFacilities", item, on)} />
              )}
              <CheckList legend="Promosi" items={HUB_PROMOTIONS} selected={form.collaborationPromotion} onToggle={(item, on) => toggleIn("collaborationPromotion", item, on)} />
              {!form.isPaid && (
                <Field>
                  <FieldLabel htmlFor="event-barter">Tawaran barter</FieldLabel>
                  <Textarea id="event-barter" rows={2} value={form.barterNote} onChange={(e) => set("barterNote", e.target.value)} placeholder="Misalnya dokumentasi foto untuk hub sebagai ganti ruangan" />
                  <FieldDescription>Boleh dikosongkan.</FieldDescription>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="event-guidelines">Info untuk peserta</FieldLabel>
                <Textarea id="event-guidelines" rows={3} value={form.guidelines} onChange={(e) => set("guidelines", e.target.value)} placeholder="Satu hal per baris, misalnya: bawa laptop sendiri" />
              </Field>
              <Field>
                <FieldLabel htmlFor="event-notes">Catatan untuk admin</FieldLabel>
                <Textarea id="event-notes" rows={2} value={form.collaborationNotes} onChange={(e) => set("collaborationNotes", e.target.value)} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        <Card className="overflow-hidden pt-0">
          <div className="flex aspect-video items-center justify-center bg-unit-event/10 text-unit-event">
            {form.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded or pasted URL of unknown host
              <img src={form.posterUrl} alt="" className="size-full object-cover" />
            ) : (
              <CalendarDays className="size-8" />
            )}
          </div>
          <CardHeader>
            <CardTitle className="text-balance">{form.title.trim() || "Judul event"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" />
              {form.startDate ? new Date(form.startDate).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Belum ada jadwal"}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" />
              <span className="truncate">{form.location || "Belum ada tempat"}</span>
            </span>
            <span className="flex items-center gap-2">
              <Ticket className="size-4 shrink-0" />
              {form.isPaid ? `${formatCurrencyIDR(form.price || 0)} · bagian Anda ${form.proposedOrganizerPercent}%` : "Gratis"}
            </span>
          </CardContent>
        </Card>
        {errorCount > 0 && <p className="text-sm text-destructive">Masih ada {errorCount} isian yang perlu diperbaiki.</p>}
        <Button type="submit" size="lg" disabled={isSubmitting || isCheckInStaff}>
          {isSubmitting ? <Spinner /> : null}
          {mode === "guest" ? "Daftar dan ajukan event" : "Ajukan event"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Batal
          </Button>
        )}
        <p className="text-sm text-muted-foreground">Admin meninjau pengajuan dalam 1 sampai 2 hari kerja. Tiket mulai dijual setelah event disetujui.</p>
      </aside>
    </form>
  );
}

interface TextFieldProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

function TextField({ id, label, value, onChange, error, hint, className, ...inputProps }: TextFieldProps) {
  return (
    <Field data-invalid={Boolean(error) || undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error) || undefined} {...inputProps} />
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

interface CheckListProps {
  legend: string;
  items: readonly string[];
  selected: string[];
  onToggle: (item: string, on: boolean) => void;
}

function CheckList({ legend, items, selected, onToggle }: CheckListProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <label key={item} className="flex items-center gap-2.5 text-sm">
            <Checkbox checked={selected.includes(item)} onCheckedChange={(checked) => onToggle(item, checked === true)} />
            {item}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
