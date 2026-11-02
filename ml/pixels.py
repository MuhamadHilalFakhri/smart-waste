"""Image input contract: RGB, PIL bilinear 224x224, float32 in 0..255."""
import numpy as np
from PIL import Image


def load_pixels(path):
    if isinstance(path, bytes):
        path = path.decode()
    with Image.open(path) as image:
        return np.asarray(image.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR), dtype=np.float32)
