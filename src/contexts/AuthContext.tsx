"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthenticatedUser, RoleSlug, BusinessModuleCode, ScopeLevel } from "@/types/auth";

export type PersonaKey =
  | "DAGO_OWNER"
  | "TENANT_OWNER_KS"
  | "COWORK_MANAGER"
  | "COMMERCIAL_MANAGER"
  | "CASHIER_SGR"
  | "KITCHEN_SGR"
  | "WAITER_SGR"
  | "CUSTOMER_DEMO"
  | "SUPER_ADMIN";

interface AuthContextType {
  user: AuthenticatedUser | null;
  activeOrgModules: BusinessModuleCode[];
  toggleOrgModule: (moduleCode: BusinessModuleCode) => void;
  isLoading: boolean;
  login: (personaKey?: PersonaKey) => Promise<boolean>;
  loginCustomer: (customerData: { name: string; phone: string; email?: string }) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  switchPersona: (personaKey: PersonaKey) => Promise<void>;
}

// Seeded Multi-Business Users matching the 3-Dimensional Authorization Model
export const DEMO_PERSONAS: Record<PersonaKey, AuthenticatedUser> = {
  // 1. Dago Creative Hub Owner (Scope: ORGANIZATION -> sees all F&B, Coworking, Commercial)
  DAGO_OWNER: {
    id: "user-dago-owner",
    email: "owner.dago@dagoeng.com",
    name: "Hendra Wijaya (Owner Dago Hub)",
    phone: "+62 811-2233-4455",
    role: { id: "role-owner", slug: "OWNER", name: "Owner" },
    scopeLevel: "ORGANIZATION",
    allowedModules: ["FNB", "CO_WORKING", "COMMERCIAL"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null, // Full organization scope
    outlet: null,
    permissions: [
      "dashboard:view", "dashboard:compare_outlets", "orders:view", "tables:view",
      "inventory:view", "menu:view", "menu:manage", "customers:view", "reports:view",
      "employees:manage", "settings:manage"
    ],
  },

  // 2. F&B Tenant Owner: Kopi Senja (Scope: TENANT -> sees ONLY Kopi Senja F&B)
  TENANT_OWNER_KS: {
    id: "user-owner-ks",
    email: "owner.kopisenja@dagoeng.com",
    name: "I Wayan Pratama (Owner Kopi Senja)",
    phone: "+62 812-3456-7890",
    role: { id: "role-owner", slug: "OWNER", name: "Owner" },
    scopeLevel: "TENANT",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
    outlet: null, // Scoped to Kopi Senja's outlets (Singaraja, Denpasar)
    permissions: [
      "dashboard:view", "orders:view", "tables:view", "inventory:view",
      "menu:view", "menu:manage", "customers:view", "reports:view"
    ],
  },

  // 3. Co-working Space Manager (Scope: BUSINESS_UNIT -> Co-working only)
  COWORK_MANAGER: {
    id: "user-mgr-cowork",
    email: "manager.cowork@dagoeng.com",
    name: "Rian Hidayat (Manager Coworking)",
    phone: "+62 813-7788-9900",
    role: { id: "role-manager", slug: "MANAGER", name: "Manager" },
    scopeLevel: "BUSINESS_UNIT",
    allowedModules: ["CO_WORKING"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-cowork", name: "Dago Cowork Space", code: "DAGO-COWORK", businessModule: "CO_WORKING" },
    outlet: null,
    permissions: ["dashboard:view", "reports:view", "employees:manage"],
  },

  // 4. Commercial Leases Manager (Scope: BUSINESS_UNIT -> Commercial only)
  COMMERCIAL_MANAGER: {
    id: "user-mgr-commercial",
    email: "manager.commercial@dagoeng.com",
    name: "Maya Santika (Manager Commercial)",
    phone: "+62 815-6677-8899",
    role: { id: "role-manager", slug: "MANAGER", name: "Manager" },
    scopeLevel: "BUSINESS_UNIT",
    allowedModules: ["COMMERCIAL"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null,
    outlet: null,
    permissions: ["dashboard:view", "reports:view"],
  },

  // 5. F&B Cashier Singaraja (Scope: OUTLET -> Single outlet POS)
  CASHIER_SGR: {
    id: "user-cashier-sgr",
    email: "cashier.sgr@kopisenja.com",
    name: "Ni Kadek Sri (Kasir Singaraja)",
    phone: "+62 812-3456-7892",
    role: { id: "role-cashier", slug: "CASHIER", name: "Cashier" },
    scopeLevel: "OUTLET",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
    outlet: { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
    permissions: ["pos:operate", "orders:view", "tables:view"],
  },

  // 6. Kitchen Staff (Scope: OUTLET -> KDS Station Singaraja)
  KITCHEN_SGR: {
    id: "user-kitchen-sgr",
    email: "kitchen.sgr@kopisenja.com",
    name: "Gede Agus (Chef Singaraja)",
    phone: "+62 812-3456-7893",
    role: { id: "role-kitchen", slug: "KITCHEN_STAFF", name: "Kitchen Staff" },
    scopeLevel: "OUTLET",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
    outlet: { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
    permissions: ["kitchen:kds", "orders:view"],
  },

  // 7. Waiter Floor (Scope: OUTLET -> Tables Singaraja)
  WAITER_SGR: {
    id: "user-waiter-sgr",
    email: "waiter.sgr@kopisenja.com",
    name: "Made Surya (Waiter Floor)",
    phone: "+62 812-3456-7895",
    role: { id: "role-waiter", slug: "WAITER", name: "Waiter" },
    scopeLevel: "OUTLET",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
    outlet: { id: "outlet-sgr", name: "Singaraja", code: "KS-SGR" },
    permissions: ["tables:view", "tables:manage", "orders:view"],
  },

  // 8. Customer Self-Order QR
  CUSTOMER_DEMO: {
    id: "user-customer-demo",
    email: "customer@gmail.com",
    name: "Ketut Dian (Customer Member)",
    phone: "+62 819-1122-3344",
    role: { id: "role-customer", slug: "CUSTOMER", name: "Customer" },
    scopeLevel: "TENANT",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
    outlet: null,
    permissions: ["menu:view"],
  },

  // 9. Platform Super Admin (Scope: PLATFORM)
  SUPER_ADMIN: {
    id: "user-admin",
    email: "admin@dagoeng.com",
    name: "Platform Super Admin",
    phone: "+62 812-3456-0000",
    role: { id: "role-admin", slug: "SUPER_ADMIN", name: "Super Admin" },
    scopeLevel: "PLATFORM",
    allowedModules: ["CORE", "FNB", "CO_WORKING", "COMMERCIAL"],
    organization: null,
    tenant: null,
    outlet: null,
    permissions: ["*"],
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Default perspective: Dago Organization Owner
  const [user, setUser] = useState<AuthenticatedUser | null>(DEMO_PERSONAS.DAGO_OWNER);
  // Default Active Modules in Organization: F&B + Co-working (Commercial is INACTIVE by default)
  const [activeOrgModules, setActiveOrgModules] = useState<BusinessModuleCode[]>(["CORE", "FNB", "CO_WORKING"]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const isLoggedOut = localStorage.getItem("dagoeng_is_logged_out") === "true";
    if (isLoggedOut) {
      setUser(null);
      return;
    }
    const savedCustom = localStorage.getItem("dagoeng_custom_customer");
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        if (parsed && parsed.role?.slug === "CUSTOMER") {
          setUser(parsed);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    const savedKey = localStorage.getItem("dagoeng_active_persona") as PersonaKey | null;
    if (savedKey && DEMO_PERSONAS[savedKey]) {
      setUser(DEMO_PERSONAS[savedKey]);
    }
  }, []);

  const toggleOrgModule = (moduleCode: BusinessModuleCode) => {
    setActiveOrgModules((prev) =>
      prev.includes(moduleCode) ? prev.filter((m) => m !== moduleCode) : [...prev, moduleCode]
    );
  };

  const login = async (personaKey: PersonaKey = "DAGO_OWNER") => {
    setIsLoading(true);
    const targetUser = DEMO_PERSONAS[personaKey];
    setUser(targetUser);
    localStorage.removeItem("dagoeng_is_logged_out");
    localStorage.removeItem("dagoeng_custom_customer");
    localStorage.setItem("dagoeng_active_persona", personaKey);
    setIsLoading(false);
    return true;
  };

  const loginCustomer = async (customerData: { name: string; phone: string; email?: string }): Promise<AuthenticatedUser> => {
    setIsLoading(true);
    const customCustomer: AuthenticatedUser = {
      id: `user-cust-${Date.now()}`,
      email: customerData.email?.trim() || "customer@dagoeng.com",
      name: customerData.name.trim(),
      phone: customerData.phone.trim(),
      role: { id: "role-customer", slug: "CUSTOMER", name: "Customer" },
      scopeLevel: "TENANT",
      allowedModules: ["FNB", "CO_WORKING"],
      organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
      tenant: { id: "tenant-ks", name: "Kopi Senja", code: "KOPI-SENJA", businessModule: "FNB" },
      outlet: null,
      permissions: ["menu:view"],
    };
    setUser(customCustomer);
    localStorage.removeItem("dagoeng_is_logged_out");
    localStorage.setItem("dagoeng_custom_customer", JSON.stringify(customCustomer));
    localStorage.setItem("dagoeng_active_persona", "CUSTOMER_DEMO");
    setIsLoading(false);
    return customCustomer;
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("dagoeng_active_persona");
    localStorage.removeItem("dagoeng_custom_customer");
    localStorage.setItem("dagoeng_is_logged_out", "true");
  };

  const switchPersona = async (personaKey: PersonaKey) => {
    const target = DEMO_PERSONAS[personaKey];
    if (target) {
      setUser(target);
      localStorage.removeItem("dagoeng_is_logged_out");
      localStorage.removeItem("dagoeng_custom_customer");
      localStorage.setItem("dagoeng_active_persona", personaKey);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeOrgModules,
        toggleOrgModule,
        isLoading,
        login,
        loginCustomer,
        logout,
        switchPersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
