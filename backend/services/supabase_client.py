"""Lightweight Supabase REST client scoped to a user's JWT."""

from __future__ import annotations

from dataclasses import dataclass
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


class SupabaseRestClient:
    def __init__(self, settings: SupabaseSettings, token: str):
        self._settings = settings
        self._token = token

    def _headers(self, prefer_return: bool = False) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "apikey": self._settings.anon_key,
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }
        if prefer_return:
            headers["Prefer"] = "return=representation"
        return headers

    def _request(
        self,
        method: str,
        table: str,
        *,
        params: Optional[Mapping[str, str]] = None,
        json: Optional[Any] = None,
        prefer_return: bool = False,
    ):
        url = f"{self._settings.rest_url}/{table}"
        try:
            response = httpx.request(
                method,
                url,
                params=params,
                json=json,
                headers=self._headers(prefer_return),
                timeout=10.0,
            )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Supabase request failed: {exc}") from exc

        if response.status_code in {401, 403}:
            raise HTTPException(status_code=response.status_code, detail="Unauthorized")

        data = None
        try:
            data = response.json()
        except ValueError:
            data = None

        if response.is_error:
            detail = data.get("message") if isinstance(data, dict) else response.text
            raise HTTPException(status_code=500, detail=f"Supabase error: {detail}")

        return data or []

    def select(
        self,
        table: str,
        select: str,
        filters: Optional[Mapping[str, str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ):
        params = {"select": select}
        if filters:
            params.update(filters)
        if limit is not None:
            params["limit"] = str(limit)
        if offset is not None:
            params["offset"] = str(offset)
        return self._request("GET", table, params=params)

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
