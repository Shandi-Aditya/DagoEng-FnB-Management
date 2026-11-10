"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  SettingsSectionHandler,
  UnifiedSaveResult,
  getDirtySectionIds,
  executeUnifiedSave,
} from "@/lib/unified-settings";

export interface UseUnifiedSettingsFormOptions<T extends Record<string, any>> {
  initialValues: T;
  handlers: SettingsSectionHandler[];
  onSaveSuccess?: (result: UnifiedSaveResult) => void;
  onSaveError?: (result: UnifiedSaveResult) => void;
  /** Whether to intercept internal navigation when dirty. Defaults to true. */
  enableNavigationGuard?: boolean;
}

export function useUnifiedSettingsForm<T extends Record<string, any>>({
  initialValues,
  handlers,
  onSaveSuccess,
  onSaveError,
  enableNavigationGuard = true,
}: UseUnifiedSettingsFormOptions<T>) {
  const [baselines, setBaselines] = useState<T>(() => JSON.parse(JSON.stringify(initialValues)));
  const [values, setValues] = useState<T>(() => JSON.parse(JSON.stringify(initialValues)));
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const dirtySectionIds = useMemo(() => {
    return getDirtySectionIds(baselines, values, handlers.map((h) => h.id));
  }, [baselines, values, handlers]);

  const isDirty = dirtySectionIds.length > 0;

  // Set field/section value
  const setSectionValue = useCallback(<K extends keyof T>(sectionId: K, valueOrUpdater: any) => {
    setValues((prev) => {
      const currentSectionVal = prev[sectionId];
      const nextSectionVal =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(currentSectionVal)
          : valueOrUpdater;
      return {
        ...prev,
        [sectionId]: nextSectionVal,
      };
    });
    // Clear validation error for that section if present
    setValidationErrors((prev) => {
      if (prev[sectionId as string]) {
        const next = { ...prev };
        delete next[sectionId as string];
        return next;
      }
      return prev;
    });
  }, []);

  // Update baseline (e.g. after external fetch or save)
  const setSectionBaseline = useCallback(<K extends keyof T>(sectionId: K, newBaseline: any) => {
    const cloned = JSON.parse(JSON.stringify(newBaseline));
    setBaselines((prev) => ({ ...prev, [sectionId]: cloned }));
    setValues((prev) => ({ ...prev, [sectionId]: cloned }));
  }, []);

  // Reset all to current baselines
  const resetAll = useCallback(() => {
    setValues(JSON.parse(JSON.stringify(baselines)));
    setValidationErrors({});
  }, [baselines]);

  // Reset a single section to baseline
  const resetSection = useCallback(<K extends keyof T>(sectionId: K) => {
    setValues((prev) => ({
      ...prev,
      [sectionId]: JSON.parse(JSON.stringify(baselines[sectionId])),
    }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[sectionId as string];
      return next;
    });
  }, [baselines]);

  // Execute unified save
  const submitUnifiedSave = useCallback(async (): Promise<UnifiedSaveResult> => {
    setIsSubmitting(true);
    try {
      const result = await executeUnifiedSave(
        handlersRef.current,
        baselines,
        values
      );

      // Update baselines for successful sections
      setBaselines((prev) => ({
        ...prev,
        ...result.newBaselines,
      }));

      if (result.validationErrors) {
        setValidationErrors(result.validationErrors);
      } else if (result.allSucceeded) {
        setValidationErrors({});
      }

      if (result.allSucceeded) {
        onSaveSuccess?.(result);
      } else {
        onSaveError?.(result);
      }

      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [baselines, values, onSaveSuccess, onSaveError]);

  // Navigation Guard: window beforeunload (handles refresh, tab/browser close, external URLs)
  useEffect(() => {
    if (!enableNavigationGuard || !isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Ada perubahan pengaturan yang belum disimpan. Yakin ingin meninggalkan halaman ini?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, enableNavigationGuard]);

  // Navigation Guard: App Router client-side link clicks interception
  useEffect(() => {
    if (!enableNavigationGuard || !isDirty) return;

    const handleInternalLinkClick = (e: MouseEvent) => {
      // Ignore if event was already prevented or not primary mouse button
      if (e.defaultPrevented || e.button !== 0) return;

      // Ignore modifier keys that open links in new tabs/windows
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      // Ignore target="_blank", rel="external", or download links
      const linkTarget = target.getAttribute("target");
      if (linkTarget === "_blank" || target.hasAttribute("download")) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      // Check URL destination
      try {
        const targetUrl = new URL(href, window.location.href);

        // Same page anchor or query-only on same path does not discard form state
        if (
          targetUrl.origin === window.location.origin &&
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        ) {
          return;
        }

        const confirmed = window.confirm(
          "Ada perubahan pengaturan yang belum disimpan. Yakin ingin meninggalkan halaman ini?"
        );
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
        }
      } catch (_) {
        // If URL parsing fails, let standard navigation proceed
      }
    };

    document.addEventListener("click", handleInternalLinkClick, true);
    return () => document.removeEventListener("click", handleInternalLinkClick, true);
  }, [isDirty, enableNavigationGuard]);

  return {
    values,
    baselines,
    isDirty,
    dirtySectionIds,
    validationErrors,
    isSubmitting,
    setSectionValue,
    setSectionBaseline,
    resetSection,
    resetAll,
    submitUnifiedSave,
  };
}

