import io
import os

os.environ.setdefault("ML_SERVICE_TOKEN", "test-only-internal-service-token-32-characters")

from fastapi.testclient import TestClient
from PIL import Image

from smart_waste_ml.config import settings
from smart_waste_ml.main import app


def photo():
    result = io.BytesIO()
    Image.new("RGB", (48, 64), "green").save(result, "JPEG")
    return ("sample.jpg", result.getvalue(), "image/jpeg")


def test_ml_only_and_internal_auth():
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 404
    assert client.post("/predict", files={"photo": photo()}).status_code == 401
    headers = {"X-ML-Service-Token": settings().ml_service_token}
    result = client.post("/predict", headers=headers, files={"photo": photo()})
    assert result.status_code == 200
    assert result.json()["outcome"] == "unavailable"
    assert client.post("/predict", headers=headers,
                       files={"photo": ("bad.jpg", b"invalid", "image/jpeg")}).status_code == 422
