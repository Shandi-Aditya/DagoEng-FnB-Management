import { NextRequest, NextResponse } from "next/server";
import {
  getPersistentEmployees,
  savePersistentEmployee,
  deletePersistentEmployee,
} from "@/lib/persistent-storage";
import { EmployeeProfile } from "@/types/shift";

export const dynamic = "force-dynamic";

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
    const body = await req.json().catch(() => ({}));
    const employeeData = body.employee || body;

    if (!employeeData || !employeeData.name) {
      return NextResponse.json(
        { success: false, error: "Nama karyawan wajib diisi." },
        { status: 400 }
      );
    }

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

    await deletePersistentEmployee(id);

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
