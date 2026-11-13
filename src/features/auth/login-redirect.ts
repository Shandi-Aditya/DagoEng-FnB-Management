/** Areas a customer-role account may not open unless the server's login response grants that area. */
const RESTRICTED_PREFIXES = [
  "/dashboard",
  "/events-admin",
  "/events/checkin",
  "/events/portal",
  "/settings",
  "/reports",
  "/employees",
  "/commercial",
  "/coworking",
  "/kitchen",
  "/pos",
  "/waiter",
  "/tables",
  "/inventory",
  "/customers",
  "/activity-log",
] as const;

/** True when `path` is `prefix` itself or a page under it (not merely a longer name that starts the same). */
function isUnder(path: string, prefix: string): boolean {
  if (path === prefix) return true;
  return path.startsWith(prefix) && ["/", "?", "#"].includes(path.charAt(prefix.length));
}

interface PostLoginInput {
  /** Already sanitized relative path, or null. */
  returnTo: string | null;
  role: string | undefined;
  /** Where the login API says this account belongs, e.g. "/events/portal" for an organizer. */
  serverRedirect?: string | null;
}

/** Where to send someone right after a successful login. */
export function resolvePostLoginDestination({ returnTo, role, serverRedirect }: PostLoginInput): string {
  const home = serverRedirect || "/dashboard";
  if (!returnTo) return home;

  const isCustomer = role === "CUSTOMER";
  if (isCustomer) {
    // Plain prefix match on purpose: as strict as the old inline check.
    const restricted = RESTRICTED_PREFIXES.some((prefix) => returnTo.startsWith(prefix));
    if (!restricted) return returnTo;
    // An organizer logs in with a customer role; the server's redirect is what grants the portal.
    return serverRedirect && isUnder(returnTo, serverRedirect) ? returnTo : "/customer";
  }

  if (isUnder(returnTo, "/customer")) return home;
  return returnTo;
}
