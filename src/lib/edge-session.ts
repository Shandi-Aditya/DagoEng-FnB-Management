import { RoleSlug, ScopeLevel } from "@/types/auth";

export const EDGE_SESSION_COOKIE_NAME = "dagoeng_edge_token";
export const OPERATIONAL_MAX_AGE_SECONDS = 16 * 60 * 60; // 16 hours (POS-23)
export const OPERATIONAL_MAX_AGE_MS = OPERATIONAL_MAX_AGE_SECONDS * 1000;

export interface EdgeSessionPayload {
  userId: string;
  role: RoleSlug;
  scopeLevel?: ScopeLevel;
  email?: string;
  sessionHash?: string;
  iat: number; // issued at (ms)
  exp: number; // expires at (ms)
}

export interface EdgeTokenVerification {
  valid: boolean;
  expired: boolean;
  payload: EdgeSessionPayload | null;
  reason?: string;
}

export function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  if (isProduction) {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "CRITICAL_SECURITY_ERROR: SESSION_SECRET must be set and at least 32 characters in production."
      );
    }
    return secret.trim();
  }

  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  return "dev-test-only-hmac-secret-key-2026-v1-min32chars";
}

// Pure TypeScript SHA-256 & HMAC-SHA256 so middleware works identically in Edge and Node runtimes
const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const ml = msg.length * 8;
  const paddedLength = Math.ceil((msg.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(msg);
  padded[msg.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(ml / 0x100000000), false);
  view.setUint32(paddedLength - 4, ml >>> 0, false);

  const w = new Int32Array(64);

  for (let i = 0; i < paddedLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setInt32(0, h0, false);
  outView.setInt32(4, h1, false);
  outView.setInt32(8, h2, false);
  outView.setInt32(12, h3, false);
  outView.setInt32(16, h4, false);
  outView.setInt32(20, h5, false);
  outView.setInt32(24, h6, false);
  outView.setInt32(28, h7, false);
  return out;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function hmacSha256Hex(keyStr: string, messageStr: string): string {
  const encoder = new TextEncoder();
  let keyBytes: Uint8Array = encoder.encode(keyStr);
  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const paddedKey = new Uint8Array(64);
  paddedKey.set(keyBytes);

  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const msgBytes = encoder.encode(messageStr);
  const innerInput = new Uint8Array(64 + msgBytes.length);
  innerInput.set(iKeyPad);
  innerInput.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(64 + 32);
  outerInput.set(oKeyPad);
  outerInput.set(innerHash, 64);
  return toHex(sha256Bytes(outerInput));
}

function base64UrlEncode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "===".slice((b64.length + 3) % 4);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf-8");
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Signs a session payload into a compact HMAC-SHA256 token (`base64url(payload).signatureHex`).
 */
export function signEdgeSessionToken(
  input: Omit<EdgeSessionPayload, "iat" | "exp"> & { iat?: number; exp?: number; maxAgeSeconds?: number }
): string {
  const now = input.iat ?? Date.now();
  const maxAgeMs = (input.maxAgeSeconds ?? OPERATIONAL_MAX_AGE_SECONDS) * 1000;
  const payload: EdgeSessionPayload = {
    userId: input.userId,
    role: input.role,
    scopeLevel: input.scopeLevel,
    email: input.email,
    sessionHash: input.sessionHash,
    iat: now,
    exp: input.exp ?? now + maxAgeMs,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacSha256Hex(getSigningSecret(), encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a signed edge session token: signature and expiry only. Revocation needs storage, so it is checked in server-auth (Node runtime).
 */
export function verifyEdgeSessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now()
): EdgeTokenVerification {
  if (!token || typeof token !== "string") {
    return { valid: false, expired: false, payload: null, reason: "MISSING_TOKEN" };
  }

  let secret: string;
  try {
    secret = getSigningSecret();
  } catch (err: any) {
    return {
      valid: false,
      expired: false,
      payload: null,
      reason: err?.message || "MISSING_PRODUCTION_SECRET",
    };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, expired: false, payload: null, reason: "MALFORMED_TOKEN" };
  }

  const [encodedPayload, signature] = parts;
  const expectedSig = hmacSha256Hex(secret, encodedPayload);

  if (!timingSafeEqualStr(signature, expectedSig)) {
    return { valid: false, expired: false, payload: null, reason: "INVALID_SIGNATURE" };
  }

  let payload: EdgeSessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return { valid: false, expired: false, payload: null, reason: "INVALID_PAYLOAD" };
  }

  if (!payload || !payload.userId || !payload.role || typeof payload.exp !== "number") {
    return { valid: false, expired: false, payload: null, reason: "INCOMPLETE_PAYLOAD" };
  }

  if (payload.exp <= nowMs) {
    return {
      valid: false,
      expired: true,
      payload,
      reason: "SESSION_EXPIRED",
    };
  }

  return {
    valid: true,
    expired: false,
    payload,
  };
}

/**
 * Determines whether the unsigned demo persona cookie (`dagoeng_active_persona`)
 * is permitted in the current environment.
 * In production or when DISABLE_DEMO_LOGIN=true, unsigned persona cookies are rejected
 * unless UAT/demo mode is explicitly enabled.
 */
export function isPersonaCookieAllowedInEnv(
  personaRole: RoleSlug,
  personaScope?: ScopeLevel
): boolean {
  if (process.env.DISABLE_DEMO_LOGIN === "true") {
    return false;
  }

  if (process.env.ALLOW_DEMO_UAT === "true") {
    return true;
  }

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  if (isProduction) {
    const isExplicitDemo =
      process.env.ENABLE_DEMO_LOGIN === "true" ||
      process.env.ALLOW_DEMO_LOGIN === "true" ||
      process.env.NEXT_PUBLIC_ALLOW_DEMO_LOGIN === "true" ||
      process.env.NEXT_PUBLIC_DEMO_MODE === "true";

    if (isExplicitDemo) {
      return true;
    }

    const simulatorEnabled = process.env.ENABLE_ROLE_SIMULATOR === "true";
    if (!simulatorEnabled) {
      return false;
    }

    const isPrivileged =
      personaRole === "SUPER_ADMIN" ||
      personaRole === "OWNER" ||
      personaRole === "MANAGER" ||
      personaScope === "PLATFORM" ||
      personaScope === "ORGANIZATION";

    if (isPrivileged) {
      return false;
    }
  }

  return true;
}
