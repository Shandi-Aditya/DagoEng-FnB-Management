"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeShift } from "@/contexts/EmployeeShiftContext";
import { useOrders } from "@/contexts/OrderContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useSettings } from "@/contexts/SettingsContext";
import { CashDrawerShiftModal, buildCashDrawerShiftSummary } from "@/features/pos/CashDrawerShiftModal";
import { getTenantName } from "@/lib/tenant";

function initials(name: string | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "U";
}

function useCashierShiftSummary() {
  const { orders } = useOrders();
  const { activeShift } = useEmployeeShift();

  return useMemo(() => buildCashDrawerShiftSummary(orders, activeShift), [orders, activeShift]);
}

export function NavUser() {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { user, logout } = useAuth();
  const { activeOutlet } = useOutlet();
  const { activeShift, closeShift } = useEmployeeShift();
  const { settings } = useSettings();
  const summary = useCashierShiftSummary();
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  const isCashier = user?.role?.slug === "CASHIER";
  const subtitle = user?.tenant
    ? getTenantName(user.tenant.id) || user.tenant.name
    : user?.organization?.name || "Dago Hub";

  const handleLogout = async () => {
    if (isCashier && activeShift) {
      setIsShiftModalOpen(true);
      return;
    }
    await logout();
    router.replace("/login");
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-sidebar-accent" />}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.name}</span>
                <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">{initials(user?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 leading-tight">
                      <span className="truncate font-medium">{user?.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.role?.name}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut />
                {isCashier && activeShift ? "Tutup shift dan keluar" : "Keluar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      {isShiftModalOpen && activeShift ? (
        <CashDrawerShiftModal
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          shiftId={activeShift.id}
          cashierName={activeShift.assignedCashierName || user?.name || "Kasir Bertugas"}
          outletName={activeOutlet?.name || user?.outlet?.name || "Singaraja"}
          initialCash={summary.initialCash}
          totalCashSales={summary.cashSales}
          totalNonCashSales={summary.nonCashSales}
          totalTransactionsCount={summary.transactionsCount}
          qrisSales={summary.qrisSales}
          edcSales={summary.edcSales}
          totalDiscounts={summary.discounts}
          refundAmount={summary.refundAmount}
          storedTax={summary.storedTax}
          storedServiceCharge={summary.storedServiceCharge}
          isTaxEnabled={settings.isTaxEnabled}
          taxRatePercent={settings.taxRatePercent}
          onConfirmClose={(actualCash, notes) => closeShift(activeShift.id, actualCash, notes)}
        />
      ) : null}
    </>
  );
}
