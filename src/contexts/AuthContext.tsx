"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AuthenticatedUser, RoleSlug, BusinessModuleCode, ScopeLevel, PersonaKey } from "@/types/auth";
import { getTenantName } from "@/lib/tenant";

export type { PersonaKey } from "@/types/auth";

export const STAFF_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export const STAFF_ACTIVITY_STORAGE_KEY = "dagoeng_last_activity_at";

export function isStaffRole(role: RoleSlug | string | null | undefined): boolean {
  return Boolean(role && role !== "CUSTOMER");
}

export function isStaffIdleExpired(
  lastActivityAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  timeoutMs: number = STAFF_IDLE_TIMEOUT_MS
): boolean {
  if (lastActivityAtMs === null || lastActivityAtMs === undefined || !Number.isFinite(lastActivityAtMs)) {
    return false;
  }
  return nowMs - lastActivityAtMs >= timeoutMs;
}

export function getCookieValue(name: string, cookieString?: string): string | null {
  const rawCookie =
    cookieString !== undefined
      ? cookieString
      : typeof document !== "undefined"
        ? document.cookie
        : "";
  if (!rawCookie) return null;
  const prefix = `${name}=`;
  for (const part of rawCookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  activeOrgModules: BusinessModuleCode[];
  toggleOrgModule: (moduleCode: BusinessModuleCode) => void;
  isLoading: boolean;
  isLoggingOut: boolean;
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
    name: "Bagus Pratama (Petugas Check-In Dago)",
    phone: "+62 812-5566-7788",
    role: { id: "role-checkin-staff", slug: "CHECKIN_STAFF", name: "Petugas Check-In" },
    scopeLevel: "ORGANIZATION",
    allowedModules: ["CORE"],
    organization: { id: "org-dago-hub", name: "Dago Creative Hub", code: "DAGO-HUB" },
    tenant: null,
    outlet: null,
    permissions: ["events:checkin"],
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const OPERATIONAL_COOKIE_MAX_AGE = 16 * 60 * 60; // 16 hours (POS-23)

function syncPersonaCookie(personaKey: string | null) {
  if (typeof document === "undefined") return;
  if (!personaKey) {
    document.cookie = "dagoeng_active_persona=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    document.cookie = "dagoeng_persona_exp=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  } else {
    const expMs = Date.now() + OPERATIONAL_COOKIE_MAX_AGE * 1000;
    document.cookie = `dagoeng_active_persona=${personaKey}; path=/; max-age=${OPERATIONAL_COOKIE_MAX_AGE}; SameSite=Lax`;
    document.cookie = `dagoeng_persona_exp=${expMs}; path=/; max-age=${OPERATIONAL_COOKIE_MAX_AGE}; SameSite=Lax`;
  }
}

function ensurePersonaCookieSynced(
  personaKey: string,
  currentCookie: string | null,
  currentExpCookie: string | null
) {
  if (currentCookie !== personaKey || !currentExpCookie) {
    syncPersonaCookie(personaKey);
  }
}

function syncStaffActivityKey(roleSlug: RoleSlug | string | undefined): void {
  if (isStaffRole(roleSlug)) {
    localStorage.setItem(STAFF_ACTIVITY_STORAGE_KEY, String(Date.now()));
  } else {
    localStorage.removeItem(STAFF_ACTIVITY_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [activeOrgModules, setActiveOrgModules] = useState<BusinessModuleCode[]>(["CORE", "FNB", "CO_WORKING"]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const clearClientSessionStorage = useCallback(() => {
    localStorage.removeItem("dagoeng_active_persona");
    localStorage.removeItem("dagoeng_custom_customer");
    localStorage.removeItem(STAFF_ACTIVITY_STORAGE_KEY);
    syncPersonaCookie(null);
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    setUser(null);
    clearClientSessionStorage();
    localStorage.setItem("dagoeng_is_logged_out", "true");

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        keepalive: true,
      });
    } catch (e) {
      console.error("Logout network call error:", e);
    } finally {
      setIsLoggingOut(false);
    }
  }, [clearClientSessionStorage]);

  useEffect(() => {
    const isLoggedOut = localStorage.getItem("dagoeng_is_logged_out") === "true";
    if (isLoggedOut) {
      setUser(null);
      clearClientSessionStorage();
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const authReason = params.get("reason");
    const personaCookie = getCookieValue("dagoeng_active_persona");
    const personaExpCookie = getCookieValue("dagoeng_persona_exp");
    const hasExpiredPersonaExp =
      personaExpCookie !== null &&
      (!Number.isFinite(Number(personaExpCookie)) || Number(personaExpCookie) <= Date.now());
    const savedKey = localStorage.getItem("dagoeng_active_persona") as PersonaKey | null;
    const isMissingPersonaCookie = Boolean(savedKey) && !personaCookie;

    const hasInvalidatedSessionSignal =
      authReason === "expired" ||
      authReason === "revoked" ||
      hasExpiredPersonaExp ||
      isMissingPersonaCookie;

    if (hasInvalidatedSessionSignal) {
      setUser(null);
      clearClientSessionStorage();
      setIsLoading(false);
      return;
    }

    const abortIfStaffIdleExpired = (roleSlug: RoleSlug | string | undefined): boolean => {
      if (!isStaffRole(roleSlug)) return false;
      const lastActivityRaw = localStorage.getItem(STAFF_ACTIVITY_STORAGE_KEY);
      if (
        lastActivityRaw &&
        isStaffIdleExpired(Number(lastActivityRaw), Date.now(), STAFF_IDLE_TIMEOUT_MS)
      ) {
        setUser(null);
        clearClientSessionStorage();
        localStorage.setItem("dagoeng_is_logged_out", "true");
        void fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
        setIsLoading(false);
        if (window.location.pathname !== "/login") {
          window.location.assign("/login?reason=expired");
        }
        return true;
      }
      if (!lastActivityRaw) {
        localStorage.setItem(STAFF_ACTIVITY_STORAGE_KEY, String(Date.now()));
      }
      return false;
    };

    const savedCustom = localStorage.getItem("dagoeng_custom_customer");
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        if (parsed) {
          const personaMatch = Object.entries(DEMO_PERSONAS).find(
            ([_, p]) => p.email.toLowerCase() === parsed.email?.toLowerCase()
          );
          if (personaMatch) {
            const matchedUser = personaMatch[1];
            if (abortIfStaffIdleExpired(matchedUser.role.slug)) return;
            setUser(matchedUser);
            localStorage.setItem("dagoeng_active_persona", personaMatch[0]);
            localStorage.removeItem("dagoeng_custom_customer");
            ensurePersonaCookieSynced(personaMatch[0], personaCookie, personaExpCookie);
            setIsLoading(false);
            return;
          }

          if (typeof parsed.role === "string") {
            const rSlug = parsed.role as RoleSlug;
            parsed.role = {
              id: `role-${rSlug.toLowerCase()}`,
              slug: rSlug,
              name: rSlug === "OWNER" ? "Owner" : rSlug === "CUSTOMER" ? "Customer" : rSlug,
            };
          }

          if (abortIfStaffIdleExpired(parsed.role?.slug)) return;

          setUser(parsed);
          syncPersonaCookie(null);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (savedKey && DEMO_PERSONAS[savedKey]) {
      let initialUser = DEMO_PERSONAS[savedKey];
      if (abortIfStaffIdleExpired(initialUser.role.slug)) return;
      if (initialUser?.tenant?.id) {
        const freshName = getTenantName(initialUser.tenant.id);
        if (freshName && freshName !== initialUser.tenant.name) {
          initialUser = {
            ...initialUser,
            tenant: { ...initialUser.tenant, name: freshName },
          };
        }
      }
      setUser(initialUser);
      ensurePersonaCookieSynced(savedKey, personaCookie, personaExpCookie);
    } else {
      setUser(null);
      syncPersonaCookie(null);
    }
    setIsLoading(false);
  }, [clearClientSessionStorage]);

  useEffect(() => {
    if (isLoading || !user || !isStaffRole(user.role.slug)) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const recordActivity = () => {
      try {
        localStorage.setItem(STAFF_ACTIVITY_STORAGE_KEY, String(Date.now()));
      } catch {}
    };

    if (!localStorage.getItem(STAFF_ACTIVITY_STORAGE_KEY)) {
      recordActivity();
    }

    const checkIdleTimeout = () => {
      if (cancelled) return;
      const raw = localStorage.getItem(STAFF_ACTIVITY_STORAGE_KEY);
      const lastMs = raw ? Number(raw) : NaN;
      if (Number.isFinite(lastMs) && isStaffIdleExpired(lastMs, Date.now(), STAFF_IDLE_TIMEOUT_MS)) {
        cancelled = true;
        void logout().finally(() => {
          if (window.location.pathname !== "/login") {
            window.location.assign("/login?reason=expired");
          }
        });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkIdleTimeout();
      }
    };

    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity, { passive: true });
    window.addEventListener("focus", checkIdleTimeout);
    document.addEventListener("visibilitychange", handleVisibility);
    const intervalId = window.setInterval(checkIdleTimeout, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("focus", checkIdleTimeout);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [user, isLoading, logout]);

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    if (isLoading || !user) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    let isChecking = false;

    const verifyServerSession = async () => {
      if (cancelled || isChecking) return;
      isChecking = true;
      try {
        let res: Response;
        try {
          res = await fetch("/api/auth/session", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
          });
        } catch {
          return;
        }
        if (cancelled) return;
        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          const reason = data?.code === "SESSION_EXPIRED" ? "expired" : "revoked";
          cancelled = true;
          await logout();
          if (window.location.pathname !== "/login") {
            window.location.assign(`/login?reason=${reason}`);
          }
        }
      } finally {
        isChecking = false;
      }
    };

    void verifyServerSession();

    const handleFocus = () => {
      void verifyServerSession();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void verifyServerSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const intervalId = window.setInterval(() => {
      void verifyServerSession();
    }, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [user, isLoading, logout]);

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

  const login = async (personaKey?: PersonaKey, customUser?: any) => {
    setIsLoading(true);

    // If personaKey is provided or customUser matches a known demo persona email, ALWAYS prioritize canonical DEMO_PERSONAS
    const matchedKey = personaKey || (customUser?.email
      ? (Object.keys(DEMO_PERSONAS) as PersonaKey[]).find(
          (k) => DEMO_PERSONAS[k].email.toLowerCase() === customUser.email.toLowerCase()
        )
      : undefined);

    if (matchedKey && DEMO_PERSONAS[matchedKey]) {
      const targetUser = DEMO_PERSONAS[matchedKey];
      setUser(targetUser);
      localStorage.removeItem("dagoeng_is_logged_out");
      localStorage.removeItem("dagoeng_custom_customer");
      localStorage.setItem("dagoeng_active_persona", matchedKey);
      syncStaffActivityKey(targetUser.role.slug);
      if (typeof document !== "undefined") {
        document.cookie = "dagoeng_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      }
      syncPersonaCookie(matchedKey);
      if (targetUser?.email) {
        localStorage.setItem("dago_organizer_email", targetUser.email);
      }
    } else if (customUser) {
      const roleSlug: RoleSlug = typeof customUser.role === "string" ? customUser.role : customUser.role?.slug || "CUSTOMER";
      const normalizedRole = {
        id: `role-${roleSlug.toLowerCase()}`,
        slug: roleSlug,
        name: typeof customUser.role === "object" && customUser.role?.name
          ? customUser.role.name
          : roleSlug === "OWNER" ? "Owner" : roleSlug === "CUSTOMER" ? "Customer" : roleSlug,
      };

      const normalizedUser: AuthenticatedUser = {
        ...customUser,
        role: normalizedRole,
        scopeLevel: customUser.scopeLevel || "TENANT",
        allowedModules: customUser.allowedModules || ["CORE", "FNB", "CO_WORKING"],
        permissions: customUser.permissions || [],
      };

      setUser(normalizedUser);
      localStorage.removeItem("dagoeng_is_logged_out");
      localStorage.setItem("dagoeng_custom_customer", JSON.stringify(normalizedUser));
      localStorage.removeItem("dagoeng_active_persona");
      syncStaffActivityKey(normalizedUser.role.slug);
      syncPersonaCookie(null);
      if (normalizedUser.email) {
        localStorage.setItem("dago_organizer_email", normalizedUser.email);
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
    localStorage.removeItem(STAFF_ACTIVITY_STORAGE_KEY);
    localStorage.setItem("dagoeng_custom_customer", JSON.stringify(customCustomer));
    localStorage.setItem("dagoeng_active_persona", "CUSTOMER_DEMO");
    syncPersonaCookie("CUSTOMER_DEMO");
    setIsLoading(false);
    return customCustomer;
  };

  const switchPersona = async (personaKey: PersonaKey) => {
    const target = DEMO_PERSONAS[personaKey];
    if (target) {
      setUser(target);
      localStorage.removeItem("dagoeng_is_logged_out");
      localStorage.removeItem("dagoeng_custom_customer");
      localStorage.setItem("dagoeng_active_persona", personaKey);
      syncStaffActivityKey(target.role.slug);
      if (typeof document !== "undefined") {
        document.cookie = "dagoeng_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      }
      if (target.email) {
        localStorage.setItem("dago_organizer_email", target.email);
      }
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
        isLoggingOut,
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
