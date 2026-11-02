import io
import uuid
import warnings

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import settings

MAX_UPLOAD = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000


async def normalize_upload(file: UploadFile) -> bytes:
    raw = await file.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
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
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(422, "Foto rusak atau ukurannya tidak didukung")


def store_image(image):
    root = settings().storage_dir
    root.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.jpg"
    (root / filename).write_bytes(image)
    return filename
