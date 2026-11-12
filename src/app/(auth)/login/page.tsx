"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Search,
  Ticket,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useLoyalty } from "@/contexts/LoyaltyContext";
import {
  HERO_PHOTO,
  PARTNER_ROLES,
} from "@/features/landing/home/home-content";
import { BrandLink } from "@/features/landing/home/HomeNav";
import { ModeToggle } from "@/features/layout/ModeToggle";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: "current-password" | "new-password";
}

/** Password field with a show/hide toggle inside the input group. */
function PasswordInput({
  id,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: PasswordInputProps) {
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          onClick={onToggle}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        >
          {visible ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

/**
 * Strictly sanitizes returnTo parameter to prevent open-redirect vulnerabilities.
 * Only allows relative application paths beginning with "/" (and strictly rejects "//", "/\", absolute URLs with protocols, or backslash manipulation).
 */
function sanitizeReturnTo(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":") &&
    !trimmed.includes("\\")
  ) {
    return trimmed;
  }
  return null;
}

/** Right-hand stage: the hub's photo with a card naming who signs in here, like the landing page's product frames. */
function LoginStage() {
  return (
    <div
      className="relative isolate hidden overflow-hidden bg-muted p-10 lg:flex lg:items-end"
      data-alt={HERO_PHOTO.wanted}
    >
      <Image
        src={HERO_PHOTO.src}
        alt={HERO_PHOTO.alt}
        fill
        priority
        sizes="50vw"
        className="-z-10 object-cover saturate-75 dark:brightness-[0.35]"
      />
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Satu akun untuk semua yang bekerja di sini</CardTitle>
          <CardDescription>
            Setelah masuk, Anda diarahkan ke halaman sesuai peran.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {PARTNER_ROLES.map((role) => (
              <li
                key={role.id}
                className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm font-medium">{role.title}</span>
                <span className="text-xs text-muted-foreground">
                  {role.line}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginCustomer } = useAuth();
  const { getOrCreateMember } = useLoyalty();

  const fromParam = searchParams.get("from");
  const returnTo = sanitizeReturnTo(
    searchParams.get("returnTo") || searchParams.get("redirect"),
  );
  const initialMode = searchParams.get("mode");

  const isFromEvents =
    fromParam === "events" || returnTo?.startsWith("/events");

  // Determine back navigation link explicitly based on source context.
  // NEVER send the visitor to returnTo (which may be a protected destination) on cancel/back!
  const backHref = isFromEvents ? "/events" : "/";

  // Form Mode: Universal Login (default) or Register
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Universal Login Credentials (Empty by default in production)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Customer Register Form States
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  useEffect(() => {
    if (initialMode === "register") {
      setIsRegisterMode(true);
    }
  }, [initialMode]);

  /**
   * Universal Login Handler with Backend Role Auto-Detection & Safe Auto-Routing
   */
  const handleUniversalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(
          data.error || "Gagal masuk. Periksa kembali email dan password Anda.",
        );
        setIsLoading(false);
        return;
      }

      // Synchronize client authentication context with the verified identity
      await login(data.personaKey, data.user);
      setIsLoading(false);

      // Auto-routing destination determination
      let targetDestination = data.redirectUrl || "/dashboard";

      // If safe returnTo parameter exists, validate RBAC boundaries before redirecting:
      if (returnTo) {
        const userRole = data.user?.role?.slug || data.user?.role;
        const isCustomer = userRole === "CUSTOMER";
        const isRestrictedAdminRoute =
          returnTo.startsWith("/dashboard") ||
          returnTo.startsWith("/events-admin") ||
          returnTo.startsWith("/events/checkin") ||
          returnTo.startsWith("/events/portal") ||
          returnTo.startsWith("/settings") ||
          returnTo.startsWith("/reports") ||
          returnTo.startsWith("/employees") ||
          returnTo.startsWith("/commercial") ||
          returnTo.startsWith("/coworking") ||
          returnTo.startsWith("/kitchen") ||
          returnTo.startsWith("/pos") ||
          returnTo.startsWith("/waiter") ||
          returnTo.startsWith("/tables") ||
          returnTo.startsWith("/inventory") ||
          returnTo.startsWith("/customers") ||
          returnTo.startsWith("/activity-log");

        if (isCustomer && isRestrictedAdminRoute) {
          // Fallback to customer portal to prevent unauthorized access attempt
          targetDestination = "/customer";
        } else if (!isCustomer && returnTo.startsWith("/customer")) {
          // If a staff/admin/organizer logs in from the customer portal, route to their role's natural destination
          targetDestination = data.redirectUrl || "/dashboard";
        } else {
          targetDestination = returnTo;
        }
      }

      router.push(targetDestination);
    } catch (err: any) {
      console.error("Universal login error:", err);
      setErrorMessage(
        "Terjadi kendala jaringan saat menghubungi server autentikasi.",
      );
      setIsLoading(false);
    }
  };

  /**
   * New Member Registration Handler
   */
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPhone.trim()) {
      setErrorMessage("Nomor telepon/WhatsApp wajib diisi.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const cleanPhone = regPhone.trim();
      const cleanEmail =
        regEmail.trim() ||
        `${cleanPhone.replace(/[^0-9]/g, "")}@customer.dagoeng.com`;

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim() || "Pelanggan Member",
          email: cleanEmail,
          phone: cleanPhone,
          password: regPassword || "Password123!",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(
          data.error || "Pendaftaran gagal. Periksa kembali data Anda.",
        );
        setIsLoading(false);
        return;
      }

      // Initialize loyalty member
      const member = getOrCreateMember({
        name: data.user.name,
        phone: data.user.phone,
        email: data.user.email,
        initialPoints: 50,
      });

      await loginCustomer({
        name: member.name,
        phone: member.phone,
        email: member.email,
      });

      setIsLoading(false);

      if (returnTo) {
        router.push(returnTo);
      } else {
        router.push("/customer");
      }
    } catch (err: any) {
      console.error("Customer registration error:", err);
      setErrorMessage("Terjadi kendala jaringan saat memproses pendaftaran.");
      setIsLoading(false);
    }
  };

  const switchMode = (register: boolean) => {
    setErrorMessage(null);
    setIsRegisterMode(register);
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between gap-2">
          <BrandLink />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={backHref} />}
              nativeButton={false}
            >
              <ArrowLeft />
              Kembali
            </Button>
            <ModeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-6">
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Image
                src="/logo-dago.png"
                alt="Logo Dago Creative Hub"
                width={60}
                height={81}
                priority
                className="mb-4 self-center object-contain"
              />
              <h1 className="text-3xl font-medium tracking-tight">
                {isRegisterMode ? "Daftar member" : "Masuk"}
              </h1>
              <p className="text-sm text-balance text-muted-foreground">
                {isRegisterMode
                  ? "Gratis, dan langsung dapat 50 poin."
                  : "Satu akun untuk staf, mitra, penyelenggara, dan member."}
              </p>
            </div>

            {isFromEvents && !isRegisterMode ? (
              <Alert>
                <Ticket />
                <AlertTitle>Pesan tiket sebagai tamu?</AlertTitle>
                <AlertDescription>
                  <p>Tiket tanpa akun bisa dicari lewat kode pesanan.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href="/events/tickets/recovery" />}
                      nativeButton={false}
                    >
                      <Search />
                      Cari tiket tamu
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      render={<Link href="/events" />}
                      nativeButton={false}
                    >
                      Lihat event
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {!isRegisterMode ? (
              <form onSubmit={handleUniversalLogin}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@contoh.com"
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <PasswordInput
                      id="password"
                      value={password}
                      onChange={setPassword}
                      visible={showPassword}
                      onToggle={() => setShowPassword((v) => !v)}
                      autoComplete="current-password"
                    />
                  </Field>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? <Spinner /> : null}
                    {isLoading ? "Memeriksa akun" : "Masuk"}
                  </Button>
                </FieldGroup>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="reg-name">Nama lengkap</FieldLabel>
                    <Input
                      id="reg-name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reg-phone">Nomor WhatsApp</FieldLabel>
                    <Input
                      id="reg-phone"
                      type="tel"
                      inputMode="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="08123456789"
                      autoComplete="tel"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reg-email">Email</FieldLabel>
                    <Input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      autoComplete="email"
                    />
                    <FieldDescription>Opsional.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reg-password">Password</FieldLabel>
                    <PasswordInput
                      id="reg-password"
                      value={regPassword}
                      onChange={setRegPassword}
                      visible={showRegPassword}
                      onToggle={() => setShowRegPassword((v) => !v)}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? <Spinner /> : null}
                    {isLoading ? "Mendaftarkan" : "Daftar dan ambil 50 poin"}
                  </Button>
                </FieldGroup>
              </form>
            )}

            <p className="text-sm text-muted-foreground">
              {isRegisterMode
                ? "Sudah punya akun?"
                : "Belum punya akun member?"}
              <Button
                variant="link"
                size="sm"
                onClick={() => switchMode(!isRegisterMode)}
              >
                {isRegisterMode ? "Masuk" : "Daftar"}
              </Button>
            </p>
          </div>
        </div>
      </div>

      <LoginStage />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Memuat
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
