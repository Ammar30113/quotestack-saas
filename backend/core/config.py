"""Configuration helpers for the backend service.

This module centralizes access to environment-driven settings so the rest of
the codebase can depend on a single, typed source of truth. The settings are
lightweight and avoid external dependencies while still providing sensible
defaults for local development.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional


@dataclass(frozen=True)
class Settings:
    """Application settings loaded from environment variables.

    Attributes:
        app_name: Human-friendly name for the service, overridable via the
            ``APP_NAME`` environment variable. Defaults to ``"QuoteStack"``.
        debug: Whether to run the application in debug mode. Controlled by the
            ``DEBUG`` environment variable, accepting common truthy values such
            as ``1``, ``true``, ``yes``, or ``on``. Defaults to ``False``.
        supabase_url: Base URL for Supabase project, required.
        supabase_anon_key: Public anon key for Supabase, required for user-bound
            requests that respect Row Level Security.
        supabase_jwt_secret: JWT secret used to validate Supabase-issued access
            tokens on the backend.
    """

    app_name: str = "QuoteStack"
    debug: bool = False
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""

    @classmethod
    def from_env(cls) -> "Settings":
        """Create a :class:`Settings` instance from environment variables."""

        return cls(
            app_name=_get_env("APP_NAME", default=cls.app_name),
            debug=_get_bool("DEBUG", default=cls.debug),
            supabase_url=_get_env("SUPABASE_URL", default="").rstrip("/"),
            supabase_anon_key=_get_env("SUPABASE_ANON_KEY", default=""),
            supabase_jwt_secret=_get_env("SUPABASE_JWT_SECRET", default=""),
        )


def _get_env(key: str, default: Optional[str] = None) -> str:
    """Read a string environment variable with a fallback default."""

    return os.environ.get(key, default or "")


def require_env(key: str) -> str:
    """Read an environment variable and raise if missing."""

    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


def _get_bool(key: str, default: bool = False) -> bool:
    """Read a boolean environment variable using common truthy markers."""

    raw_value = os.environ.get(key)
    if raw_value is None:
        return default

    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance.

    The cache avoids repeated environment lookups across the application while
    still allowing overrides during process start-up.
    """

    return Settings.from_env()


__all__ = ["Settings", "get_settings", "require_env"]
