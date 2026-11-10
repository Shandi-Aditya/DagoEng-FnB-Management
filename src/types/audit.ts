export type ActivityModule =
  | "POS"
  | "TABLES"
  | "INVENTORY"
  | "MENU"
  | "LOYALTY"
  | "COWORKING"
  | "COMMERCIAL"
  | "EMPLOYEES_SHIFT"
  | "FINANCE"
  | "USER_RBAC"
  | "SETTINGS"
  | "AI_INSIGHT"
  | "AUTH"
  | "SECURITY"
  | "SYSTEM";

export type AuditModule = ActivityModule;
export type AuditStatus = "SUCCESS" | "WARNING" | "FAILED";
export type ActivitySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ActivityCategory =
  | "TRANSACTION"
  | "INVENTORY"
  | "SECURITY"
  | "CONFIGURATION"
  | "MEMBERSHIP"
  | "STAFF"
  | "OPERATIONAL";

export interface ActivityLogEntry {
  id: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  role?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  organization?: string;
  organizationName?: string;
  tenantId?: string;
  tenantName?: string;
  outletId?: string;
  outletName?: string;
  module: ActivityModule;
  action: string;
  recordId?: string;
  referenceId?: string;
  timestamp: string; // ISO string
  formattedTime?: string;
  previousValue?: string;
  newValue?: string;
  description: string;
  reason?: string;
  status?: AuditStatus;
  severity?: ActivitySeverity;
  category?: ActivityCategory;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export type AuditLogEntry = ActivityLogEntry;
