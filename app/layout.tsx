import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
import "./gallery-system.css";

export const metadata: Metadata = {
  title: "Pucuk - Traceability at the speed of light",
  description: "Bringing evidence into one seamless flow every party can trust.",
  openGraph: {
    title: "Pucuk - Traceability at the speed of light",
    description: "Bringing evidence into one seamless flow every party can trust.",
    siteName: "Pucuk",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Pucuk - Traceability at the speed of light",
    description: "Bringing evidence into one seamless flow every party can trust.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
