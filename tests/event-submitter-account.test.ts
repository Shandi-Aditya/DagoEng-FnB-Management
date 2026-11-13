import { describe, expect, it } from "vitest";

import { decideSubmitterAccount } from "@/lib/event-submitter-account";

describe("decideSubmitterAccount", () => {
  it("uses the signed-in session when it belongs to the submitted email", () => {
    expect(
      decideSubmitterAccount({ sessionEmail: "a@x.test", email: "A@x.test", accountExists: true, password: "", passwordMatches: false }),
    ).toEqual({ kind: "session" });
  });

  it("signs in an existing account only with its correct password", () => {
    expect(
      decideSubmitterAccount({ sessionEmail: null, email: "a@x.test", accountExists: true, password: "rahasia1", passwordMatches: true }),
    ).toEqual({ kind: "existing" });
  });

  it("refuses an existing account with a wrong or missing password, so no one can sign in as someone else", () => {
    for (const password of ["salah123", ""]) {
      const decision = decideSubmitterAccount({ sessionEmail: null, email: "a@x.test", accountExists: true, password, passwordMatches: false });
      expect(decision).toMatchObject({ kind: "reject", status: 401 });
    }
  });

  it("does not let a session for another email submit under this one without its password", () => {
    const decision = decideSubmitterAccount({ sessionEmail: "b@x.test", email: "a@x.test", accountExists: true, password: "", passwordMatches: false });
    expect(decision).toMatchObject({ kind: "reject", status: 401 });
  });

  it("registers a new account only with a password of at least 6 characters, never a default one", () => {
    expect(
      decideSubmitterAccount({ sessionEmail: null, email: "new@x.test", accountExists: false, password: "abcdef", passwordMatches: false }),
    ).toEqual({ kind: "register" });
    expect(
      decideSubmitterAccount({ sessionEmail: null, email: "new@x.test", accountExists: false, password: "abc", passwordMatches: false }),
    ).toMatchObject({ kind: "reject", status: 400 });
    expect(
      decideSubmitterAccount({ sessionEmail: null, email: "new@x.test", accountExists: false, password: "   ", passwordMatches: false }),
    ).toMatchObject({ kind: "reject", status: 400 });
  });
});
