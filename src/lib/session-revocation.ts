import { mutatePersistentData, readPersistentData } from "./persistent-storage";

const FILE_SESSION_REVOCATIONS = "session_revocations.json";

type RevocationMap = Record<string, number>;

function normalizeKey(userIdOrEmail?: string | null): string {
  return (userIdOrEmail || "").trim().toLowerCase();
}

export async function revokeUserSessionsAfter(
  userIdOrEmail: string,
  timestampMs: number = Date.now()
): Promise<void> {
  const key = normalizeKey(userIdOrEmail);
  if (!key) return;
  await mutatePersistentData<RevocationMap>(FILE_SESSION_REVOCATIONS, {}, (current) => ({
    ...current,
    [key]: Math.max(current[key] ?? 0, timestampMs),
  }));
}

export async function getLatestRevocation(
  ...identities: Array<string | null | undefined>
): Promise<number> {
  const keys = identities.map(normalizeKey).filter(Boolean);
  if (keys.length === 0) return 0;
  const revocations = await readPersistentData<RevocationMap>(FILE_SESSION_REVOCATIONS, {});
  return Math.max(0, ...keys.map((k) => revocations[k] ?? 0));
}

export async function isSessionRevoked(params: {
  issuedAtMs: number;
  identities: Array<string | null | undefined>;
}): Promise<boolean> {
  const revokedAt = await getLatestRevocation(...params.identities);
  return revokedAt > 0 && params.issuedAtMs <= revokedAt;
}
