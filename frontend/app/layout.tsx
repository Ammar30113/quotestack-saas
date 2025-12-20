import "./globals.css";

import type { Metadata } from "next";

import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "QuoteStack",
  description: "QuoteStack SaaS demo frontend"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-slate-50 font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
