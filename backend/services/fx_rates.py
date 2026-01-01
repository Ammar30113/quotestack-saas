"""FX rate lookup helpers for quote normalization."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional, Tuple

from fastapi import HTTPException

from backend.core.auth import UserContext
from backend.services.supabase_client import get_supabase_client_for_user


def _parse_fx_date(value: object, fallback: date) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            try:
                return datetime.fromisoformat(value).date()
            except ValueError:
                return fallback
    return fallback


def get_fx_rate_for_date(
    user: UserContext,
    base_currency: str,
    quote_currency: str,
    as_of: Optional[date] = None,
) -> Tuple[Decimal, date]:
    base = base_currency.strip().upper()
    quote = quote_currency.strip().upper()
    if not base or not quote:
        raise HTTPException(
            status_code=422,
            detail={"code": "FX_RATE_MISSING", "message": "Currency codes are required for FX normalization"},
        )

    as_of_date = as_of or date.today()
    if base == quote:
        return Decimal("1"), as_of_date

    supabase = get_supabase_client_for_user(user.token)
    rows = supabase.select(
        "fx_rates",
        select="rate,as_of_date",
        filters={
            "base_currency": f"eq.{base}",
            "quote_currency": f"eq.{quote}",
            "as_of_date": f"lte.{as_of_date.isoformat()}",
        },
        order="as_of_date.desc",
        limit=1,
    )

    if not rows:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "FX_RATE_MISSING",
                "message": f"No FX rate for {quote}->{base} on or before {as_of_date.isoformat()}",
            },
        )

    rate_raw = rows[0].get("rate")
    try:
        rate = Decimal(str(rate_raw))
    except (InvalidOperation, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "FX_RATE_MISSING", "message": "Invalid FX rate data"},
        ) from exc

    fx_date = _parse_fx_date(rows[0].get("as_of_date"), as_of_date)
    return rate, fx_date


__all__ = ["get_fx_rate_for_date"]
