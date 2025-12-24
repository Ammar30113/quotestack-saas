'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setSupabase(client);

    client.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener?.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

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
            {user ? (
              <>
                <span className="hidden text-xs text-slate-500 sm:inline">{user.email}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-brand-400 hover:text-brand-100"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="hover:text-white" href="/login">
                  Login
                </Link>
                <Link className="hover:text-white" href="/signup">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </>
  );
}
