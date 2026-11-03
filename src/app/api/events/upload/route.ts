import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Allowed file extensions
const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Max 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File gambar tidak ditemukan dalam permintaan." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Format file tidak didukung. Harap unggah gambar JPG, PNG, WEBP, atau GIF.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Ukuran file terlalu besar. Maksimal ukuran gambar adalah 10MB.",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate safe unique filename
    const ext = EXTENSION_MAP[file.type] || path.extname(file.name) || ".jpg";
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const filename = `poster-${uniqueSuffix}${ext}`;

    const isVercel = Boolean(
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV
    );

    // If running in Vercel Serverless environment, local filesystem is read-only.
    // Encode image directly as safe Base64 Data URI so it renders immediately anywhere without cloud credentials.
    if (isVercel) {
      const base64 = buffer.toString("base64");
      const dataUri = `data:${file.type};base64,${base64}`;

      return NextResponse.json({
        success: true,
        url: dataUri,
        filename,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      });
    }

    try {
      const uploadDir = path.join(process.cwd(), "public/images/events");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, buffer);

      const publicUrl = `/images/events/${filename}`;

      return NextResponse.json({
        success: true,
        url: publicUrl,
        filename,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      });
    } catch (fsErr: any) {
      console.warn("Local upload write failed, falling back to data URI:", fsErr?.message);
      const base64 = buffer.toString("base64");
      const dataUri = `data:${file.type};base64,${base64}`;

      return NextResponse.json({
        success: true,
        url: dataUri,
        filename,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      });
    }
  } catch (error: any) {
    console.error("POST /api/events/upload error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengunggah gambar. Silakan coba kembali." },
      { status: 500 }
    );
  }
}
