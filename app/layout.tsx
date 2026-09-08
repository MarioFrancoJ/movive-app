import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";
import PublicDictionaryProvider from "@/components/i18n/PublicDictionaryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Official Movive production domain. Single source of truth for absolute URLs
// (metadataBase resolves canonical/OG/sitemap/robots against this). Can be
// overridden per-environment via NEXT_PUBLIC_APP_URL (e.g. Vercel previews).
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://movive-hazel-six.vercel.app";
const SITE_NAME = "Movive";
const SITE_TITLE = "Movive — Transform Your Fitness Journey";
const SITE_DESCRIPTION =
  "Personalized workouts, nutrition plans and progress tracking in one modern platform.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — Movive",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  // Browser + PWA icons — single source of truth for every route (child
  // layouts/pages inherit and merge with this root metadata; none override it).
  // The favicon.ico now lives in /public (NOT app/), so there is no competing
  // app/favicon.ico file-convention link that could shadow this config and make
  // the icon appear only on some routes. Modern browsers pick the SVG; older
  // ones fall back to the .ico; Apple devices use the PNG touch icon.
  icons: {
    icon: [
      { url: "/movive/isotipo-movive.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
    shortcut: "/favicon.ico",
    apple: "/movive/isotipo-movive.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: ["es_ES"],
    images: [
      {
        url: "/movive/isologo-movive.png",
        width: 1002,
        height: 147,
        alt: "Movive",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/movive/isologo-movive.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-zinc-900">
        <PublicDictionaryProvider locale={locale} dict={dict}>
          {children}
        </PublicDictionaryProvider>
      </body>
    </html>
  );
}
