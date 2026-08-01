import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
import "./gallery-system.css";

export const metadata: Metadata = {
  title: "Pucuk - Traceability at the speed of light",
  description: "Clear, verifiable, and trusted tea-leaf transactions for every participant.",
  openGraph: {
    title: "Pucuk - Traceability at the speed of light",
    description: "Clear, verifiable, and trusted tea-leaf transactions for every participant.",
    siteName: "Pucuk",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Pucuk - Traceability at the speed of light",
    description: "Clear, verifiable, and trusted tea-leaf transactions for every participant.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
