'use client';

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError("Supabase client not configured");
        return;
      }
      setSupabase(client);
      const { data } = await client.auth.getSession();
      if (data.session) {
        router.replace("/deals");
      }
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase client not configured");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const emailRedirectTo = `${window.location.origin}/login`;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo }
    });

    if (signUpError) {
      setError(signUpError.message || "Unable to create account");
    } else if (data.session) {
      router.replace("/deals");
    } else {
      setSuccess("Check your email to confirm your account, then sign in.");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-lg">
      <div className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-400">QuoteStack</p>
        <h1 className="text-2xl font-semibold text-white">Create account</h1>
        <p className="text-sm text-slate-400">Sign up to start managing deals.</p>
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
        {success && <div className="rounded-md bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">{success}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <div className="text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link className="text-brand-300 hover:text-brand-200" href="/login">
          Sign in
        </Link>
      </div>
    </div>
  );
}
