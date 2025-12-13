from fastapi import FastAPI

from backend.routes import deals, quotes

app = FastAPI()


@app.get("/health")
async def health_check():
    return {"status": "ok"}


app.include_router(deals.router)
app.include_router(quotes.router)
