"use client";

import React, { useRef, useState } from "react";
import { ImageUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const MAX_POSTER_BYTES = 10 * 1024 * 1024;

interface PosterFieldProps {
  value: string;
  onChange: (url: string) => void;
  error?: string;
}

/** Upload a poster (or paste a link) and see it as it will appear. */
export function PosterField({ value, onChange, error }: PosterFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return setUploadError("Pilih file gambar: JPG, PNG, WEBP, atau GIF.");
    if (file.size > MAX_POSTER_BYTES) return setUploadError("Ukuran gambar maksimal 10 MB.");
    setIsUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/events/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Poster gagal diunggah.");
      onChange(json.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Poster gagal diunggah.");
    } finally {
      setIsUploading(false);
    }
  };

  const message = uploadError ?? error;

  return (
    <Field data-invalid={Boolean(message) || undefined}>
      <FieldLabel htmlFor="event-poster">Poster</FieldLabel>
      {value ? (
        <div className="relative w-full max-w-56 overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded or pasted URL of unknown host */}
          <img src={value} alt="Pratinjau poster" className="aspect-3/4 w-full object-cover" />
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute top-2 right-2"
            onClick={() => onChange("")}
            aria-label="Hapus poster"
          >
            <X />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50",
            isDragging && "border-unit-event bg-unit-event/5",
          )}
        >
          {isUploading ? <Spinner /> : <ImageUp className="size-6" />}
          <span className="font-medium text-foreground">{isUploading ? "Mengunggah poster" : "Pilih atau tarik gambar ke sini"}</span>
          <span>JPG, PNG, WEBP, atau GIF, maksimal 10 MB. Rasio 3:4 tampil paling baik.</span>
        </button>
      )}
      <input
        ref={inputRef}
        id="event-poster"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {!value && (
        <>
          {showLink ? (
            <Input
              placeholder="https://…/poster.jpg"
              aria-label="Tautan poster"
              onBlur={(e) => e.target.value.trim() && onChange(e.target.value.trim())}
            />
          ) : (
            <FieldDescription>
              Poster sudah online?{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => setShowLink(true)}>
                Tempel tautannya
              </button>
            </FieldDescription>
          )}
        </>
      )}
      {message ? <FieldError>{message}</FieldError> : null}
    </Field>
  );
}
