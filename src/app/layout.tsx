import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { DM_Mono, DM_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

// Sesuai --background preset Neutral: oklch(1 0 0) dan oklch(0.145 0 0)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
};

export const metadata: Metadata = {
  title: "DagoEng F&B Management — Smarter F&B. Better Operations.",
  description: "Platform terintegrasi untuk mengelola transaksi, operasional, inventory, customer, dan performa bisnis F&B.",
  icons: {
    icon: [
      { url: "/logo-dago.png", href: "/logo-dago.png" },
      { url: "/favicon.ico", href: "/favicon.ico" },
    ],
    shortcut: "/logo-dago.png",
    apple: "/logo-dago.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={cn("font-sans", dmSans.variable, dmMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/logo-dago.png" type="image/png" />
        <link rel="shortcut icon" href="/logo-dago.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-dago.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var key = 'dagoeng_theme_preference';
                  var saved = localStorage.getItem(key);
                  var isDark = saved === 'dark' || (!saved || saved === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
