'use client';

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/deals");
      }
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError) {
      setError(signInError.message || "Unable to sign in");
    } else {
      router.replace("/deals");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-lg">
      <div className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-400">QuoteStack</p>
        <h1 className="text-2xl font-semibold text-white">Sign in</h1>
        <p className="text-sm text-slate-400">Access your deals and quotes.</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm text-slate-300">
          <span className="mb-1 block text-slate-400">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
          />
        </label>
        <label className="block text-sm text-slate-300">
          <span className="mb-1 block text-slate-400">Password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
          />
        </label>
        {error && <div className="rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
