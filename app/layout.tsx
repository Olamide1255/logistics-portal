import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
const inter = Inter({ subsets: ["latin"] });
export const metadata: Metadata = {
  title: { default: "LogiFlow | Logistics Management Platform", template: "%s | LogiFlow" },
  description: "A secure, multi-company logistics operations platform.",
  manifest: "/manifest.json",
  applicationName: "LogiFlow",
};
export const viewport: Viewport = { themeColor: "#4f46e5" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={inter.className}>{children}
    <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
    <Script id="onesignal-init" strategy="afterInteractive">{`
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.init({ appId: "3bb74c5f-1956-404a-b6c9-7e84c7b070d8", notifyButton: { enable: false } });
      });
    `}</Script>
  </body></html>;
}