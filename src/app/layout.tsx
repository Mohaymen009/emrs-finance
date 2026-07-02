import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMRS Finance Platform",
  description: "Financial management platform for EMRS Ambulance & Home Healthcare divisions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">{children}</body>
    </html>
  );
}
