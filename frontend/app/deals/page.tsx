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

const CURRENCY_OPTIONS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "INR",
  "SGD",
  "HKD",
  "KRW",
  "AED",
  "SAR",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "BRL",
  "MXN",
  "ZAR",
  "TRY",
  "THB",
  "IDR",
  "PHP",
  "VND"
];

export default function DealsPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
      setMessage(fallback);
      return;
    }
    if (err instanceof Error) {
      console.error("[Deals] API request failed", {
        url: "unknown",
        status: undefined,
        responseBody: err.message
      });
      setMessage(fallback);
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
        setError("We couldn’t open your deals right now. This is on our side. Please try again.");
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
        handleApiError(err, "We couldn’t load your deals right now. This is on our side. Please try again.", setError);
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
      setSuccessMessage("Deal created. You can edit these details anytime.");
      setFormError(null);
      setIsCreateOpen(false);
    } catch (err) {
      handleApiError(err, "We couldn’t create the deal right now. This is on our side. Please try again.", setFormError);
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

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const showEmptyState = !loading && !error && rows.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-white">Deals</h1>
          <p className="text-sm text-slate-400">View your deals and their quotes in one place.</p>
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
          {!showEmptyState && (
            <button
              type="button"
              onClick={openCreate}
              disabled={!token}
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              New deal
            </button>
          )}
        </div>
      </header>

      {successMessage && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100">
          {successMessage}
        </div>
      )}

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
                  <p className="mt-2 text-sm text-slate-400">
                    Create a deal to keep pricing, suppliers, and quotes organized.
                  </p>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
                  >
                    New deal
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
                <p className="mt-1 text-sm text-slate-400">
                  Add the basics now. You can edit everything later.
                </p>
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
                  <select
                    required
                    value={form.currency}
                    onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                  >
                    {CURRENCY_OPTIONS.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
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
              <p className="text-xs text-slate-400">You can update or change this deal anytime.</p>
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
