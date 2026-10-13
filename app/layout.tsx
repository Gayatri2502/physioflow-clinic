import type { Metadata } from "next";
import "./globals.css";
import {AppearanceProvider} from "../components/erp/appearance";

export const metadata: Metadata = {
  title: "PhysioFlow | Clinic ERP",
  description: "Physiotherapy clinic management workspace",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><AppearanceProvider>{children}</AppearanceProvider></body>
    </html>
  );
}
