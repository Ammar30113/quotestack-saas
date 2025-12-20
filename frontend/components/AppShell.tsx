'use client';

import Link from "next/link";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <>
      <header className="border-b border-slate-800 bg-[#0b1220]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-lg font-bold text-white">
              QS
            </div>
            <div>
              <div className="text-lg font-semibold text-white">QuoteStack</div>
              <div className="text-sm text-slate-400">Trader quote cockpit</div>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link className="hover:text-white" href="/deals">
              Deals
            </Link>
            <Link className="hover:text-white" href="/login">
              Login
            </Link>
            <Link className="hover:text-white" href="/signup">
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </>
  );
}
