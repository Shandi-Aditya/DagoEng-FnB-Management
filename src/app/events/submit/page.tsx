import { redirect } from "next/navigation";

/**
 * Pengajuan event hanya dapat dilakukan dari dalam portal penyelenggara.
 * Akses ke /events/submit dialihkan ke /events/portal.
 */
export default function SubmitEventPage() {
  redirect("/events/portal?view=submit");
}
