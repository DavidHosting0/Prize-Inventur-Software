import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm",
});

export const metadata: Metadata = {
  title: "Prize Hotel | Inventory & POS",
  description: "Hotel inventory, F&B and POS platform",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    title: "Prize Hotel",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "48x48" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" data-theme="light" suppressHydrationWarning>
      <body className={`${ibmPlex.variable} font-sans antialiased`} style={{ fontFamily: "var(--font-ibm), var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
