'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { createQuote, getDeal, getQuotesForDeal } from "@/lib/api";
import type { QuoteRow } from "@/lib/mockData";

type Params = { id: string };

const blankRow: QuoteRow = {
  supplier: "",
  price: 0,
  currency: "USD",
  leadTimeDays: 0,
  moq: 0
};

export default function DealDetailPage() {
  const params = useParams<Params>();
  const dealId = Number(params?.id);
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [dealName, setDealName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRowIndex, setSavingRowIndex] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deal, quotes] = await Promise.all([getDeal(dealId), getQuotesForDeal(dealId)]);
      setDealName(deal.name);
      const mapped = quotes.map<QuoteRow>((quote) => ({
        id: quote.id,
        supplier: `Supplier ${quote.id}`,
        price: quote.amount,
        currency: quote.currency || "USD",
        leadTimeDays: quote.lead_time || 0,
        moq: quote.moq || 0
      }));
      setRows([...mapped, blankRow]);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load deal";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (!Number.isFinite(dealId)) return;
    fetchData();
  }, [dealId, fetchData]);

  const submitRow = async (index: number) => {
    const row = rows[index];
    if (row.id || !row.supplier || !row.price || savingRowIndex !== null) return;

    setSavingRowIndex(index);
    try {
      await createQuote(dealId, {
        amount: row.price,
        currency: row.currency,
        supplier: row.supplier,
        leadTimeDays: row.leadTimeDays,
        moq: row.moq
      });
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save quote";
      setError(message);
    } finally {
      setSavingRowIndex(null);
    }
  };

  const updateRow = (index: number, key: keyof QuoteRow, value: string) => {
    setRows((current) =>
      current.map((row, idx) => {
        if (idx !== index) return row;
        if (key === "price" || key === "leadTimeDays" || key === "moq") {
          return { ...row, [key]: Number(value) || 0 };
        }
        return { ...row, [key]: value };
      })
    );
  };

  const activeRows = useMemo(
    () => rows.filter((row) => row.supplier || row.price || row.id),
    [rows]
  );

  const bestPrice = activeRows.length ? Math.min(...activeRows.map((row) => row.price)) : undefined;
  const bestLeadTime = activeRows.length
    ? Math.min(...activeRows.map((row) => row.leadTimeDays))
    : undefined;

  if (!Number.isFinite(dealId)) {
    return (
      <div className="card p-6 text-slate-200">
        <p className="text-sm uppercase tracking-wide text-slate-400">Deals</p>
        <h1 className="text-xl font-semibold text-white">Deal not found</h1>
        <p className="mt-2 text-slate-400">Select a deal from the list to view quotes.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card p-6 text-slate-200">
        <p className="text-sm uppercase tracking-wide text-slate-400">Deals</p>
        <h1 className="text-xl font-semibold text-white">Loading deal...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-slate-200">
        <p className="text-sm uppercase tracking-wide text-slate-400">Deals</p>
        <h1 className="text-xl font-semibold text-white">Unable to load deal</h1>
        <p className="mt-2 text-rose-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Deal</p>
          <h1 className="text-2xl font-semibold text-white">{dealName}</h1>
        </div>
        <div className="pill text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live quotes
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Quote Inputs</h2>
          <p className="text-sm text-slate-400">
            Edit supplier proposals inline. New rows save on blur.
          </p>
        </div>
        <div className="card overflow-hidden">
          <table>
            <thead>
              <tr>
                <th className="w-1/5">Supplier</th>
                <th className="w-1/5">Price</th>
                <th className="w-1/6">Currency</th>
                <th className="w-1/6">Lead Time (days)</th>
                <th className="w-1/6">MOQ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.supplier || "new"}-${index}`}>
                  <td>
                    <input
                      value={row.supplier}
                      onChange={(e) => updateRow(index, "supplier", e.target.value)}
                      onBlur={() => submitRow(index)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.price}
                      onChange={(e) => updateRow(index, "price", e.target.value)}
                      onBlur={() => submitRow(index)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      value={row.currency}
                      onChange={(e) => updateRow(index, "currency", e.target.value.toUpperCase())}
                      onBlur={() => submitRow(index)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.leadTimeDays}
                      onChange={(e) => updateRow(index, "leadTimeDays", e.target.value)}
                      onBlur={() => submitRow(index)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.moq}
                      onChange={(e) => updateRow(index, "moq", e.target.value)}
                      onBlur={() => submitRow(index)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {savingRowIndex !== null && (
            <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-300">
              Saving row {savingRowIndex + 1}...
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Quote Comparison</h2>
          <p className="text-sm text-slate-400">Identify best price and fastest lead time.</p>
        </div>
        <div className="card overflow-hidden">
          <table>
            <thead>
              <tr>
                <th className="w-1/5">Metric</th>
                {activeRows.map((row, index) => (
                  <th key={`${row.supplier || "new"}-${index}`} className="text-white">
                    {row.supplier || "New supplier"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium text-slate-200">Price</td>
                {activeRows.map((row, index) => {
                  const isBest = bestPrice !== undefined && row.price === bestPrice;
                  return (
                    <td
                      key={`${row.supplier || "new"}-${index}-price`}
                      className={`text-sm ${
                        isBest
                          ? "border border-emerald-600 bg-emerald-900/40 text-emerald-100"
                          : "text-slate-200"
                      }`}
                    >
                      {row.price.toLocaleString(undefined, {
                        style: "currency",
                        currency: row.currency || "USD",
                        maximumFractionDigits: 0
                      })}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="font-medium text-slate-200">Lead Time</td>
                {activeRows.map((row, index) => {
                  const isFastest = bestLeadTime !== undefined && row.leadTimeDays === bestLeadTime;
                  return (
                    <td
                      key={`${row.supplier || "new"}-${index}-lead`}
                      className={`text-sm ${
                        isFastest
                          ? "border border-sky-600 bg-sky-900/40 text-sky-100"
                          : "text-slate-200"
                      }`}
                    >
                      {row.leadTimeDays} days
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="font-medium text-slate-200">MOQ</td>
                {activeRows.map((row, index) => (
                  <td key={`${row.supplier || "new"}-${index}-moq`} className="text-sm text-slate-200">
                    {row.moq.toLocaleString()} units
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
