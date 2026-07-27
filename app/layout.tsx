import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";

export const metadata: Metadata = {
  title: "Pucuk · Transaksi Daun Teh",
  description: "Satu transaksi daun teh yang jelas, terverifikasi, dan dipercaya.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
