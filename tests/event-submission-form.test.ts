import { describe, expect, it } from "vitest";

import {
  buildSubmissionPayload,
  emptySubmissionForm,
  isHubVenue,
  toWitaIso,
  validateSubmissionForm,
  type SubmissionForm,
} from "@/features/events-portal/event-submission";

function validForm(overrides: Partial<SubmissionForm> = {}): SubmissionForm {
  return {
    ...emptySubmissionForm({ name: "Komunitas Kopi", email: "kopi@example.test", phone: "081234567890" }),
    title: "Ngopi bareng",
    description: "Diskusi santai soal kopi lokal.",
    posterUrl: "/uploads/poster.png",
    startDate: "2026-12-01T10:00",
    endDate: "2026-12-01T12:00",
    ...overrides,
  };
}

describe("toWitaIso", () => {
  it("treats a datetime-local value as WITA", () => {
    expect(toWitaIso("2026-12-01T10:00")).toBe("2026-12-01T10:00:00+08:00");
    expect(toWitaIso("2026-12-01T10:00:00Z")).toBe("2026-12-01T10:00:00Z");
    expect(toWitaIso("")).toBe("");
  });
});

describe("isHubVenue", () => {
  it("recognises the hub's own rooms", () => {
    expect(isHubVenue("Main Hall Dago Creative Hub")).toBe(true);
    expect(isHubVenue("Boardroom Ubud (12 Pax)")).toBe(true);
    expect(isHubVenue("Kafe di Lovina")).toBe(false);
  });
});

describe("validateSubmissionForm", () => {
  it("accepts a complete form", () => {
    expect(validateSubmissionForm(validForm(), { needsPassword: false })).toEqual({});
  });

  it("reports each problem against its field", () => {
    const errors = validateSubmissionForm(
      validForm({ title: "ab", posterUrl: "", endDate: "2026-12-01T09:00", isPaid: true, price: 0 }),
      { needsPassword: false },
    );
    expect(Object.keys(errors).sort()).toEqual(["endDate", "posterUrl", "price", "title"]);
  });

  it("asks a guest for a password but not someone already signed in", () => {
    expect(validateSubmissionForm(validForm({ password: "" }), { needsPassword: true })).toHaveProperty("password");
    expect(validateSubmissionForm(validForm({ password: "" }), { needsPassword: false })).not.toHaveProperty("password");
  });

  it("checks the proposed split only for paid events", () => {
    expect(
      validateSubmissionForm(validForm({ isPaid: true, price: 25000, proposedOrganizerPercent: 120 }), { needsPassword: false }),
    ).toHaveProperty("proposedOrganizerPercent");
    expect(validateSubmissionForm(validForm({ proposedOrganizerPercent: 120 }), { needsPassword: false })).toEqual({});
  });

  it("rejects a poster URL that is not http(s) or our own upload", () => {
    expect(validateSubmissionForm(validForm({ posterUrl: "javascript:alert(1)" }), { needsPassword: false })).toHaveProperty(
      "posterUrl",
    );
  });
});

describe("buildSubmissionPayload", () => {
  it("converts dates, derives the platform share, and drops hub facilities outside the hub", () => {
    const payload = buildSubmissionPayload(
      validForm({
        isPaid: true,
        price: 30000,
        proposedOrganizerPercent: 85,
        location: "Kafe di Lovina",
        collaborationFacilities: ["Proyektor"],
        password: " rahasia ",
      }),
    );
    expect(payload).toMatchObject({
      startDate: "2026-12-01T10:00:00+08:00",
      price: 30000,
      proposedOrganizerPercent: 85,
      proposedPlatformPercent: 15,
      collaborationFacilities: [],
      password: "rahasia",
    });
  });

  it("sends a free event with price 0 and no password when none was typed", () => {
    const payload = buildSubmissionPayload(validForm({ price: 50000, password: "" }));
    expect(payload.price).toBe(0);
    expect(payload.password).toBeUndefined();
  });

  it("keeps the barter note in the collaboration notes the admin already reads", () => {
    const payload = buildSubmissionPayload(validForm({ barterNote: "Tukar dokumentasi", collaborationNotes: "Butuh meja" }));
    expect(payload.collaborationNotes).toBe("[SKEMA BARTER KOMUNITAS]: Tukar dokumentasi\n\nCatatan Tambahan: Butuh meja");
  });
});
