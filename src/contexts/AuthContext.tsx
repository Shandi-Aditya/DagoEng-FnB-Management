"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthenticatedUser, RoleSlug, BusinessModuleCode, ScopeLevel, PersonaKey } from "@/types/auth";
import { getTenantName } from "@/lib/tenant";

export type { PersonaKey } from "@/types/auth";

interface AuthContextType {
  user: AuthenticatedUser | null;
  activeOrgModules: BusinessModuleCode[];
  toggleOrgModule: (moduleCode: BusinessModuleCode) => void;
  isLoading: boolean;
  login: (personaKey?: PersonaKey, customUser?: AuthenticatedUser) => Promise<boolean>;
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

  // 2a. F&B Tenant Owner: Kopi Senja (Scope: TENANT -> sees ONLY Kopi Senja F&B)
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
    outlet: null,
    permissions: [
      "dashboard:view", "orders:view", "tables:view", "inventory:view",
      "menu:view", "menu:manage", "customers:view", "reports:view"
    ],
  },

  // 2b. F&B Tenant Owner: Dapur Mama (Scope: TENANT -> sees ONLY Dapur Mama F&B)
  TENANT_OWNER_KITCHEN: {
    id: "user-owner-kitchen",
    email: "owner.dapurmama@dagoeng.com",
    name: "Siti Aminah (Owner Dapur Mama)",
    phone: "+62 813-2233-4411",
    role: { id: "role-owner", slug: "OWNER", name: "Owner" },
    scopeLevel: "TENANT",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-kitchen", name: "Dapur Mama", code: "DAPUR-MAMA", businessModule: "FNB" },
    outlet: null,
    permissions: [
      "dashboard:view", "orders:view", "tables:view", "inventory:view",
      "menu:view", "menu:manage", "customers:view", "reports:view"
    ],
  },

  // 2c. F&B Tenant Owner: Manis Bakery (Scope: TENANT -> sees ONLY Manis Bakery F&B)
  TENANT_OWNER_BAKERY: {
    id: "user-owner-bakery",
    email: "owner.manisbakery@dagoeng.com",
    name: "David Santoso (Owner Manis Bakery)",
    phone: "+62 812-9988-7766",
    role: { id: "role-owner", slug: "OWNER", name: "Owner" },
    scopeLevel: "TENANT",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-bakery", name: "Manis Bakery", code: "MANIS-BAKERY", businessModule: "FNB" },
    outlet: null,
    permissions: [
      "dashboard:view", "orders:view", "tables:view", "inventory:view",
      "menu:view", "menu:manage", "customers:view", "reports:view"
    ],
  },

  // 2d. F&B Tenant Owner: Warung Bu Narti (Scope: TENANT -> sees ONLY Warung Bu Narti F&B)
  TENANT_OWNER_TEA: {
    id: "user-owner-tea",
    email: "owner.warungbunarti@dagoeng.com",
    name: "Bu Narti (Owner Warung Bu Narti)",
    phone: "+62 817-4455-6677",
    role: { id: "role-owner", slug: "OWNER", name: "Owner" },
    scopeLevel: "TENANT",
    allowedModules: ["FNB"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: { id: "tenant-tea", name: "Warung Bu Narti", code: "WARUNG-BU-NARTI", businessModule: "FNB" },
    outlet: null,
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

  // 5. F&B Cashier Singaraja (Scope: OUTLET -> Single outlet POS & Coworking Frontdesk)
  CASHIER_SGR: {
    id: "user-cashier-sgr",
    email: "cashier.sgr@kopisenja.com",
    name: "Ni Kadek Sri (Kasir Singaraja)",
    phone: "+62 812-3456-7892",
    role: { id: "role-cashier", slug: "CASHIER", name: "Cashier" },
    scopeLevel: "OUTLET",
    allowedModules: ["FNB", "CO_WORKING"],
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

  // 10. Community Organizer: Dago Barista Guild
  COMMUNITY_BARISTA: {
    id: "user-comm-barista",
    email: "baristaguild@dagocreative.id",
    name: "Barista Community Bandung",
    phone: "+62 812-9876-5432",
    role: { id: "role-community", slug: "CUSTOMER", name: "Community Organizer" },
    scopeLevel: "TENANT",
    allowedModules: ["CO_WORKING"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null,
    outlet: null,
    permissions: ["events:manage_own"],
  },

  // 11. Community Organizer: Bandung Game Creators / Dev
  COMMUNITY_BANDUNGDEV: {
    id: "user-comm-bandungdev",
    email: "halo@bandungdev.org",
    name: "Bandung Game Creators Collective",
    phone: "+62 813-8899-0011",
    role: { id: "role-community", slug: "CUSTOMER", name: "Community Organizer" },
    scopeLevel: "TENANT",
    allowedModules: ["CO_WORKING"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null,
    outlet: null,
    permissions: ["events:manage_own"],
  },

  // 12. Community Organizer: Aksara Priangan
  COMMUNITY_AKSARAPRIANGAN: {
    id: "user-comm-aksara",
    email: "info@aksarapriangan.id",
    name: "Aksara Priangan Studio",
    phone: "+62 815-4433-2211",
    role: { id: "role-community", slug: "CUSTOMER", name: "Community Organizer" },
    scopeLevel: "TENANT",
    allowedModules: ["CO_WORKING"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null,
    outlet: null,
    permissions: ["events:manage_own"],
  },

  // 13. Event Field Staff with explicit check-in permission
  EVENT_STAFF: {
    id: "user-event-staff-demo",
    email: "eventstaff@dagoeng.com",
    name: "Dago Event Field Staff",
    phone: "+62 812-5566-7788",
    role: { id: "role-staff", slug: "WAITER", name: "Event Staff" },
    scopeLevel: "ORGANIZATION",
    allowedModules: ["CORE"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null,
    outlet: null,
    permissions: ["events:checkin"],
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function syncPersonaCookie(personaKey: string | null) {
  if (typeof document === "undefined") return;
  if (!personaKey) {
    document.cookie = "dagoeng_active_persona=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } else {
    document.cookie = `dagoeng_active_persona=${personaKey}; path=/; max-age=604800; SameSite=Lax`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Default perspective: Dago Organization Owner
  const [user, setUser] = useState<AuthenticatedUser | null>(DEMO_PERSONAS.DAGO_OWNER);
  // Default Active Modules in Organization: F&B + Co-working (Commercial is INACTIVE by default)
  const [activeOrgModules, setActiveOrgModules] = useState<BusinessModuleCode[]>(["CORE", "FNB", "CO_WORKING"]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    const isLoggedOut = localStorage.getItem("dagoeng_is_logged_out") === "true";
    if (isLoggedOut) {
      setUser(null);
      syncPersonaCookie(null);
      return;
    }
    const savedCustom = localStorage.getItem("dagoeng_custom_customer");
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        if (parsed && parsed.role?.slug === "CUSTOMER") {
          setUser(parsed);
          syncPersonaCookie("CUSTOMER_DEMO");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    const savedKey = localStorage.getItem("dagoeng_active_persona") as PersonaKey | null;
    let initialUser = (savedKey && DEMO_PERSONAS[savedKey]) ? DEMO_PERSONAS[savedKey] : DEMO_PERSONAS.DAGO_OWNER;
    const activeKey = (savedKey && DEMO_PERSONAS[savedKey]) ? savedKey : "DAGO_OWNER";
    syncPersonaCookie(activeKey);

    if (initialUser?.tenant?.id) {
      const freshName = getTenantName(initialUser.tenant.id);
      if (freshName && freshName !== initialUser.tenant.name) {
        initialUser = {
          ...initialUser,
          tenant: { ...initialUser.tenant, name: freshName },
        };
      }
    }
    if (savedKey && DEMO_PERSONAS[savedKey]) {
      setUser(initialUser);
    }
  }, []);

  useEffect(() => {
    const handleTenantUpdated = () => {
      setUser((current) => {
        if (!current?.tenant?.id) return current;
        const freshName = getTenantName(current.tenant.id);
        if (freshName && freshName !== current.tenant.name) {
          return {
            ...current,
            tenant: {
              ...current.tenant,
              name: freshName,
            },
          };
        }
        return current;
      });
    };

    window.addEventListener("tenant_settings_updated", handleTenantUpdated);
    return () => window.removeEventListener("tenant_settings_updated", handleTenantUpdated);
  }, []);

  const toggleOrgModule = (moduleCode: BusinessModuleCode) => {
    setActiveOrgModules((prev) =>
      prev.includes(moduleCode) ? prev.filter((m) => m !== moduleCode) : [...prev, moduleCode]
    );
  };

  const login = async (personaKey?: PersonaKey, customUser?: AuthenticatedUser) => {
    setIsLoading(true);
    if (customUser) {
      setUser(customUser);
      localStorage.removeItem("dagoeng_is_logged_out");
      localStorage.setItem("dagoeng_custom_customer", JSON.stringify(customUser));
      localStorage.removeItem("dagoeng_active_persona");
      syncPersonaCookie(null);
      if (customUser.email) {
        localStorage.setItem("dago_organizer_email", customUser.email);
      }
    } else {
      const key = personaKey || "DAGO_OWNER";
      const targetUser = DEMO_PERSONAS[key];
      setUser(targetUser);
      localStorage.removeItem("dagoeng_is_logged_out");
      localStorage.removeItem("dagoeng_custom_customer");
      localStorage.setItem("dagoeng_active_persona", key);
      syncPersonaCookie(key);
      if (targetUser?.email) {
        localStorage.setItem("dago_organizer_email", targetUser.email);
      }
    }
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
    syncPersonaCookie("CUSTOMER_DEMO");
    setIsLoading(false);
    return customCustomer;
  };

  const logout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout network call error:", e);
    }

    // Play smooth animated logout transition for 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setUser(null);
    localStorage.removeItem("dagoeng_active_persona");
    localStorage.removeItem("dagoeng_custom_customer");
    localStorage.setItem("dagoeng_is_logged_out", "true");
    syncPersonaCookie(null);
    setIsLoggingOut(false);
  };

  const switchPersona = async (personaKey: PersonaKey) => {
    const target = DEMO_PERSONAS[personaKey];
    if (target) {
      setUser(target);
      localStorage.removeItem("dagoeng_is_logged_out");
      localStorage.removeItem("dagoeng_custom_customer");
      localStorage.setItem("dagoeng_active_persona", personaKey);
      syncPersonaCookie(personaKey);
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
      {isLoggingOut && <LogoutOverlay />}
    </AuthContext.Provider>
  );
}

function LogoutOverlay() {
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setProgress(100), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[2px] animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-[270px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 text-center shadow-2xl shadow-slate-950/20 animate-in zoom-in-95 duration-200">
        {/* Animated Farewell Icon */}
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-[#3B7A57] to-[#52B788] text-white flex items-center justify-center shadow-md shadow-emerald-900/20">
          <span className="text-xl select-none animate-bounce">👋</span>
        </div>

        {/* Clean Farewell Texts without user name */}
        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
          Sampai Jumpa!
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mb-3.5">
          Sesi Anda telah berhasil diakhiri dengan aman.
        </p>

        {/* Minimal Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#3B7A57] to-[#52B788] h-full rounded-full transition-all duration-900 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[9px] text-slate-400 font-medium block">
            Mengalihkan...
          </span>
        </div>
      </div>
    </div>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
