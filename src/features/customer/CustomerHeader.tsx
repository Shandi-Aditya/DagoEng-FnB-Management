"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LogIn, LogOut, MapPin, ShoppingBag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/features/layout/ModeToggle";

export interface CustomerHeaderProps {
  outletName: string;
  cartTotalItems: number;
  onOpenCart: () => void;
  isLoggedIn: boolean;
  userName?: string;
  userRole?: string;
  isStaff: boolean;
  onLogout: () => void;
  activeTab: string;
}

export function CustomerHeader({
  outletName,
  cartTotalItems,
  onOpenCart,
  isLoggedIn,
  userName,
  userRole,
  isStaff,
  onLogout,
  activeTab,
}: CustomerHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo & Outlet Location */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Image
              src="/logo-dago.png"
              alt="Logo Dago Creative Hub"
              width={20}
              height={26}
              priority
              className="object-contain"
            />
            <span className="hidden sm:inline">Dago Creative Hub</span>
          </Link>

          <span className="text-muted-foreground/40 hidden sm:inline">/</span>

          <div className="flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-xs">
            <MapPin className="size-3 text-muted-foreground" />
            <span className="font-medium text-foreground">{outletName}</span>
          </div>
        </div>

        {/* Right Actions: ModeToggle, Cart, Account */}
        <div className="flex items-center gap-2">
          <ModeToggle />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenCart}
            aria-label={`Keranjang belanja (${cartTotalItems} item)`}
          >
            <ShoppingBag />
            <span className="hidden sm:inline">Keranjang</span>
            {cartTotalItems > 0 ? (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 font-mono text-xs tabular-nums">
                {cartTotalItems}
              </Badge>
            ) : null}
          </Button>

          {isStaff ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                render={
                  <Link
                    href={
                      userRole === "COMMUNITY_ORGANIZER" || userRole === "ORGANIZER"
                        ? "/events/portal"
                        : "/dashboard"
                    }
                  />
                }
                nativeButton={false}
              >
                <span>Dashboard</span>
                <ArrowRight />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onLogout} aria-label="Ganti akun">
                <LogOut />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          ) : !isLoggedIn ? (
            <Button
              size="sm"
              render={
                <Link
                  href={`/login?returnTo=${encodeURIComponent(`/customer?tab=${activeTab}`)}&mode=customer`}
                />
              }
              nativeButton={false}
            >
              <LogIn />
              <span>Masuk</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-medium text-foreground sm:inline">{userName}</span>
              <Button type="button" size="sm" variant="outline" onClick={onLogout} aria-label="Keluar">
                <LogOut />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

