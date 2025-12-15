import os

from fastapi import FastAPI

from backend.routes import deals, quotes

app = FastAPI()


@app.get("/")
async def root():
    return {"status": "ok", "service": "quotestack-backend"}


@app.get("/health")
async def health_check():
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=_get_port())
