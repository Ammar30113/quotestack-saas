'use client';

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import AppShell from "@/components/AppShell";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] text-slate-50 font-sans">
        <AppShell>
          <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-2xl flex-col items-center justify-center text-center">
            <div className="card w-full space-y-4 p-6">
              <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
              <p className="text-sm text-slate-300">This is on our side. Please try again.</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
                >
                  Try again
                </button>
                <Link
                  href="/deals"
                  className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400 hover:text-brand-100"
                >
                  Go to deals
                </Link>
              </div>
            </div>
          </div>
        </AppShell>
      </body>
    </html>
  );
}
