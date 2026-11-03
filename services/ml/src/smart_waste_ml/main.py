import io
import secrets
import warnings
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from .config import settings
from .inference import classifier


@asynccontextmanager
async def lifespan(app):
    settings()
    classifier.load()
    yield


def internal_auth(x_ml_service_token: str = Header(default="")):
    if not secrets.compare_digest(x_ml_service_token, settings().ml_service_token):
        raise HTTPException(401, "Akses layanan ML ditolak")


app = FastAPI(title="Smart Waste ML", version="1.0.0", lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)
Image.MAX_IMAGE_PIXELS = 25_000_000


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": classifier.model is not None}


async def normalize_upload(photo: UploadFile) -> bytes:
    raw = await photo.read(10 * 1024 * 1024 + 1)
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "Foto maksimal 10 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format not in ("JPEG", "PNG", "WEBP"):
                    raise HTTPException(422, "Gunakan foto JPEG, PNG, atau WebP")
                image.load()
                clean = ImageOps.exif_transpose(image).convert("RGB")
                clean.thumbnail((2048, 2048))
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=88)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning):
        raise HTTPException(422, "Foto rusak atau ukurannya tidak didukung")


@app.post("/predict", dependencies=[Depends(internal_auth)])
async def predict(photo: UploadFile = File()):
    # Keep the Pillow normalization and pixel contract used by the Colab dataset.
    image = await normalize_upload(photo)
    return await run_in_threadpool(classifier.predict, image)
