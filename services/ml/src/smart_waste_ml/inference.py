import io
import hashlib
import json
import logging
from threading import Lock

from PIL import Image

from .config import settings

logger = logging.getLogger(__name__)
LABELS = ["organic", "paper", "plastic"]


class Classifier:
    def __init__(self):
        self.model = None
        self.version = None
        self.lock = Lock()

    def load(self):
        model_path = settings().model_dir / "model.keras"
        metadata_path = settings().model_dir / "metadata.json"
        if not model_path.exists() or not metadata_path.exists():
            logger.info("Model belum dipasang; prediksi tidak tersedia")
            return
        try:
            import tensorflow as tf

            metadata = json.loads(metadata_path.read_text())
            with model_path.open("rb") as source:
                if hashlib.file_digest(source, "sha256").hexdigest() != metadata["sha256"]:
                    raise ValueError("Checksum model tidak cocok dengan metadata")
            if (
                metadata["labels"] != LABELS
                or metadata["input_size"] != [224, 224]
                or metadata["preprocessing"] != "embedded_mobilenet_v2"
            ):
                raise ValueError("Kontrak model tidak sesuai")
            self.model = tf.keras.models.load_model(model_path, compile=False)
            if self.model.output_shape[-1] != 3:
                raise ValueError("Jumlah kelas tidak sesuai")
            self.version = metadata["version"]
        except Exception:
            self.model = None
            logger.exception("Model gagal dimuat")

    def predict(self, image):
        empty = {
            "category": None,
            "confidence": None,
            "model_version": self.version,
            "probabilities": {},
            "outcome": "unavailable",
        }
        if self.model is None:
            return empty
        try:
            import numpy as np

            pixels = np.asarray(
                Image.open(io.BytesIO(image))
                .convert("RGB")
                .resize((224, 224), Image.Resampling.BILINEAR),
                dtype=np.float32,
            )
            with self.lock:
                scores = self.model(np.expand_dims(pixels, 0), training=False).numpy()[0]
            if not np.all(np.isfinite(scores)):
                raise ValueError("Prediksi bukan angka valid")
            index = int(np.argmax(scores))
            return {
                "category": LABELS[index],
                "confidence": float(scores[index]),
                "model_version": self.version,
                "probabilities": dict(zip(LABELS, map(float, scores))),
                "outcome": "predicted",
            }
        except Exception:
            logger.exception("Inferensi gagal")
            return {**empty, "outcome": "failed"}


classifier = Classifier()
