import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException

from .config import settings
from .database import SessionLocal
from .inference import classifier
from .modules import auth, dashboard, predictions, reports, users

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    settings().storage_dir.mkdir(parents=True, exist_ok=True)
    classifier.load()
    yield


app = FastAPI(
    title="Smart Waste API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Client-Type"],
)


@app.middleware("http")
async def headers(request: Request, call_next):
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > 11 * 1024 * 1024:
                return JSONResponse({"detail": "Permintaan terlalu besar"}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "Content-Length tidak valid"}, status_code=400)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path.startswith("/api/v1"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Never return validation 'input': it can contain passwords or uploaded bytes.
    fields = [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse({"detail": "Periksa data yang diisi", "errors": fields}, status_code=422)


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    logger.error("Permintaan gagal: %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse({"detail": "Terjadi kesalahan server. Silakan coba lagi."}, status_code=500)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "model_loaded": classifier.model is not None}


@app.get("/api/ready", tags=["health"])
def ready():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ready", "model_loaded": classifier.model is not None}
    except Exception:
        return JSONResponse({"status": "unavailable", "model_loaded": False}, status_code=503)


for router in (auth.router, users.router, reports.router, dashboard.router, predictions.router):
    app.include_router(router, prefix="/api/v1")
