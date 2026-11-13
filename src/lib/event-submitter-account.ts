export const MIN_ORGANIZER_PASSWORD_LENGTH = 6;

interface SubmitterAccountInput {
  /** Email of the session on the request, if any. */
  sessionEmail: string | null;
  /** Organizer email typed in the submission. */
  email: string;
  accountExists: boolean;
  password: string;
  /** Whether `password` matched the existing account (only meaningful when it exists). */
  passwordMatches: boolean;
}

export type SubmitterAccountDecision =
  | { kind: "session" }
  | { kind: "existing" }
  | { kind: "register" }
  | { kind: "reject"; status: 400 | 401; error: string };

/**
 * Who an event submission belongs to, decided before the event is stored. An existing account is
 * only ever used with its own session or its own password; a new one needs a password the
 * submitter chose.
 */
export function decideSubmitterAccount(input: SubmitterAccountInput): SubmitterAccountDecision {
  const email = input.email.trim().toLowerCase();
  if (input.sessionEmail && input.sessionEmail.trim().toLowerCase() === email) return { kind: "session" };

  const password = input.password.trim();
  if (input.accountExists) {
    if (password && input.passwordMatches) return { kind: "existing" };
    return {
      kind: "reject",
      status: 401,
      error: "Email ini sudah terdaftar. Masuk dengan akun tersebut, lalu ajukan event dari portal penyelenggara.",
    };
  }

  if (password.length < MIN_ORGANIZER_PASSWORD_LENGTH) {
    return { kind: "reject", status: 400, error: `Buat password minimal ${MIN_ORGANIZER_PASSWORD_LENGTH} karakter.` };
  }
  return { kind: "register" };
}
