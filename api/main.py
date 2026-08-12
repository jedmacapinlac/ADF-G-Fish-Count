from fastapi import FastAPI

from . import db
from .routes import router

app = FastAPI(title="ADF&G Fish Counts API")

app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok", "database": db.ping()}
