/**
 * Unified Settings Save Orchestration
 * Pure functions for dirty tracking, pre-flight validation,
 * selective section saving, and partial failure handling.
 */

export interface SettingsSectionValidationResult {
  isValid: boolean;
  errors?: Record<string, string>;
  errorSummary?: string;
}

export interface SettingsSectionSaveResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface SettingsSectionHandler<T = any> {
  id: string;
  label: string;
  validate?: (data: T) => SettingsSectionValidationResult;
  /**
   * Optional confirmation hook. If defined and returns false or rejects,
   * the ENTIRE unified save operation is aborted: no handler is called,
   * no section is saved, no baseline is updated, and all sections remain dirty.
   */
  confirmSave?: (data: T) => Promise<boolean> | boolean;
  save: (data: T) => Promise<SettingsSectionSaveResult>;
}

export interface UnifiedSaveResult {
  allSucceeded: boolean;
  cancelled?: boolean;
  totalDirtySections: number;
  succeededSectionIds: string[];
  failedSectionIds: string[];
  newBaselines: Record<string, any>;
  errorMessages: string[];
  successMessage?: string;
  preflightFailed?: boolean;
  validationErrors?: Record<string, Record<string, string>>;
}

/**
 * Checks deep equality between two values.
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) return false;

  if (typeof a !== "object") {
    return a === b;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(b)) return false;

  const keysA = Object.keys(a).filter((k) => typeof a[k] !== "function");
  const keysB = Object.keys(b).filter((k) => typeof b[k] !== "function");

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Checks if a section is dirty by comparing baseline with current values.
 */
export function isSectionDirty<T = any>(baseline: T, current: T): boolean {
  return !deepEqual(baseline, current);
}

/**
 * Returns IDs of all sections that have changed from their baseline.
 */
export function getDirtySectionIds(
  baselines: Record<string, any>,
  currents: Record<string, any>,
  registeredSectionIds?: string[]
): string[] {
  const idsToCheck = registeredSectionIds || Object.keys(currents);
  return idsToCheck.filter((id) => isSectionDirty(baselines[id], currents[id]));
}

/**
 * Pre-flight validation across sections before any network/save calls.
 * If any section has validation errors, returns isValid: false.
 */
export function runPreflightValidation(
  sections: SettingsSectionHandler[],
  currents: Record<string, any>,
  dirtySectionIds?: string[]
): {
  isValid: boolean;
  errorsBySection: Record<string, Record<string, string>>;
  firstErrorSectionId?: string;
  errorSummaries: string[];
} {
  const errorsBySection: Record<string, Record<string, string>> = {};
  const errorSummaries: string[] = [];
  let firstErrorSectionId: string | undefined;

  // We validate sections that are dirty (or all if not specified)
  const targetSections = dirtySectionIds
    ? sections.filter((s) => dirtySectionIds.includes(s.id))
    : sections;

  for (const section of targetSections) {
    if (section.validate) {
      const result = section.validate(currents[section.id]);
      if (!result.isValid) {
        errorsBySection[section.id] = result.errors || {};
        const summary =
          result.errorSummary ||
          `${section.label}: Terdapat kesalahan pengisian data.`;
        errorSummaries.push(summary);
        if (!firstErrorSectionId) {
          firstErrorSectionId = section.id;
        }
      }
    }
  }

  return {
    isValid: errorSummaries.length === 0,
    errorsBySection,
    firstErrorSectionId,
    errorSummaries,
  };
}

/**
 * Pure orchestration of the unified save flow:
 * 1. Identifies dirty sections.
 * 2. Runs pre-flight validation on all dirty sections; if any fails, aborts all saves.
 * 3. Executes save only for dirty sections.
 * 4. Partially updates baselines for successful sections, leaving failed sections dirty.
 * 5. Returns detailed outcome.
 */
export async function executeUnifiedSave(
  sections: SettingsSectionHandler[],
  baselines: Record<string, any>,
  currents: Record<string, any>
): Promise<UnifiedSaveResult> {
  const sectionIds = sections.map((s) => s.id);
  const dirtySectionIds = getDirtySectionIds(baselines, currents, sectionIds);

  if (dirtySectionIds.length === 0) {
    return {
      allSucceeded: true,
      totalDirtySections: 0,
      succeededSectionIds: [],
      failedSectionIds: [],
      newBaselines: { ...baselines },
      errorMessages: [],
      successMessage: "Tidak ada perubahan yang perlu disimpan.",
    };
  }

  // Pre-flight validation: validate all dirty sections
  const preflight = runPreflightValidation(sections, currents, dirtySectionIds);
  if (!preflight.isValid) {
    return {
      allSucceeded: false,
      preflightFailed: true,
      totalDirtySections: dirtySectionIds.length,
      succeededSectionIds: [],
      failedSectionIds: dirtySectionIds,
      newBaselines: { ...baselines },
      errorMessages: preflight.errorSummaries,
      validationErrors: preflight.errorsBySection,
    };
  }

  // Confirmation step: if any dirty section defines confirmSave and user cancels,
  // the entire save operation is aborted. No section is saved and baselines remain untouched.
  for (const sectionId of dirtySectionIds) {
    const handler = sections.find((s) => s.id === sectionId);
    if (handler?.confirmSave) {
      try {
        const confirmed = await handler.confirmSave(currents[sectionId]);
        if (!confirmed) {
          return {
            allSucceeded: false,
            cancelled: true,
            totalDirtySections: dirtySectionIds.length,
            succeededSectionIds: [],
            failedSectionIds: dirtySectionIds,
            newBaselines: { ...baselines }, // Baselines untouched -> all sections stay dirty
            errorMessages: [`Konfirmasi untuk ${handler.label} dibatalkan. Seluruh perubahan batal disimpan.`],
          };
        }
      } catch (err: any) {
        return {
          allSucceeded: false,
          cancelled: true,
          totalDirtySections: dirtySectionIds.length,
          succeededSectionIds: [],
          failedSectionIds: dirtySectionIds,
          newBaselines: { ...baselines },
          errorMessages: [`Konfirmasi untuk ${handler.label} gagal: ${err.message || "Batal"}`],
        };
      }
    }
  }

  const succeededSectionIds: string[] = [];
  const failedSectionIds: string[] = [];
  const errorMessages: string[] = [];
  const newBaselines: Record<string, any> = { ...baselines };

  for (const sectionId of dirtySectionIds) {
    const handler = sections.find((s) => s.id === sectionId);
    if (!handler) continue;

    try {
      const saveRes = await handler.save(currents[sectionId]);
      if (saveRes.success) {
        succeededSectionIds.push(sectionId);
        // Successful section immediately becomes new baseline
        newBaselines[sectionId] = JSON.parse(JSON.stringify(currents[sectionId]));
      } else {
        failedSectionIds.push(sectionId);
        // Failed section retains old baseline, so it stays dirty
        errorMessages.push(
          `${handler.label}: ${saveRes.error || "Gagal menyimpan perubahan."}`
        );
      }
    } catch (err: any) {
      failedSectionIds.push(sectionId);
      errorMessages.push(
        `${handler.label}: ${err.message || "Terjadi kesalahan sistem saat menyimpan."}`
      );
    }
  }

  const allSucceeded = failedSectionIds.length === 0;

  return {
    allSucceeded,
    totalDirtySections: dirtySectionIds.length,
    succeededSectionIds,
    failedSectionIds,
    newBaselines,
    errorMessages,
    successMessage: allSucceeded
      ? "Semua perubahan pengaturan berhasil disimpan."
      : undefined,
  };
}

