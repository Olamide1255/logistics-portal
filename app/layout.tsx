import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://logistics-portal-ten.vercel.app";
const siteDescription = "A connected logistics operations workspace for freight forwarders and clearing teams. Manage shipments, handovers, documents and financial operations in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LogiFlow | Logistics Operations Platform", template: "%s | LogiFlow" },
  description: siteDescription,
  applicationName: "LogiFlow",
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName: "LogiFlow",
    title: "LogiFlow | Logistics Operations Platform",
    description: siteDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "LogiFlow logistics operations platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LogiFlow | Logistics Operations Platform",
    description: siteDescription,
    images: ["/twitter-image"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml", sizes: "any" }, { url: "/favicon.ico" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};
export const viewport: Viewport = { themeColor: "#4f46e5" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={inter.className}>{children}
    <Suspense fallback={null}><AnalyticsConsent /></Suspense>
    <ClientErrorReporter />
    <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
    <Script id="onesignal-init" strategy="afterInteractive">{`
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.init({ appId: "3bb74c5f-1956-404a-b6c9-7e84c7b070d8", notifyButton: { enable: false } });
      });
    `}</Script>
  </body></html>;
}