"""Authentication helpers for Supabase-backed JWT validation."""

from __future__ import annotations

from dataclasses import dataclass
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


def _decode_supabase_jwt(token: str) -> str:
    settings = get_settings()
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
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Invalid access token"})

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
