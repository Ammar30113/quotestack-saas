'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";

import { ApiError, createQuote, getDeal, getQuotesForDeal, updateQuote } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { QuoteRow } from "@/lib/mockData";

type Params = { id: string };

const formatGroupedNumber = (value: string) => {
  const [rawInteger, rawFraction] = value.split(".");
  const sign = rawInteger.startsWith("-") ? "-" : "";
  const digits = sign ? rawInteger.slice(1) : rawInteger;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rawFraction ? `${sign}${grouped}.${rawFraction}` : `${sign}${grouped}`;
};

const parseDecimal = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new Decimal(trimmed);
  } catch {
    return null;
  }
};

const formatAmount = (value: string, currency: string) => {
  const amount = parseDecimal(value);
  if (!amount) return "-";
  const rounded = amount.toFixed(0);
  return `${currency} ${formatGroupedNumber(rounded)}`;
};

const blankRow: QuoteRow = {
  supplier: "",
  price: "",
  currency: "USD",
  leadTimeDays: 0,
  moq: 0
};

export default function DealDetailPage() {
  const params = useParams<Params>();
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const dealId = Number(params?.id);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [dealName, setDealName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingRowIndex, setSavingRowIndex] = useState<number | null>(null);
  const isMounted = useRef(true);

  const handleApiError = (err: unknown, fallback: string, setMessage: (message: string) => void) => {
    if (err instanceof ApiError) {
      if (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN") {
        supabase?.auth.signOut();
        router.replace("/login");
        return;
      }
      setMessage(err.message || fallback);
      return;
    }
    const message = err instanceof Error ? err.message : fallback;
    setMessage(message);
  };

  useEffect(() => {
    isMounted.current = true;

    const ensureSession = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        if (!isMounted.current) return;
        setLoadError("Supabase client not configured");
        setLoading(false);
        return;
      }
      if (!isMounted.current) return;
      setSupabase(client);
      const { data } = await client.auth.getSession();
      if (!isMounted.current) return;
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      setToken(session.access_token);
      await fetchData(session.access_token);
    };

    if (Number.isFinite(dealId)) {
      ensureSession();
    } else {
      setLoading(false);
    }

    let unsubscribe: (() => void) | undefined;
    const client = getSupabaseBrowserClient();
    if (client) {
      const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          router.replace("/login");
          return;
        }
        if (!isMounted.current) return;
        setToken(session.access_token);
        if (Number.isFinite(dealId)) {
          fetchData(session.access_token);
        }
      });
      unsubscribe = () => authListener?.subscription.unsubscribe();
    }

    return () => {
      isMounted.current = false;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const fetchData = useCallback(
    async (accessToken: string) => {
      if (!isMounted.current) return;
      setLoading(true);
      try {
        const [deal, quotes] = await Promise.all([getDeal(dealId, accessToken), getQuotesForDeal(dealId, accessToken)]);
        const mapped = quotes.items.map<QuoteRow>((quote) => ({
          id: quote.id,
          supplier: quote.supplier || `Supplier ${quote.id}`,
          price: quote.amount || "",
          currency: quote.currency || "USD",
          leadTimeDays: quote.lead_time_days || 0,
          moq: quote.moq || 0
        }));
        if (isMounted.current) {
          setDealName(deal.company_name);
          setRows([...mapped, blankRow]);
          setLoadError(null);
          setSaveError(null);
        }
      } catch (err) {
        if (isMounted.current) {
          handleApiError(err, "Failed to load deal", setLoadError);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [dealId]
  );

  const getRowKey = (row: QuoteRow, index: number) => (row.id ? `quote-${row.id}` : `draft-${index}`);

  const submitRow = async (index: number) => {
    const row = rows[index];
    if (!token || savingRowIndex !== null) return;
    const normalizedPrice = row.price.trim();
    const price = parseDecimal(normalizedPrice);
    if (!row.supplier || !price || price.lte(0)) return;
    const isExisting = Boolean(row.id);

    setSaveError(null);
    setSavingRowIndex(index);
    try {
      const quote = isExisting
        ? await updateQuote(token, row.id!, {
            amount: normalizedPrice,
            currency: row.currency,
            supplier: row.supplier,
            leadTimeDays: row.leadTimeDays,
            moq: row.moq
          })
        : await createQuote(token, dealId, {
            amount: normalizedPrice,
            currency: row.currency,
            supplier: row.supplier,
            leadTimeDays: row.leadTimeDays,
            moq: row.moq
          });

      const updatedRow: QuoteRow = {
        id: quote.id,
        supplier: quote.supplier || `Supplier ${quote.id}`,
        price: quote.amount || "",
        currency: quote.currency || "USD",
        leadTimeDays: quote.lead_time_days || 0,
        moq: quote.moq || 0
      };

      setRows((current) => current.map((item, idx) => (idx === index ? updatedRow : item)));
      setSaveError(null);

      if (!isExisting) {
        await fetchData(token);
      }
    } catch (err) {
      handleApiError(err, "Failed to save quote", setSaveError);
    } finally {
      setSavingRowIndex(null);
    }
  };

  const updateRow = (index: number, key: keyof QuoteRow, value: string) => {
    setRows((current) =>
      current.map((row, idx) => {
        if (idx !== index) return row;
        if (key === "price") {
          return { ...row, [key]: value };
        }
        if (key === "leadTimeDays" || key === "moq") {
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

  const bestPrice = useMemo(() => {
    const prices = activeRows
      .map((row) => parseDecimal(row.price))
      .filter((value): value is Decimal => value !== null && value.greaterThan(0));
    if (!prices.length) return null;
    return prices.reduce((min, value) => (value.lessThan(min) ? value : min));
  }, [activeRows]);
  const bestLeadTime = useMemo(() => {
    const leadTimes = activeRows.map((row) => row.leadTimeDays).filter((value) => value > 0);
    return leadTimes.length ? Math.min(...leadTimes) : undefined;
  }, [activeRows]);

  const bestValueIndex = useMemo(() => {
    const candidates = activeRows
      .map((row, index) => {
        const amount = parseDecimal(row.price);
        if (!amount || amount.lte(0) || row.leadTimeDays <= 0) return null;
        return { index, amount, leadTimeDays: row.leadTimeDays };
      })
      .filter((row): row is { index: number; amount: Decimal; leadTimeDays: number } => row !== null);

    if (!candidates.length) return null;

    const byPrice = [...candidates].sort((a, b) => a.amount.comparedTo(b.amount));
    const byLeadTime = [...candidates].sort((a, b) => a.leadTimeDays - b.leadTimeDays);

    const priceRank = new Map(byPrice.map((row, rank) => [row.index, rank]));
    const leadTimeRank = new Map(byLeadTime.map((row, rank) => [row.index, rank]));

    let bestIndex: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const row of candidates) {
      const score = (priceRank.get(row.index) ?? 0) + (leadTimeRank.get(row.index) ?? 0);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = row.index;
      }
    }

    return bestIndex;
  }, [activeRows]);

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

  if (loadError) {
    return (
      <div className="card p-6 text-slate-200">
        <p className="text-sm uppercase tracking-wide text-slate-400">Deals</p>
        <h1 className="text-xl font-semibold text-white">Unable to load deal</h1>
        <p className="mt-2 text-rose-300">{loadError}</p>
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
        {saveError && (
          <div className="rounded-lg border border-rose-700/40 bg-rose-900/30 px-4 py-3 text-sm text-rose-100">
            {saveError}
          </div>
        )}
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
                <tr key={getRowKey(row, index)}>
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
                      type="text"
                      inputMode="decimal"
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
                  <th key={getRowKey(row, index)} className="text-white">
                    {row.supplier || "New supplier"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium text-slate-200">Price</td>
                {activeRows.map((row, index) => {
                  const amount = parseDecimal(row.price);
                  const isBest = Boolean(bestPrice && amount && amount.equals(bestPrice));
                  return (
                    <td
                      key={`${getRowKey(row, index)}-price`}
                      className={`text-sm ${
                        isBest
                          ? "border border-emerald-600 bg-emerald-900/40 text-emerald-100"
                          : "text-slate-200"
                      }`}
                    >
                      {formatAmount(row.price, row.currency || "USD")}
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
                      key={`${getRowKey(row, index)}-lead`}
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
                <td className="font-medium text-slate-200">Best value</td>
                {activeRows.map((row, index) => {
                  const isBestValue = bestValueIndex !== null && index === bestValueIndex;
                  return (
                    <td
                      key={`${getRowKey(row, index)}-value`}
                      className={`text-sm ${
                        isBestValue
                          ? "border border-amber-600 bg-amber-900/40 text-amber-100"
                          : "text-slate-400"
                      }`}
                    >
                      {isBestValue ? "Best value" : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="font-medium text-slate-200">MOQ</td>
                {activeRows.map((row, index) => (
                  <td key={`${getRowKey(row, index)}-moq`} className="text-sm text-slate-200">
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
