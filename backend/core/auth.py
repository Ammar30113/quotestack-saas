"""Authentication helpers for Supabase-backed JWT validation."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException

from backend.core.config import get_settings


@dataclass(frozen=True)
class UserContext:
    user_id: str
    token: str


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Authorization header missing"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Invalid authorization header"},
        )

    return parts[1]


@lru_cache(maxsize=1)
def _get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url)


def _get_supabase_jwks_url() -> str:
    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MISCONFIGURED_ENV",
                "message": "SUPABASE_URL is required to fetch JWKS for RS256 tokens",
            },
        )
    return f"{settings.supabase_url}/auth/v1/keys"


def _decode_supabase_jwt(token: str) -> str:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid access token"}) from exc

    alg = header.get("alg")
    if alg == "HS256":
        secret = settings.supabase_jwt_secret
        if not secret:
            raise HTTPException(
                status_code=500,
                detail={
                    "code": "MISCONFIGURED_ENV",
                    "message": "SUPABASE_JWT_SECRET is required to verify access tokens",
                },
            )

        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
        except jwt.InvalidTokenError as exc:
            raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid access token"}) from exc
    elif alg == "RS256":
        jwks_url = _get_supabase_jwks_url()
        jwks_client = _get_jwks_client(jwks_url)
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(token, signing_key.key, algorithms=["RS256"], options={"verify_aud": False})
        except (jwt.InvalidTokenError, jwt.PyJWKClientError) as exc:
            raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid access token"}) from exc
    else:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Unsupported access token algorithm"},
        )

    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid access token"})

    return str(user_id)


def get_current_user(authorization: Optional[str] = Header(default=None)) -> UserContext:
    """Resolve the current user from a Supabase JWT in the Authorization header."""

    token = _extract_bearer_token(authorization)
    user_id = _decode_supabase_jwt(token)
    return UserContext(user_id=user_id, token=token)


__all__ = ["UserContext", "get_current_user"]
