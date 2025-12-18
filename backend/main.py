import json
import logging
import os
import time
import uuid

import sentry_sdk
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration

from backend.core.auth import UserContext, get_current_user
from backend.routes import deals, quotes

logging.basicConfig(level=logging.INFO)
request_logger = logging.getLogger("quotestack.request")

sentry_dsn = os.environ.get("SENTRY_DSN", "")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        max_request_body_size="never",  # avoid capturing request bodies
    )

app = FastAPI()

frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url] if frontend_url else [],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
)


def _error_response(status_code: int, code: str, message: str):
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Standardize validation errors to match documented error schema.
    return _error_response(status_code=400, code="VALIDATION_ERROR", message="Invalid request payload")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Wrap HTTPExceptions in a consistent error envelope; preserves status codes.
    detail = exc.detail
    code = "HTTP_ERROR"
    message = "Request failed"

    if isinstance(detail, dict):
        code = str(detail.get("code") or code)
        message = str(detail.get("message") or detail.get("detail") or message)
    elif isinstance(detail, str):
        message = detail

    return _error_response(status_code=exc.status_code, code=code, message=message)


@app.get("/")
async def root(_: UserContext = Depends(get_current_user)):
    return {"status": "ok", "service": "quotestack-backend"}


@app.get("/health")
async def health_check():
    # Public health check; no authentication required.
    return {"status": "ok"}


app.include_router(deals.router)
app.include_router(quotes.router)


def _get_port() -> int:
    raw_port = os.environ.get("PORT", "8080")
    try:
        return int(raw_port)
    except ValueError:
        print(f"Invalid PORT value '{raw_port}', defaulting to 8080")
        return 8080


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start = time.perf_counter()
    user_id = None

    auth_header = request.headers.get("authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
            try:
                # Avoid altering request flow if decoding fails; logging is best-effort.
                from backend.core.auth import _decode_supabase_jwt

                user_id = _decode_supabase_jwt(token)
            except Exception:
                user_id = None

    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        status_code = response.status_code if response else 500
        duration_ms = (time.perf_counter() - start) * 1000
        log_payload = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "user_id": user_id,
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
        }
        request_logger.info(json.dumps(log_payload, separators=(",", ":")))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=_get_port())
