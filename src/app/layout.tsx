import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "Compass",
  description: "Your daily plan for study, prayer and life.",
  appleWebApp: { capable: true, title: "Compass", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IE">
      <body>
        <main className="main">{children}</main>
        <Nav />
        <SwRegister />
      </body>
    </html>
  );
}
