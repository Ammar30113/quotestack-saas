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
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ company_name: "", currency: "USD", description: "" });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleApiError = (err: unknown, fallback: string, setMessage: (message: string) => void) => {
    if (err instanceof ApiError) {
      console.error("[Deals] API request failed", {
        url: err.url,
        status: err.status || undefined,
        responseBody: err.responseBody
      });
      if (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN") {
        supabase?.auth.signOut();
        router.replace("/login");
        return;
      }
      if (err.code === "NETWORK_ERROR") {
        setMessage("Unable to reach the backend. Check your connection or configuration and try again.");
        return;
      }
      setMessage(err.message || fallback);
      return;
    }
    if (err instanceof Error) {
      console.error("[Deals] API request failed", {
        url: "unknown",
        status: undefined,
        responseBody: err.message
      });
      if (err.message.toLowerCase().includes("failed to fetch")) {
        setMessage("Unable to reach the backend. Check your connection or configuration and try again.");
        return;
      }
      setMessage(err.message || fallback);
      return;
    }
    console.error("[Deals] API request failed", { url: "unknown", status: undefined, responseBody: err });
    setMessage(fallback);
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
        handleApiError(err, "We couldn't load your deals. Please try again.", setError);
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
      setFormError(null);
      setIsCreateOpen(false);
    } catch (err) {
      handleApiError(err, "We couldn't create the deal. Please try again.", setFormError);
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setFormError(null);
    setForm({ company_name: "", currency: "USD", description: "" });
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (submitting) return;
    setIsCreateOpen(false);
  };

  const refreshDeals = () => {
    if (!token) return;
    loadDeals(token);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-wide text-slate-400">Deals</p>
          <h1 className="text-3xl font-semibold text-white">Pipeline</h1>
          <p className="text-sm text-slate-400">Track opportunities and compare supplier quotes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshDeals}
            disabled={!token || loading}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={!token}
            className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            New deal
          </button>
        </div>
      </header>

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
                <td colSpan={4} className="py-8 text-center">
                  <p className="text-sm text-rose-200">{error}</p>
                  <button
                    type="button"
                    onClick={refreshDeals}
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-500/50 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:border-rose-300"
                  >
                    Try again
                  </button>
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center">
                  <p className="text-sm font-medium text-slate-200">No deals yet</p>
                  <p className="mt-2 text-sm text-slate-400">Create your first deal to start collecting quotes.</p>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
                  >
                    Create deal
                  </button>
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

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div className="absolute inset-0 bg-slate-950/70" onClick={closeCreate} />
          <div className="relative w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">New deal</h2>
                <p className="mt-1 text-sm text-slate-400">Add the company and currency to get started.</p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-500"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300 sm:col-span-2">
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
                <label className="block text-sm text-slate-300">
                  <span className="mb-1 block text-slate-400">Description</span>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                  />
                </label>
              </div>
              {formError && <div className="rounded-md bg-rose-900/40 px-3 py-2 text-sm text-rose-200">{formError}</div>}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={submitting}
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Creating..." : "Create deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
