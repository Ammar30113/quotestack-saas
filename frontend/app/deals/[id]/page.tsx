'use client';

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

import type { QuoteRow } from "@/lib/mockData";
import { deals } from "@/lib/mockData";

type Params = { id: string };

export default function DealDetailPage() {
  const params = useParams<Params>();
  const dealId = Number(params?.id);
  const deal = useMemo(() => deals.find((item) => item.id === dealId), [dealId]);
  const [rows, setRows] = useState<QuoteRow[]>(() => deal?.quotes ?? []);

  if (!deal) {
    return (
      <div className="card p-6 text-slate-200">
        <p className="text-sm uppercase tracking-wide text-slate-400">Deals</p>
        <h1 className="text-xl font-semibold text-white">Deal not found</h1>
        <p className="mt-2 text-slate-400">Select a deal from the list to view quotes.</p>
      </div>
    );
  }

  const bestPrice = rows.length ? Math.min(...rows.map((row) => row.price)) : undefined;
  const bestLeadTime = rows.length ? Math.min(...rows.map((row) => row.leadTimeDays)) : undefined;

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Deal</p>
          <h1 className="text-2xl font-semibold text-white">{deal.name}</h1>
        </div>
        <div className="pill text-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Mocked quotes
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Quote Inputs</h2>
          <p className="text-sm text-slate-400">Edit supplier proposals inline.</p>
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
                <tr key={`${row.supplier}-${index}`}>
                  <td>
                    <input
                      value={row.supplier}
                      onChange={(e) => updateRow(index, "supplier", e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.price}
                      onChange={(e) => updateRow(index, "price", e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      value={row.currency}
                      onChange={(e) => updateRow(index, "currency", e.target.value.toUpperCase())}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.leadTimeDays}
                      onChange={(e) => updateRow(index, "leadTimeDays", e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.moq}
                      onChange={(e) => updateRow(index, "moq", e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-brand-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                {rows.map((row) => (
                  <th key={row.supplier} className="text-white">
                    {row.supplier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium text-slate-200">Price</td>
                {rows.map((row, index) => {
                  const isBest = bestPrice !== undefined && row.price === bestPrice;
                  return (
                    <td
                      key={`${row.supplier}-${index}-price`}
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
                {rows.map((row, index) => {
                  const isFastest = bestLeadTime !== undefined && row.leadTimeDays === bestLeadTime;
                  return (
                    <td
                      key={`${row.supplier}-${index}-lead`}
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
                {rows.map((row, index) => (
                  <td key={`${row.supplier}-${index}-moq`} className="text-sm text-slate-200">
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
