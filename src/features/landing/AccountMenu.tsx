"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogIn, LogOut, Ticket, UtensilsCrossed } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { accountRoleLabel, canOpenDashboard } from "@/features/landing/landing-logic";

const ORGANIZER_EMAIL_KEY = "dago_organizer_email";

/** Login button for guests, account dropdown for signed-in visitors. */
export function AccountMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Button variant="outline" size="lg" render={<Link href="/login" />} nativeButton={false}>
        <LogIn />
        Masuk
      </Button>
    );
  }

  const handleLogout = async () => {
    localStorage.removeItem(ORGANIZER_EMAIL_KEY);
    await logout();
    router.replace("/login");
  };

  const initial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="gap-2 pl-2" />}>
        <Avatar className="size-5">
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
        <span className="max-w-32 truncate">{user.name || "Akun"}</span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
            <span className="text-sm font-medium text-foreground">{user.name || "Pengguna DagoEng"}</span>
            <span className="truncate text-xs">{user.email}</span>
            <span className="text-xs">{accountRoleLabel(user.role)}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/events/portal" />}>
            <Ticket />
            Portal penyelenggara event
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/customer" />}>
            <UtensilsCrossed />
            Portal pelanggan
          </DropdownMenuItem>
          {canOpenDashboard(user.role?.slug) ? (
            <DropdownMenuItem render={<Link href="/dashboard" />}>
              <LayoutDashboard />
              Dashboard manajemen
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
