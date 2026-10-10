import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const GA_ID = "G-BQTBY7HTMP";

export const metadata: Metadata = {
  metadataBase: new URL("https://droidputer.vercel.app"),
  title: "Droidputer — Small hardware. Big possibilities.",
  description:
    "An Android phone. An ESP32-S3. A whole new computer. Explore real, public telemetry from the open-source Droidputer ecosystem: builds, apps, mirrors, and device health.",
  applicationName: "Droidputer",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-light-32x32.png", sizes: "32x32", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", sizes: "32x32", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Droidputer — Small hardware. Big possibilities.",
    description: "Real devices. Real activity. Everything out in the open.",
    type: "website",
    images: [
      {
        url: "/images/droidputer-hardware.png",
        width: 1264,
        height: 848,
        alt: "An Android phone and ESP32-S3 connected over USB",
      },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0d100e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Privacy extensions may inject attributes on <html> before hydration.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} font-sans antialiased`}
      >
        {children}
        {/* Google Analytics 4: page views (incl. ?view= changes via history), scroll, outbound clicks; custom
            events in components/dashboard/analytics.tsx. Disclosed on /privacy. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
