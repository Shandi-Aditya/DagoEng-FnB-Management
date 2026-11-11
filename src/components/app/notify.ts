import { toast } from "@/components/ui/toast";

type NotifyType = "success" | "error" | "info" | "warning";

function show(type: NotifyType) {
  return (title: string, description?: string) => toast.add({ title, description, type });
}

/**
 * Single entry point for toasts. Replaces the hand-built showToast/setXToast helpers.
 * Copy: plain statements, no exclamation marks, e.g. notify.success("Pembayaran berhasil").
 */
export const notify = {
  success: show("success"),
  error: show("error"),
  info: show("info"),
  warning: show("warning"),
} as const;
