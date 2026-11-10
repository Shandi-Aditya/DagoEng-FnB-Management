import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { MIME_BY_EXTENSION } from "@/lib/file-security";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/posters/[filename]
 * Public CDN/asset endpoint to serve event poster images reliably on Vercel Serverless.
 * Reads from local disk (if available) or retrieves from PostgreSQL SystemSetting (POSTER_<filename>).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const rawFilename = params?.filename;
    if (!rawFilename || typeof rawFilename !== "string") {
      return NextResponse.json({ success: false, error: "Nama file poster diperlukan." }, { status: 400 });
    }

    // Security check: reject path traversal
    const safeFilename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!safeFilename || safeFilename !== rawFilename) {
      return NextResponse.json({ success: false, error: "Format nama file poster tidak valid." }, { status: 400 });
    }

    // 1. Check local filesystem cache
    const publicDiskPath = path.join(process.cwd(), "public/images/events", safeFilename);
    const tmpDiskPath = path.join("/tmp", safeFilename);

    let fileBuffer: Buffer | null = null;
    if (fs.existsSync(publicDiskPath)) {
      try {
        fileBuffer = fs.readFileSync(publicDiskPath);
      } catch {}
    } else if (fs.existsSync(tmpDiskPath)) {
      try {
        fileBuffer = fs.readFileSync(tmpDiskPath);
      } catch {}
    }

    // 2. Distributed Database fallback: recover from PostgreSQL SystemSetting
    if (!fileBuffer && process.env.DATABASE_URL) {
      try {
        const { db } = await import("@/lib/db");
        const posterKey = `POSTER_${safeFilename}`;
        const record = await db.systemSetting.findUnique({ where: { key: posterKey } });
        if (record && record.value) {
          fileBuffer = Buffer.from(record.value, "base64");
          // Cache to /tmp for fast subsequent reads within this lambda container
          try {
            fs.writeFileSync(tmpDiskPath, fileBuffer);
          } catch {}
        }
      } catch (dbErr) {
        console.warn(`[poster-recovery] Failed to retrieve ${safeFilename} from DB:`, dbErr);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { success: false, error: "File poster acara tidak ditemukan." },
        { status: 404 }
      );
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = MIME_BY_EXTENSION[ext] || "image/jpeg";

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error: any) {
    console.error("GET /api/events/posters/[filename] error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memproses file poster event." },
      { status: 500 }
    );
  }
}

