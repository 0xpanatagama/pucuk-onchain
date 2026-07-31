import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
import "./gallery-system.css";

export const metadata: Metadata = {
  title: "Pucuk · Tea Leaf Transactions",
  description: "Clear, verifiable, and trusted tea-leaf transactions for every participant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
