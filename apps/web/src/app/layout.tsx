import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Smart Waste", template: "%s | Smart Waste" },
  description: "Pelaporan sampah organik, plastik, dan kertas.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <a className="skip" href="#main">
          Lewati navigasi
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
