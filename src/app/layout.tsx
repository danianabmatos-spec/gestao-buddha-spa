import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestão Buddha Spa",
  description: "Sistema de Gestão Operacional — Buddha Spa",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Buddha Spa", statusBarStyle: "default" },
  icons: { icon: "/icon-192-v3.png", apple: "/apple-touch-icon-v3.png" },
};

export const viewport: Viewport = {
  themeColor: "#7E0000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
