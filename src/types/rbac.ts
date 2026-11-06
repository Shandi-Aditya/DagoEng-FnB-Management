import { RoleSlug } from "./auth";

export type PermissionCode =
  | "dashboard:view"
  | "dashboard:compare_outlets"
  | "pos:operate"
  | "orders:view"
  | "orders:manage"
  | "tables:view"
  | "tables:manage"
  | "kitchen:kds"
  | "inventory:view"
  | "inventory:manage"
  | "menu:view"
  | "menu:manage"
  | "customers:view"
  | "reports:view"
  | "employees:manage"
  | "settings:manage";

export interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  requiredPermission?: PermissionCode;
  allowedRoles?: RoleSlug[];
  badge?: string;
}
