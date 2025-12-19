const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

export type ApiListResponse<T> = {
  items: T[];
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
};

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
  amount: string;
  currency?: string | null;
  supplier?: string | null;
  lead_time_days?: number | null;
  moq?: number | null;
  created_at?: string | null;
};

type RequestOptions = RequestInit & { token?: string };

const STATUS_CODE_TO_ERROR_CODE: Record<number, string> = {
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED"
};

function defaultErrorCode(status: number) {
  if (status >= 500) return "INTERNAL_ERROR";
  return STATUS_CODE_TO_ERROR_CODE[status] || "HTTP_ERROR";
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

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
    let code = defaultErrorCode(res.status);
    try {
      const data = await res.json();
      if (data?.error) {
        if (typeof data.error.code === "string") {
          code = data.error.code;
        }
        if (typeof data.error.message === "string") {
          message = data.error.message;
        }
      } else if (typeof data?.detail === "string") {
        message = data.detail;
      }
    } catch {
      // ignore json parse errors and keep default message
    }
    throw new ApiError(message, code, res.status);
  }

  return res.json() as Promise<T>;
}

export async function getDeals(token: string): Promise<ApiListResponse<ApiDeal>> {
  return request<ApiListResponse<ApiDeal>>("/deals", { token });
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

export async function getQuotesForDeal(dealId: number, token: string): Promise<ApiListResponse<ApiQuote>> {
  return request<ApiListResponse<ApiQuote>>(`/quotes?deal_id=${dealId}`, { token });
}

type CreateQuotePayload = {
  amount: string;
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

export async function updateQuote(token: string, quoteId: number, payload: CreateQuotePayload) {
  const body = {
    amount: payload.amount,
    currency: payload.currency,
    supplier: payload.supplier,
    lead_time: payload.leadTimeDays,
    moq: payload.moq
  };

  const data = await request<{ quote: ApiQuote; message?: string }>(`/quotes/${quoteId}`, {
    method: "PUT",
    body: JSON.stringify(body),
    token
  });

  return data.quote;
}
