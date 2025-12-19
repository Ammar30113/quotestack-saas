'use client';

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApiDeal } from "@/lib/api";
import { ApiError, createDeal, getDeals } from "@/lib/api";
import { formatDate } from "@/lib/mockData";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type FormState = {
  company_name: string;
  currency: string;
  description: string;
};

export default function DealsPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ company_name: "", currency: "USD", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleApiError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      if (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN") {
        supabase?.auth.signOut();
        router.replace("/login");
        return;
      }
      setError(err.message);
      return;
    }
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
  };

  useEffect(() => {
    let mounted = true;

    const ensureSession = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError("Supabase client not configured");
        setLoading(false);
        return;
      }
      setSupabase(client);
      const { data } = await client.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      if (mounted) {
        setToken(session.access_token);
        await loadDeals(session.access_token, mounted);
      }
    };

    ensureSession();

    let unsubscribe: (() => void) | undefined;
    const client = getSupabaseBrowserClient();
    if (client) {
      const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          router.replace("/login");
          return;
        }
        setToken(session.access_token);
        loadDeals(session.access_token);
      });
      unsubscribe = () => authListener?.subscription.unsubscribe();
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDeals = async (accessToken: string, mounted = true) => {
    setLoading(true);
    try {
      const deals = await getDeals(accessToken);
      if (mounted) {
        setRows(deals.items);
        setError(null);
      }
    } catch (err) {
      if (mounted) {
        handleApiError(err, "Failed to load deals");
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || submitting) return;

    setSubmitting(true);
    try {
      const newDeal = await createDeal(token, form);
      setRows((current) => [newDeal, ...current]);
      setForm({ company_name: "", currency: "USD", description: "" });
      setError(null);
    } catch (err) {
      handleApiError(err, "Failed to create deal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Pipeline</p>
          <h1 className="text-2xl font-semibold text-white">Deals</h1>
        </div>
        <div className="pill text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Authenticated data from backend
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm text-slate-300">
            <span className="mb-1 block text-slate-400">Company Name</span>
            <input
              required
              value={form.company_name}
              onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
              className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
            />
          </label>
          <label className="block text-sm text-slate-300">
            <span className="mb-1 block text-slate-400">Currency</span>
            <input
              required
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              maxLength={3}
              className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm uppercase text-white outline-none focus:border-brand-400"
            />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-1">
            <span className="mb-1 block text-slate-400">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting || !token}
          className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create deal"}
        </button>
      </form>

      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th className="w-2/5">Deal</th>
              <th>Currency</th>
              <th>Created</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-300">
                  Loading deals...
                </td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-rose-300">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-300">
                  No deals found.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((deal) => (
                <tr key={deal.id}>
                  <td className="text-white">{deal.company_name || "Untitled deal"}</td>
                  <td className="text-slate-200">{deal.currency}</td>
                  <td className="text-slate-300">{deal.created_at ? formatDate(deal.created_at) : "—"}</td>
                  <td className="text-right">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:border-brand-400 hover:text-brand-100"
                    >
                      View quotes
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
