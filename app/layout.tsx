import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
import "./gallery-system.css";

export const metadata: Metadata = {
  title: "Lattice - Traceability at the Speed of Light",
  description: "Bringing evidence into one seamless flow every party can trust.",
  openGraph: {
    title: "Lattice - Traceability at the Speed of Light",
    description: "Bringing evidence into one seamless flow every party can trust.",
    siteName: "Lattice",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Lattice - Traceability at the Speed of Light",
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
