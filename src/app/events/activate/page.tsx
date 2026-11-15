"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { UnitScope } from "@/components/app/unit-scope";
import { StatusBadge } from "@/components/app/status-badge";
import {
  ActivationHeader,
  ActivationLoadingState,
  ActivationOrganizerCard,
  ActivationSuccessView,
  ActivationInvalidTokenView,
  validatePasswordInput,
  getActivationErrorMessage,
  type OrganizerSummaryInfo,
} from "@/features/events-activate";

function ActivationFormContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [organizerInfo, setOrganizerInfo] = useState<OrganizerSummaryInfo | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token on component mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setValidationError("Tautan aktivasi tidak valid. Parameter token tidak ditemukan pada URL.");
      return;
    }

    if (process.env.NODE_ENV !== "production" && token === "preview") {
      setOrganizerInfo({
        name: "Komunitas Barista Dago",
        contactPerson: "Budi Santoso",
        email: "mitra.barista@dagoeng.com",
      });
      setExpiresAt(new Date(Date.now() + 48 * 3600 * 1000).toISOString());
      setValidationError(null);
      setIsLoading(false);
      return;
    }

    async function checkToken() {
      try {
        const res = await fetch(`/api/events/auth/activate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setOrganizerInfo(data.data.organizer);
          setExpiresAt(data.data.expiresAt);
          setValidationError(null);
        } else {
          setValidationError(data.error || "Tautan aktivasi tidak valid atau telah kedaluwarsa.");
        }
      } catch {
        setValidationError("Gagal menghubungi server untuk memvalidasi token aktivasi.");
      } finally {
        setIsLoading(false);
      }
    }

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validatePasswordInput(password, confirmPassword);
    if (!validation.valid) {
      setFormError(validation.error || "Password tidak memenuhi syarat.");
      return;
    }

    if (process.env.NODE_ENV !== "production" && token === "preview") {
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setIsSuccess(true);
      }, 500);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/events/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
      } else {
        setFormError(data.error || "Aktivasi gagal. Silakan coba kembali.");
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan saat aktivasi akun.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isLoading) {
    return <ActivationLoadingState />;
  }

  // 2. Success State
  if (isSuccess) {
    return (
      <ActivationSuccessView
        organizerName={organizerInfo?.name}
        email={organizerInfo?.email}
      />
    );
  }

  // 3. Invalid or Expired Token State
  if (validationError) {
    return (
      <ActivationInvalidTokenView
        validationError={getActivationErrorMessage(validationError)}
      />
    );
  }

  // 4. Form State (Valid Token)
  return (
    <Card className="max-w-md w-full mx-auto border-border shadow-xs">
      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Header Info */}
        <div className="text-center space-y-2">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-2xs">
            <ShieldCheck className="size-6" />
          </div>

          <StatusBadge status="neutral" className="mx-auto">
            Aktivasi Akun Penyelenggara
          </StatusBadge>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Buat Password Anda
            </h1>
            <p className="text-xs text-muted-foreground">
              Daftarkan password mandiri untuk mengakses Portal Penyelenggara Event DAGO.
            </p>
          </div>
        </div>

        {/* Organizer Summary Card */}
        {organizerInfo && (
          <ActivationOrganizerCard
            organizer={organizerInfo}
            expiresAt={expiresAt}
          />
        )}

        {/* Error Alert */}
        {formError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">
              {formError}
            </AlertDescription>
          </Alert>
        )}

        {/* Password Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="activatePassword" className="text-xs">
              Password Baru *
            </Label>
            <InputGroup>
              <InputGroupInput
                id="activatePassword"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                required
                minLength={8}
                autoComplete="new-password"
                className="text-xs"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="text-xs text-muted-foreground">
              Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activateConfirmPassword" className="text-xs">
              Konfirmasi Password *
            </Label>
            <InputGroup>
              <InputGroupInput
                id="activateConfirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password"
                required
                minLength={8}
                autoComplete="new-password"
                className="text-xs"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || password.length < 8}
              className="w-full gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>Mengaktifkan Akun...</span>
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  <span>Aktifkan Akun & Buat Password</span>
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="pt-3 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Sudah memiliki password?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ActivateOrganizerPage() {
  return (
    <div
      data-unit="event"
      className="min-h-screen bg-background text-foreground flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 space-y-6"
    >
      <UnitScope unit="event" />

      {/* Brand Header */}
      <ActivationHeader />

      <main className="w-full">
        <Suspense fallback={<ActivationLoadingState />}>
          <ActivationFormContent />
        </Suspense>
      </main>
    </div>
  );
}
