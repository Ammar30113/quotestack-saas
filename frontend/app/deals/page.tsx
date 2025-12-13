'use client';

import { useEffect, useState } from "react";
import Link from "next/link";

import { getDeals, getQuotesForDeal } from "@/lib/api";
import { formatDate } from "@/lib/mockData";

type DealRow = {
  id: number;
  name: string;
  quotesCount: number;
  lastUpdated?: string | null;
};

function formatCount(value: number) {
  return `${value} quote${value === 1 ? "" : "s"}`;
}

export default function DealsPage() {
  const [rows, setRows] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const apiDeals = await getDeals();
        const withQuotes = await Promise.all(
          apiDeals.map(async (deal) => {
            const quotes = await getQuotesForDeal(deal.id);
            return {
              id: deal.id,
              name: deal.name || "Untitled deal",
              quotesCount: quotes.length,
              lastUpdated: quotes.length ? new Date().toISOString() : null
            };
          })
        );
        if (mounted) {
          setRows(withQuotes);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : "Failed to load deals";
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Pipeline</p>
          <h1 className="text-2xl font-semibold text-white">Deals</h1>
        </div>
        <div className="pill text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live data from backend
        </div>
      </div>

      <div className="card overflow-hidden">
        <table>
          <thead>
            <tr>
              <th className="w-2/5">Deal Name</th>
              <th>Number of Quotes</th>
              <th>Last Updated</th>
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
                  <td className="text-white">{deal.name}</td>
                  <td className="text-slate-200">{formatCount(deal.quotesCount)}</td>
                  <td className="text-slate-300">
                    {deal.lastUpdated ? formatDate(deal.lastUpdated) : "—"}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/deals/${deal.id}`}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-white transition hover:border-brand-400 hover:text-brand-100"
                    >
                      View
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
