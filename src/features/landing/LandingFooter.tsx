import Image from "next/image";
import Link from "next/link";
import { AtSign, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { CONTACT, FOOTER_LINKS } from "@/features/landing/landing-content";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_CS_WHATSAPP || "6281234567890";

const CONTACT_LINES = [
  { icon: MapPin, text: CONTACT.address },
  { icon: Clock, text: CONTACT.hours },
  { icon: Phone, text: CONTACT.phone },
  { icon: Mail, text: CONTACT.email },
] as const;

export function LandingFooter() {
  return (
    <footer id="contact" className="scroll-mt-16 border-t bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-dago.png" alt="" width={28} height={32} className="object-contain" />
            <span className="text-sm font-semibold">DagoEng Creative Hub</span>
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            Makanan dari mitra lokal, ruang kerja, dan event komunitas di Singaraja.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Kontak</h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {CONTACT_LINES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-2">
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {text}
              </li>
            ))}
            <li className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              <a href={CONTACT.instagram.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground">
                <AtSign className="size-4" aria-hidden />
                {CONTACT.instagram.label}
              </a>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground">
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </a>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Tautan</h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} DagoEng Creative Hub
        </p>
      </div>
    </footer>
  );
}
