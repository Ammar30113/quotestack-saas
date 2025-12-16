const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export type ApiDeal = {
  id: number;
  company_name: string;
  currency: string;
  description?: string | null;
  created_at?: string | null;
};

export type ApiQuote = {
  id: number;
  deal_id: number;
  amount: number;
  currency?: string | null;
  supplier?: string | null;
  lead_time_days?: number | null;
  moq?: number | null;
  created_at?: string | null;
};

type RequestOptions = RequestInit & { token?: string };

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { token, ...rest } = options || {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers || {})
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

export async function getDeals(token: string): Promise<ApiDeal[]> {
  return request<ApiDeal[]>("/deals", { token });
}

export async function createDeal(
  token: string,
  payload: { company_name: string; currency: string; description?: string | null }
): Promise<ApiDeal> {
  return request<ApiDeal>("/deals", {
    method: "POST",
    body: JSON.stringify(payload),
    token
  });
}

export async function getDeal(id: number, token: string): Promise<ApiDeal> {
  const data = await request<{ deal: ApiDeal }>(`/deals/${id}`, { token });
  return data.deal;
}

export async function getQuotesForDeal(dealId: number, token: string): Promise<ApiQuote[]> {
  const data = await request<{ quotes: ApiQuote[] }>(`/quotes?deal_id=${dealId}`, { token });
  return data.quotes || [];
}

type CreateQuotePayload = {
  amount: number;
  currency?: string;
  supplier?: string;
  leadTimeDays?: number;
  moq?: number;
};

export async function createQuote(token: string, dealId: number, payload: CreateQuotePayload) {
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
    body: JSON.stringify(body),
    token
  });

  return data.quote;
}
