"""Lightweight Supabase REST client scoped to a user's JWT."""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from typing import Any, Dict, Mapping, Optional

import httpx
from fastapi import HTTPException

from backend.core.config import get_settings


@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    anon_key: str

    @property
    def rest_url(self) -> str:
        return f"{self.url}/rest/v1"


@lru_cache(maxsize=1)
def get_supabase_settings() -> SupabaseSettings:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY are required")
    return SupabaseSettings(url=settings.supabase_url, anon_key=settings.supabase_anon_key)


def _parse_json_response(response: httpx.Response) -> Any:
    if not response.text:
        return None
    try:
        return json.loads(response.text, parse_float=Decimal)
    except ValueError:
        return None


def _parse_content_range_total(content_range: Optional[str]) -> Optional[int]:
    if not content_range:
        return None
    total_part = content_range.split("/")[-1]
    if total_part == "*":
        return None
    try:
        return int(total_part)
    except ValueError:
        return None


class SupabaseRestClient:
    def __init__(self, settings: SupabaseSettings, token: str):
        self._settings = settings
        self._token = token

    def _headers(self, prefer_return: bool = False, count: Optional[str] = None) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "apikey": self._settings.anon_key,
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }
        prefer_values = []
        if prefer_return:
            prefer_values.append("return=representation")
        if count:
            prefer_values.append(f"count={count}")
        if prefer_values:
            headers["Prefer"] = ",".join(prefer_values)
        return headers

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: Optional[Mapping[str, str]] = None,
        json: Optional[Any] = None,
        prefer_return: bool = False,
        count: Optional[str] = None,
    ):
        url = f"{self._settings.rest_url}/{table}"
        try:
            response = httpx.request(
                method,
                url,
                params=params,
                json=json,
                headers=self._headers(prefer_return, count),
                timeout=10.0,
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail={"code": "SUPABASE_ERROR", "message": f"Supabase request failed: {exc}"},
            ) from exc

        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Unauthorized")
        if response.status_code == 403:
            raise HTTPException(status_code=403, detail="Forbidden")

        data = _parse_json_response(response)

        if response.is_error:
            detail = None
            if isinstance(data, dict):
                detail = data.get("message") or data.get("details") or data.get("error")
            elif isinstance(data, list) and data:
                detail = data[0].get("message") if isinstance(data[0], dict) else None
            message = detail or response.text
            raise HTTPException(
                status_code=response.status_code,
                detail={"code": "SUPABASE_ERROR", "message": f"Supabase error: {message}"},
            )

        payload = data or []
        if count:
            total = _parse_content_range_total(response.headers.get("Content-Range"))
            return payload, total
        return payload

    def select(
        self,
        table: str,
        select: str,
        filters: Optional[Mapping[str, str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        order: Optional[str] = None,
    ):
        params = {"select": select}
        if filters:
            params.update(filters)
        if limit is not None:
            params["limit"] = str(limit)
        if offset is not None:
            params["offset"] = str(offset)
        if order:
            params["order"] = order
        return self._request("GET", table, params=params)

    def select_with_count(
        self,
        table: str,
        select: str,
        filters: Optional[Mapping[str, str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        count: str = "exact",
        order: Optional[str] = None,
    ):
        params = {"select": select}
        if filters:
            params.update(filters)
        if limit is not None:
            params["limit"] = str(limit)
        if offset is not None:
            params["offset"] = str(offset)
        if order:
            params["order"] = order
        return self._request("GET", table, params=params, count=count)

    def insert(self, table: str, payload: Any):
        return self._request("POST", table, json=payload, prefer_return=True)

    def update(self, table: str, payload: Any, filters: Mapping[str, str]):
        return self._request("PATCH", table, json=payload, params=filters, prefer_return=True)

    def delete(self, table: str, filters: Mapping[str, str]):
        return self._request("DELETE", table, params=filters)


def get_supabase_client_for_user(token: str) -> SupabaseRestClient:
    """Return a Supabase REST client authenticated with the user's JWT."""

    settings = get_supabase_settings()
    return SupabaseRestClient(settings, token)


__all__ = ["SupabaseRestClient", "get_supabase_client_for_user", "get_supabase_settings"]
