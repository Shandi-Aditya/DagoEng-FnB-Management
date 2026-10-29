import path from "path";

export const ALLOWED_PROOF_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

export const ALLOWED_PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/**
 * Validates the file header magic bytes to prevent file extension spoofing / content sniffing.
 */
export function validateMagicBytes(buffer: Buffer, extension: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  const ext = extension.toLowerCase();

  // JPEG / JPG: FF D8 FF
  if (ext === ".jpg" || ext === ".jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47 (0x89 'P' 'N' 'G')
  if (ext === ".png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // WEBP: RIFF at byte 0, WEBP at byte 8
  if (ext === ".webp") {
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  // PDF: %PDF (25 50 44 46)
  if (ext === ".pdf") {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  return false;
}

/**
 * Validates and sanitizes a requested proof filename to strictly prevent path traversal.
 * Disallows null bytes, slashes, parent directory sequences (..), and special shell characters.
 */
export function sanitizeProofFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  const trimmed = filename.trim();
  if (!trimmed || trimmed.includes("\0")) return null;

  const base = path.basename(trimmed);
  // Must match safe regex: only alphanumeric, hyphen, underscore, and dot
  if (base !== trimmed || !/^[a-zA-Z0-9_\-\.]+$/.test(base)) {
    return null;
  }

  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_PROOF_EXTENSIONS.has(ext)) {
    return null;
  }

  return base;
}

