export const OFFICIAL_HUB_NAME = "Dago Creative Hub";
export const OFFICIAL_HUB_OUTLET_NAME = "Singaraja (Pusat)";
export const OFFICIAL_HUB_ADDRESS =
	"Jl. Teleng No. 1, Banyuasri, Kec. Buleleng, Kabupaten Buleleng, Bali 81116";
export const OFFICIAL_CS_DISPLAY_PHONE =
	process.env.NEXT_PUBLIC_CS_PHONE_DISPLAY?.trim() || "+62 821-1550-1995";

export function normalizeWhatsAppDigits(phone: string): string {
	const digits = (phone || "").replace(/\D/g, "");
	if (digits.startsWith("08")) return `62${digits.slice(1)}`;
	if (digits.startsWith("8")) return `62${digits}`;
	return digits;
}

export const OFFICIAL_CS_WHATSAPP_NUMBER = normalizeWhatsAppDigits(
	process.env.NEXT_PUBLIC_CS_WHATSAPP || OFFICIAL_CS_DISPLAY_PHONE
);

export function buildOfficialCsWhatsAppUrl(message?: string): string {
	const base = `https://wa.me/${OFFICIAL_CS_WHATSAPP_NUMBER}`;
	return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
