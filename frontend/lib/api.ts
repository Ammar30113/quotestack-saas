const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

type ApiDeal = {
  id: number;
  name: string;
  value?: number;
};

type ApiQuote = {
  id: number;
  deal_id: number;
  amount: number;
  currency?: string;
  supplier?: string;
  lead_time?: number;
  moq?: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    cache: "no-store"
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") {
        message = data.detail;
      }
    } catch {
      // ignore json parse errors and keep default message
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function getDeals(): Promise<ApiDeal[]> {
  const data = await request<{ deals: ApiDeal[] }>("/deals");
  return data.deals || [];
}

export async function getDeal(id: number): Promise<ApiDeal> {
  const data = await request<{ deal: ApiDeal }>(`/deals/${id}`);
  return data.deal;
}

export async function getQuotesForDeal(dealId: number): Promise<ApiQuote[]> {
  const data = await request<{ quotes: ApiQuote[] }>("/quotes");
  return (data.quotes || []).filter((quote) => quote.deal_id === dealId);
}

type CreateQuotePayload = {
  amount: number;
  currency?: string;
  supplier?: string;
  leadTimeDays?: number;
  moq?: number;
};

export async function createQuote(dealId: number, payload: CreateQuotePayload) {
  const body = {
    deal_id: dealId,
    amount: payload.amount,
    currency: payload.currency,
    supplier: payload.supplier,
    lead_time: payload.leadTimeDays,
    moq: payload.moq
  };

  const data = await request<{ quote: ApiQuote; message?: string }>("/quotes", {
    method: "POST",
    body: JSON.stringify(body)
  });

  return data.quote;
}
