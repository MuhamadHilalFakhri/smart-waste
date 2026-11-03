import importlib.util
import io
from pathlib import Path

import numpy as np
from PIL import Image

from smart_waste_ml.inference import Classifier, LABELS


def test_inference_matches_colab_pixels_and_label_order(tmp_path):
    module_path = Path(__file__).resolve().parents[3] / "ml" / "pixels.py"
    spec = importlib.util.spec_from_file_location("training_pixels", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    raw = io.BytesIO()
    image = np.arange(43 * 67 * 3, dtype=np.uint8).reshape(43, 67, 3)
    Image.fromarray(image).save(raw, "JPEG")
    path = tmp_path / "canonical.jpg"
    path.write_bytes(raw.getvalue())
    expected = module.load_pixels(path)
    seen = []

    class Result:
        def numpy(self):
            return np.array([[0.1, 0.2, 0.7]], dtype=np.float32)

    class Model:
        def __call__(self, value, training):
            seen.append(value)
            assert training is False
            return Result()

    classifier = Classifier()
    classifier.model = Model()
    classifier.version = "contract-test-double"
    result = classifier.predict(raw.getvalue())
    np.testing.assert_array_equal(seen[0][0], expected)
    assert seen[0].dtype == np.float32
    assert LABELS == ["organic", "paper", "plastic"]
    assert result["category"] == "plastic"
    assert abs(result["confidence"] - 0.7) < 1e-6
