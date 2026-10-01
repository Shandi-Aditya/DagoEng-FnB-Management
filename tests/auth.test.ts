import { describe, it, expect } from "vitest";
import { hashSessionToken } from "../src/lib/session";

describe("Enhanced Session Security & Token Hashing", () => {
  it("generates deterministic SHA-256 hash for raw session tokens", () => {
    const rawToken = "dagoeng-super-secure-token-1234567890abcdef";
    const hash1 = hashSessionToken(rawToken);
    const hash2 = hashSessionToken(rawToken);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    expect(hash1).not.toBe(rawToken);
  });

  it("produces distinct hashes for different raw tokens", () => {
    const tokenA = "session-token-alpha";
    const tokenB = "session-token-beta";

    const hashA = hashSessionToken(tokenA);
    const hashB = hashSessionToken(tokenB);

    expect(hashA).not.toBe(hashB);
  });
});
