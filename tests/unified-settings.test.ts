import { describe, it, expect, vi } from "vitest";
import {
  deepEqual,
  isSectionDirty,
  getDirtySectionIds,
  runPreflightValidation,
  executeUnifiedSave,
  SettingsSectionHandler,
} from "../src/lib/unified-settings";

describe("Unified Settings Orchestration Unit Tests", () => {
  describe("1. Dirty Detection", () => {
    it("correctly identifies clean vs modified values including nested objects and arrays", () => {
      const baseline = {
        bankName: "BCA",
        accountNumber: "12345678",
        accountHolder: "John Doe",
        preferences: { email: true, push: false },
        tags: ["admin", "finance"],
      };

      // Identical copy should not be dirty
      const cleanCopy = JSON.parse(JSON.stringify(baseline));
      expect(isSectionDirty(baseline, cleanCopy)).toBe(false);
      expect(deepEqual(baseline, cleanCopy)).toBe(true);

      // Changed primitive
      const changedBank = { ...baseline, bankName: "Mandiri" };
      expect(isSectionDirty(baseline, changedBank)).toBe(true);

      // Changed nested property
      const changedNested = {
        ...baseline,
        preferences: { email: true, push: true },
      };
      expect(isSectionDirty(baseline, changedNested)).toBe(true);

      // Changed array
      const changedArray = {
        ...baseline,
        tags: ["admin", "finance", "payout"],
      };
      expect(isSectionDirty(baseline, changedArray)).toBe(true);
    });

    it("correctly extracts only dirty section IDs", () => {
      const baselines = {
        secA: { count: 10 },
        secB: { name: "Alpha" },
        secC: { enabled: true },
      };
      const currents = {
        secA: { count: 10 }, // clean
        secB: { name: "Beta" }, // dirty
        secC: { enabled: false }, // dirty
      };

      const dirtyIds = getDirtySectionIds(baselines, currents);
      expect(dirtyIds).toEqual(["secB", "secC"]);
    });
  });

  describe("2. Pre-flight Validation", () => {
    it("aborts all save calls and does not invoke save handlers if any dirty section fails validation", async () => {
      const saveFnA = vi.fn().mockResolvedValue({ success: true });
      const saveFnB = vi.fn().mockResolvedValue({ success: true });

      const sections: SettingsSectionHandler[] = [
        {
          id: "sectionA",
          label: "Seksi A",
          validate: (data: { title?: string }): SettingsSectionValidationResult => {
            const errors: Record<string, string> = {};
            if (!data.title) {
              errors.title = "Title is required";
              return {
                isValid: false,
                errors,
                errorSummary: "Seksi A: Title wajib diisi",
              };
            }
            return { isValid: true, errors };
          },
          save: saveFnA,
        },
        {
          id: "sectionB",
          label: "Seksi B",
          validate: (): SettingsSectionValidationResult => ({ isValid: true, errors: {} }),
          save: saveFnB,
        },
      ];

      const baselines = {
        sectionA: { title: "Original Title" },
        sectionB: { note: "Original Note" },
      };

      // User modified Section A to empty (invalid) and Section B to valid
      const currents = {
        sectionA: { title: "" },
        sectionB: { note: "Updated Note" },
      };

      const result = await executeUnifiedSave(sections, baselines, currents);

      expect(result.allSucceeded).toBe(false);
      expect(result.preflightFailed).toBe(true);
      expect(result.errorMessages).toContain("Seksi A: Title wajib diisi");
      expect(result.validationErrors?.sectionA?.title).toBe("Title is required");

      // Verify that neither save handler was called at all!
      expect(saveFnA).not.toHaveBeenCalled();
      expect(saveFnB).not.toHaveBeenCalled();
      // Baselines should remain untouched
      expect(result.newBaselines).toEqual(baselines);
    });
  });

  describe("3. Selective Dirty Section Saving", () => {
    it("invokes save ONLY for sections that are actually dirty", async () => {
      const saveClean = vi.fn().mockResolvedValue({ success: true });
      const saveDirty1 = vi.fn().mockResolvedValue({ success: true });
      const saveDirty2 = vi.fn().mockResolvedValue({ success: true });

      const sections: SettingsSectionHandler[] = [
        {
          id: "cleanSec",
          label: "Seksi Bersih",
          save: saveClean,
        },
        {
          id: "dirtySec1",
          label: "Seksi Berubah 1",
          save: saveDirty1,
        },
        {
          id: "dirtySec2",
          label: "Seksi Berubah 2",
          save: saveDirty2,
        },
      ];

      const baselines = {
        cleanSec: { val: 100 },
        dirtySec1: { val: "old" },
        dirtySec2: { active: false },
      };

      const currents = {
        cleanSec: { val: 100 }, // UNCHANGED
        dirtySec1: { val: "new" }, // CHANGED
        dirtySec2: { active: true }, // CHANGED
      };

      const result = await executeUnifiedSave(sections, baselines, currents);

      expect(result.allSucceeded).toBe(true);
      expect(result.totalDirtySections).toBe(2);
      expect(result.succeededSectionIds).toEqual(["dirtySec1", "dirtySec2"]);

      // cleanSec should never be called
      expect(saveClean).not.toHaveBeenCalled();
      expect(saveDirty1).toHaveBeenCalledWith({ val: "new" });
      expect(saveDirty2).toHaveBeenCalledWith({ active: true });

      // New baselines updated for the dirty sections
      expect(result.newBaselines.dirtySec1).toEqual({ val: "new" });
      expect(result.newBaselines.dirtySec2).toEqual({ active: true });
      expect(result.newBaselines.cleanSec).toEqual({ val: 100 });
    });
  });

  describe("4. Partial Failure Handling", () => {
    it("updates baseline for successful section while keeping failed section dirty and reporting section name", async () => {
      const saveSecA = vi.fn().mockResolvedValue({ success: true });
      const saveSecB = vi.fn().mockResolvedValue({
        success: false,
        error: "Database timeout on server",
      });

      const sections: SettingsSectionHandler[] = [
        {
          id: "secA",
          label: "Profil Mitra",
          save: saveSecA,
        },
        {
          id: "secB",
          label: "Rekening Payout",
          save: saveSecB,
        },
      ];

      const baselines = {
        secA: { brand: "Old Brand" },
        secB: { bank: "BCA", acc: "1111" },
      };

      const currents = {
        secA: { brand: "New Brand" },
        secB: { bank: "BCA", acc: "9999" },
      };

      const result = await executeUnifiedSave(sections, baselines, currents);

      expect(result.allSucceeded).toBe(false);
      expect(result.totalDirtySections).toBe(2);
      expect(result.succeededSectionIds).toEqual(["secA"]);
      expect(result.failedSectionIds).toEqual(["secB"]);

      // Error message must mention the exact failing section label
      expect(result.errorMessages).toEqual([
        "Rekening Payout: Database timeout on server",
      ]);

      // secA succeeded -> baseline updated to currents.secA
      expect(result.newBaselines.secA).toEqual({ brand: "New Brand" });
      expect(isSectionDirty(result.newBaselines.secA, currents.secA)).toBe(false);

      // secB failed -> baseline remains old baseline, so secB STAYS DIRTY!
      expect(result.newBaselines.secB).toEqual({ bank: "BCA", acc: "1111" });
      expect(isSectionDirty(result.newBaselines.secB, currents.secB)).toBe(true);
    });

    it("handles exceptions thrown by save handlers gracefully", async () => {
      const saveBroken = vi.fn().mockRejectedValue(new Error("Network connection dropped"));

      const sections: SettingsSectionHandler[] = [
        {
          id: "brokenSec",
          label: "Notifikasi",
          save: saveBroken,
        },
      ];

      const baselines = { brokenSec: { email: true } };
      const currents = { brokenSec: { email: false } };

      const result = await executeUnifiedSave(sections, baselines, currents);

      expect(result.allSucceeded).toBe(false);
      expect(result.failedSectionIds).toEqual(["brokenSec"]);
      expect(result.errorMessages).toContain("Notifikasi: Network connection dropped");
      expect(result.newBaselines.brokenSec).toEqual({ email: true });
    });
  });

  describe("5. User Confirmation & Cancellation Guard", () => {
    it("aborts the entire save and preserves dirty state on all sections if confirmSave returns false", async () => {
      const saveSecA = vi.fn().mockResolvedValue({ success: true });
      const saveSecB = vi.fn().mockResolvedValue({ success: true });
      const confirmBankMock = vi.fn().mockResolvedValue(false); // User clicks "Batal"

      const sections: SettingsSectionHandler[] = [
        {
          id: "profile",
          label: "Profil Komunitas",
          save: saveSecA,
        },
        {
          id: "bank",
          label: "Rekening Payout",
          confirmSave: confirmBankMock,
          save: saveSecB,
        },
      ];

      const baselines = {
        profile: { communityName: "Old Name" },
        bank: { bankName: "BCA", accountNumber: "12345678" },
      };

      const currents = {
        profile: { communityName: "New Name" },
        bank: { bankName: "Mandiri", accountNumber: "87654321" },
      };

      const result = await executeUnifiedSave(sections, baselines, currents);

      // Entire save must be aborted!
      expect(result.allSucceeded).toBe(false);
      expect(result.cancelled).toBe(true);
      expect(result.errorMessages[0]).toContain("Konfirmasi untuk Rekening Payout dibatalkan");

      // Neither handler should have been executed!
      expect(saveSecA).not.toHaveBeenCalled();
      expect(saveSecB).not.toHaveBeenCalled();

      // Baselines must remain completely untouched -> both sections stay dirty!
      expect(result.newBaselines).toEqual(baselines);
      expect(isSectionDirty(result.newBaselines.profile, currents.profile)).toBe(true);
      expect(isSectionDirty(result.newBaselines.bank, currents.bank)).toBe(true);
    });

    it("proceeds with save when confirmSave returns true", async () => {
      const saveSecA = vi.fn().mockResolvedValue({ success: true });
      const saveSecB = vi.fn().mockResolvedValue({ success: true });
      const confirmBankMock = vi.fn().mockResolvedValue(true); // User clicks "Ya, Simpan"

      const sections: SettingsSectionHandler[] = [
        {
          id: "profile",
          label: "Profil Komunitas",
          save: saveSecA,
        },
        {
          id: "bank",
          label: "Rekening Payout",
          confirmSave: confirmBankMock,
          save: saveSecB,
        },
      ];

      const baselines = {
        profile: { communityName: "Old Name" },
        bank: { bankName: "BCA", accountNumber: "12345678" },
      };

      const currents = {
        profile: { communityName: "New Name" },
        bank: { bankName: "Mandiri", accountNumber: "87654321" },
      };

      const result = await executeUnifiedSave(sections, baselines, currents);

      expect(result.allSucceeded).toBe(true);
      expect(saveSecA).toHaveBeenCalledTimes(1);
      expect(saveSecB).toHaveBeenCalledTimes(1);
      expect(result.newBaselines.profile).toEqual(currents.profile);
      expect(result.newBaselines.bank).toEqual(currents.bank);
    });
  });
});

