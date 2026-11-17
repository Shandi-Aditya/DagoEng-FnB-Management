import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentEmployees,
  savePersistentEmployee,
  deletePersistentEmployee,
} from "@/lib/persistent-storage";
import { getRequestAuthUser, TRUSTED_PERSONAS } from "@/lib/server-auth";
import { revokeUserSessionsAfter } from "@/lib/session-revocation";
import {
  findUnifiedUserByEmail,
  updateUnifiedUserCredentialsOrRole,
} from "@/lib/unified-account";
import { RoleSlug } from "@/types/auth";
import { EmployeeProfile } from "@/types/shift";

export const dynamic = "force-dynamic";

const EMPLOYEE_ADMIN_ROLES: readonly RoleSlug[] = ["SUPER_ADMIN", "OWNER", "MANAGER"];

async function assertEmployeeAdminAuth(req: NextRequest): Promise<NextResponse | null> {
  const auth = await getRequestAuthUser(req);
  if (!auth.isAuthenticated || !auth.role) {
    return NextResponse.json(
      { success: false, error: auth.error || "UNAUTHORIZED: Autentikasi sesi server diperlukan." },
      { status: 401 }
    );
  }
  if (!EMPLOYEE_ADMIN_ROLES.includes(auth.role)) {
    return NextResponse.json(
      {
        success: false,
        error: `FORBIDDEN: Role [${auth.role}] tidak memiliki izin mengelola data karyawan.`,
      },
      { status: 403 }
    );
  }
  if (auth.role === "OWNER" && auth.scopeLevel === "TENANT") {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN: Tenant OWNER tidak memiliki izin mengelola karyawan hub.",
      },
      { status: 403 }
    );
  }
  return null;
}

function mapEmployeeToUnifiedRole(employee: EmployeeProfile): "CUSTOMER" | "STAFF" | "ADMIN" {
  if (employee.status === "NON-AKTIF") return "CUSTOMER";
  if (/owner|admin|manager/i.test(`${employee.role} ${employee.department}`)) return "ADMIN";
  return "STAFF";
}

function hasSecurityRelevantEmployeeChange(prev: EmployeeProfile, next: EmployeeProfile): boolean {
  const prevEmail = (prev.email || "").trim().toLowerCase();
  const nextEmail = (next.email || "").trim().toLowerCase();
  return (
    prev.role !== next.role ||
    prev.department !== next.department ||
    prevEmail !== nextEmail ||
    (prev.status !== next.status && next.status !== "AKTIF") ||
    JSON.stringify(prev.permissions || []) !== JSON.stringify(next.permissions || [])
  );
}

async function revokeEmployeeSessions(
  emails: Array<string | undefined | null>,
  employee?: EmployeeProfile
): Promise<void> {
  const uniqueEmails = Array.from(
    new Set(emails.map((e) => (e || "").trim().toLowerCase()).filter(Boolean))
  );

  for (const email of uniqueEmails) {
    await revokeUserSessionsAfter(email);
    for (const persona of Object.values(TRUSTED_PERSONAS)) {
      if (persona.email.toLowerCase() === email) {
        await revokeUserSessionsAfter(persona.userId);
      }
    }
    if (employee && findUnifiedUserByEmail(email)) {
      await updateUnifiedUserCredentialsOrRole(email, {
        newRole: mapEmployeeToUnifiedRole(employee),
      });
    }
  }
}

/**
 * GET /api/employees
 * Fetches all employee profiles from persistent server storage.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const status = searchParams.get("status");

    let employees = await getPersistentEmployees();

    if (outletId && outletId !== "ALL") {
      employees = employees.filter((e) => e.outletId === outletId || !e.outletId);
    }
    if (status) {
      employees = employees.filter((e) => e.status === status);
    }

    return NextResponse.json({
      success: true,
      employees,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data karyawan." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees
 * Creates or updates an employee profile in persistent server storage.
 */
export async function POST(req: NextRequest) {
  try {
    const authError = await assertEmployeeAdminAuth(req);
    if (authError) return authError;

    const body = await req.json().catch(() => ({}));
    const employeeData = body.employee || body;

    if (!employeeData || !employeeData.name) {
      return NextResponse.json(
        { success: false, error: "Nama karyawan wajib diisi." },
        { status: 400 }
      );
    }

    const existingList = employeeData.id ? await getPersistentEmployees() : [];
    const existing = employeeData.id
      ? existingList.find((e) => e.id === employeeData.id)
      : undefined;

    const employee: EmployeeProfile = {
      id: employeeData.id || `emp-${Date.now()}`,
      employeeNumber:
        employeeData.employeeNumber ||
        `EMP-${(employeeData.outletName || "SGR").slice(0, 3).toUpperCase()}-${Math.floor(
          100 + Math.random() * 900
        )}`,
      name: employeeData.name.trim(),
      role: employeeData.role || "Staff",
      department: employeeData.department || "Service",
      outletId: employeeData.outletId || "outlet-sgr",
      outletName: employeeData.outletName || "Singaraja",
      contact: employeeData.contact || "",
      email: employeeData.email || "",
      status: employeeData.status || "AKTIF",
      assignedShift: employeeData.assignedShift || "Shift Pagi (08:00 - 16:00)",
      joinedDate: employeeData.joinedDate || new Date().toLocaleDateString("id-ID"),
      permissions: employeeData.permissions || ["pos_access"],
    };

    const saved = await savePersistentEmployee(employee);

    if (existing && hasSecurityRelevantEmployeeChange(existing, saved)) {
      await revokeEmployeeSessions([existing.email, saved.email], saved);
    }

    return NextResponse.json({
      success: true,
      employee: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan data karyawan." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employees
 * Updates an existing employee profile in persistent server storage.
 */
export async function PUT(req: NextRequest) {
  try {
    const authError = await assertEmployeeAdminAuth(req);
    if (authError) return authError;

    const body = await req.json().catch(() => ({}));
    const id = body.id || body.employee?.id;
    const updates = body.updates || body.employee || body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID karyawan wajib disertakan." },
        { status: 400 }
      );
    }

    const existingList = await getPersistentEmployees();
    const target = existingList.find((e) => e.id === id);

    if (!target) {
      return NextResponse.json(
        { success: false, error: `Karyawan dengan ID [${id}] tidak ditemukan.` },
        { status: 404 }
      );
    }

    const merged: EmployeeProfile = {
      ...target,
      ...updates,
      id,
    };

    const saved = await savePersistentEmployee(merged);

    if (hasSecurityRelevantEmployeeChange(target, saved)) {
      await revokeEmployeeSessions([target.email, saved.email], saved);
    }

    return NextResponse.json({
      success: true,
      employee: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui data karyawan." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/employees
 * Deletes an employee profile from persistent server storage.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authError = await assertEmployeeAdminAuth(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");
    let id = idFromQuery;

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID karyawan wajib disertakan untuk penghapusan." },
        { status: 400 }
      );
    }

    const existingList = await getPersistentEmployees();
    const target = existingList.find((e) => e.id === id);

    await deletePersistentEmployee(id);

    if (target?.email) {
      await revokeEmployeeSessions([target.email]);
    }

    return NextResponse.json({
      success: true,
      message: `Karyawan dengan ID [${id}] berhasil dihapus.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus data karyawan." },
      { status: 500 }
    );
  }
}
