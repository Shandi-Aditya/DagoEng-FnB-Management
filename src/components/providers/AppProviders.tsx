"use client";

import React from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { OutletProvider } from "@/contexts/OutletContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ActivityLogProvider } from "@/contexts/ActivityLogContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { ProductProvider } from "@/contexts/ProductContext";
import { TableProvider } from "@/contexts/TableContext";
import { InventoryProvider } from "@/contexts/InventoryContext";
import { OrderProvider } from "@/contexts/OrderContext";
import { LoyaltyProvider } from "@/contexts/LoyaltyContext";
import { CoworkingProvider } from "@/contexts/CoworkingContext";
import { CommercialProvider } from "@/contexts/CommercialContext";
import { EmployeeShiftProvider } from "@/contexts/EmployeeShiftContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OutletProvider>
        <ActivityLogProvider>
          <SettingsProvider>
            <NotificationProvider>
              <DateFilterProvider>
                <ProductProvider>
                  <InventoryProvider>
                    <TableProvider>
                      <OrderProvider>
                        <LoyaltyProvider>
                          <CoworkingProvider>
                            <CommercialProvider>
                              <EmployeeShiftProvider>
                                {children}
                              </EmployeeShiftProvider>
                            </CommercialProvider>
                          </CoworkingProvider>
                        </LoyaltyProvider>
                      </OrderProvider>
                    </TableProvider>
                  </InventoryProvider>
                </ProductProvider>
              </DateFilterProvider>
            </NotificationProvider>
          </SettingsProvider>
        </ActivityLogProvider>
      </OutletProvider>
    </AuthProvider>
  );
}
