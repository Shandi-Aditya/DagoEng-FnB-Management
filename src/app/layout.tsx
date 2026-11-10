import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
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
      className="bg-[#F8FAFC] dark:bg-[#0F172A] m-0 p-0 border-0 w-full max-w-full overflow-x-hidden font-sans"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
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
      <body className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F8FAFC] dark:bg-[#0F172A] text-[#1E293B] dark:text-[#E2E8F0] antialiased font-sans transition-colors duration-200">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
