'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";

import { ApiError, compareQuotes, createQuote, getDeal, getQuotesForDeal, updateQuote } from "@/lib/api";
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

const parseDecimal = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  try {
    return new Decimal(trimmed);
  } catch {
    return null;
  }
};

const formatAmount = (value: string | null | undefined, currency: string, decimals = 0) => {
  const amount = parseDecimal(value);
  if (!amount) return "-";
  const rounded = amount.toFixed(decimals);
  return `${currency} ${formatGroupedNumber(rounded)}`;
};

const createBlankRow = (currency: string): QuoteRow => ({
  supplier: "",
  price: "",
  currency,
  amountBase: null,
  baseCurrency: currency,
  fxRate: null,
  fxDate: null,
  leadTimeDays: 0,
  moq: 0
});

const PAGE_SIZE = 20;

export default function DealDetailPage() {
  const params = useParams<Params>();
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const dealId = Number(params?.id);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [dealName, setDealName] = useState<string>("");
  const [dealCurrency, setDealCurrency] = useState<string>("USD");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingRowIndex, setSavingRowIndex] = useState<number | null>(null);
  const [quoteOffset, setQuoteOffset] = useState(0);
  const [quoteHasMore, setQuoteHasMore] = useState(false);
  const [bestQuoteId, setBestQuoteId] = useState<number | null>(null);
  const [unscoredQuoteIds, setUnscoredQuoteIds] = useState<number[]>([]);
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

  const refreshComparison = useCallback(
    async (accessToken: string, quoteIds: number[]) => {
      if (!quoteIds.length) {
        if (isMounted.current) {
          setBestQuoteId(null);
          setUnscoredQuoteIds([]);
        }
        return;
      }
      try {
        const comparison = await compareQuotes(accessToken, quoteIds);
        if (!isMounted.current) return;
        setBestQuoteId(comparison.best_quote_id ?? null);
        setUnscoredQuoteIds(comparison.unscored_quote_ids ?? []);
      } catch (err) {
        if (err instanceof ApiError && (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN")) {
          supabase?.auth.signOut();
          router.replace("/login");
          return;
        }
        console.error("[Quotes] Comparison failed", err);
        if (isMounted.current) {
          setBestQuoteId(null);
        }
      }
    },
    [router, supabase]
  );

  const fetchData = useCallback(
    async (accessToken: string) => {
      if (!isMounted.current) return;
      setLoading(true);
      try {
        const [deal, quotes] = await Promise.all([
          getDeal(dealId, accessToken),
          getQuotesForDeal(dealId, accessToken, { limit: PAGE_SIZE, offset: 0 })
        ]);
        const baseCurrency = deal.currency || "USD";
        const mapped = quotes.items.map<QuoteRow>((quote) => ({
          id: quote.id,
          supplier: quote.supplier || `Supplier ${quote.id}`,
          price: quote.amount || "",
          currency: quote.currency || baseCurrency,
          amountBase: quote.amount_base || null,
          baseCurrency: quote.base_currency || baseCurrency,
          fxRate: quote.fx_rate || null,
          fxDate: quote.fx_date || null,
          leadTimeDays: quote.lead_time_days || 0,
          moq: quote.moq || 0
        }));
        if (isMounted.current) {
          setDealName(deal.company_name);
          setDealCurrency(baseCurrency);
          setRows([...mapped, createBlankRow(baseCurrency)]);
          setQuoteOffset(mapped.length);
          setQuoteHasMore(quotes.has_more);
          setLoadError(null);
          setSaveError(null);
        }
        await refreshComparison(
          accessToken,
          mapped.map((row) => row.id!).filter((id) => typeof id === "number")
        );
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
    [dealId, refreshComparison]
  );

  const getRowKey = (row: QuoteRow, index: number) => (row.id ? `quote-${row.id}` : `draft-${index}`);

  const loadMoreQuotes = async () => {
    if (!token || loadingMore || !quoteHasMore) return;
    setLoadingMore(true);
    try {
      const quotes = await getQuotesForDeal(dealId, token, { limit: PAGE_SIZE, offset: quoteOffset });
      const mapped = quotes.items.map<QuoteRow>((quote) => ({
        id: quote.id,
        supplier: quote.supplier || `Supplier ${quote.id}`,
        price: quote.amount || "",
        currency: quote.currency || dealCurrency,
        amountBase: quote.amount_base || null,
        baseCurrency: quote.base_currency || dealCurrency,
        fxRate: quote.fx_rate || null,
        fxDate: quote.fx_date || null,
        leadTimeDays: quote.lead_time_days || 0,
        moq: quote.moq || 0
      }));

      const draftRow = rows.find((row) => !row.id) ?? createBlankRow(dealCurrency);
      const savedRows = rows.filter((row) => row.id);
      const existingIds = new Set(savedRows.map((row) => row.id));
      const newRows = mapped.filter((row) => row.id && !existingIds.has(row.id));
      const mergedRows = [...savedRows, ...newRows];

      setRows([...mergedRows, draftRow]);
      setQuoteOffset(quoteOffset + mapped.length);
      setQuoteHasMore(quotes.has_more);
      setSaveError(null);
      await refreshComparison(
        token,
        mergedRows.map((row) => row.id!).filter((id) => typeof id === "number")
      );
    } catch (err) {
      handleApiError(err, "Failed to load more quotes", setSaveError);
    } finally {
      setLoadingMore(false);
    }
  };

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
        currency: quote.currency || dealCurrency,
        amountBase: quote.amount_base || null,
        baseCurrency: quote.base_currency || dealCurrency,
        fxRate: quote.fx_rate || null,
        fxDate: quote.fx_date || null,
        leadTimeDays: quote.lead_time_days || 0,
        moq: quote.moq || 0
      };

      if (isExisting) {
        const nextRows = rows.map((item, idx) => (idx === index ? updatedRow : item));
        setRows(nextRows);
        setSaveError(null);
        await refreshComparison(
          token,
          nextRows.map((row) => row.id!).filter((id) => typeof id === "number")
        );
      } else {
        const savedRows = rows.filter((row) => row.id);
        const nextRows = [updatedRow, ...savedRows, createBlankRow(dealCurrency)];
        setRows(nextRows);
        setSaveError(null);
        setQuoteOffset((current) => current + 1);
        await refreshComparison(
          token,
          nextRows.map((row) => row.id!).filter((id) => typeof id === "number")
        );
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
          return { ...row, [key]: value, amountBase: null, fxRate: null, fxDate: null };
        }
        if (key === "currency") {
          return { ...row, [key]: value, amountBase: null, fxRate: null, fxDate: null };
        }
        if (key === "leadTimeDays" || key === "moq") {
          return { ...row, [key]: Number(value) || 0 };
        }
        return { ...row, [key]: value };
      })
    );
  };

  const getNormalizedAmount = (row: QuoteRow) => {
    if (row.currency === dealCurrency) return row.price || row.amountBase;
    if (row.amountBase) return row.amountBase;
    return null;
  };

  const activeRows = useMemo(
    () => rows.filter((row) => row.supplier || row.price || row.id),
    [rows]
  );

  const bestPrice = useMemo(() => {
    const prices = activeRows
      .map((row) => parseDecimal(getNormalizedAmount(row)))
      .filter((value): value is Decimal => value !== null && value.greaterThan(0));
    if (!prices.length) return null;
    return prices.reduce((min, value) => (value.lessThan(min) ? value : min));
  }, [activeRows, dealCurrency]);
  const bestLeadTime = useMemo(() => {
    const leadTimes = activeRows.map((row) => row.leadTimeDays).filter((value) => value > 0);
    return leadTimes.length ? Math.min(...leadTimes) : undefined;
  }, [activeRows]);

  const bestValueIndex = useMemo(() => {
    const candidates = activeRows
      .map((row, index) => {
        const amount = parseDecimal(getNormalizedAmount(row));
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
  }, [activeRows, dealCurrency]);

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
        {quoteHasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={loadMoreQuotes}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? "Loading more..." : "Load more quotes"}
            </button>
          </div>
        )}
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
                <td className="font-medium text-slate-200">Quoted price</td>
                {activeRows.map((row, index) => {
                  return (
                    <td
                      key={`${getRowKey(row, index)}-price`}
                      className="text-sm text-slate-200"
                    >
                      {formatAmount(row.price, row.currency || dealCurrency)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="font-medium text-slate-200">{`Normalized (${dealCurrency})`}</td>
                {activeRows.map((row, index) => {
                  const normalized = getNormalizedAmount(row);
                  const amount = parseDecimal(normalized);
                  const isBest = Boolean(bestPrice && amount && amount.equals(bestPrice));
                  const isMissing = !normalized;
                  return (
                    <td
                      key={`${getRowKey(row, index)}-normalized`}
                      className={`text-sm ${
                        isBest
                          ? "border border-emerald-600 bg-emerald-900/40 text-emerald-100"
                          : isMissing
                            ? "text-amber-200"
                            : "text-slate-200"
                      }`}
                    >
                      {isMissing ? "FX missing" : formatAmount(normalized, dealCurrency, 2)}
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
                  const isBestValue =
                    bestQuoteId !== null ? row.id === bestQuoteId : bestValueIndex !== null && index === bestValueIndex;
                  const isUnscored = row.id ? unscoredQuoteIds.includes(row.id) : false;
                  return (
                    <td
                      key={`${getRowKey(row, index)}-value`}
                      className={`text-sm ${
                        isBestValue
                          ? "border border-amber-600 bg-amber-900/40 text-amber-100"
                          : isUnscored
                            ? "text-amber-200"
                            : "text-slate-400"
                      }`}
                    >
                      {isBestValue ? "Best value" : isUnscored ? "Needs FX" : "—"}
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
