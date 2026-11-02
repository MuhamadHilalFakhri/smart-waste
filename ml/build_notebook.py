"""Keep the self-contained Colab notebook synchronized with training sources."""
import json
from pathlib import Path

ROOT = Path(__file__).parent


def cell(kind, source):
    result = {"cell_type": kind, "metadata": {}, "source": source.splitlines(keepends=True)}
    if kind == "code":
        result.update(execution_count=None, outputs=[])
    return result


cells = [
    cell("markdown", "# Smart Waste: training dan evaluasi\nPilih Runtime > Change runtime type > T4 GPU. Notebook ini berisi source persiapan dan training agar tidak membutuhkan repository yang sudah dipublikasikan.\n\nDataset: RealWaste, Single, Iranmanesh & Raad (2023), UCI, https://doi.org/10.24432/C5SS4G. Tinjau lisensi sumber sebelum menjalankan atau mendistribusikan dataset. Target testing 80% harus dibuktikan; notebook tidak menjanjikan hasil."),
    cell("code", "%pip install -q tensorflow==2.20.0 keras==3.12.0 numpy==2.2.6 Pillow==12.1.1 scikit-learn==1.7.2 matplotlib==3.10.7\n# Jika Colab meminta restart runtime, lakukan lalu lanjut dari sel berikutnya."),
    cell("code", "import os\nos.chdir('/content')\nimport tensorflow as tf\nprint('TensorFlow:', tf.__version__)\nprint('GPU:', tf.config.list_physical_devices('GPU'))"),
    cell("markdown", "## Persiapan dataset\nHanya Food Organics, Vegetation, Paper, dan Plastic digunakan. Pemeriksaan duplikasi dilakukan sebelum split. Simpan manifest asli; jangan ubah test set berdasarkan hasil model."),
    cell("code", (ROOT / "prepare_dataset.py").read_text(encoding="utf-8").split('if __name__ == "__main__":')[0]),
    cell("code", "prepare('/content/data')"),
    cell("markdown", "## Training, pemilihan checkpoint, dan evaluasi final\nMobileNetV2 memakai bobot ImageNet. Model yang dipilih berdasarkan validation loss baru kemudian diuji. Jangan mengubah hyperparameter menggunakan test set."),
    cell("code", "%%writefile /content/pixels.py\n" + (ROOT / "pixels.py").read_text(encoding="utf-8")),
    cell("code", (ROOT / "train.py").read_text(encoding="utf-8").split('if __name__ == "__main__":')[0]),
    cell("code", "train('/content/data', '/content/artifacts')"),
    cell("code", "from IPython.display import display, Image as DisplayImage\ndisplay(DisplayImage('/content/artifacts/confusion_matrix.png'))\ndisplay(DisplayImage('/content/artifacts/training_curves.png'))\nprint(open('/content/artifacts/classification_report.txt').read())"),
    cell("markdown", "## Unduh hasil\nArsip berisi model.keras, metadata.json, evaluasi asli, grafik, manifest, dan prediksi testing. Berikan arsip ini untuk integrasi API. Bila ingin menyimpan dataset untuk pengumpulan, unduh realwaste.zip terpisah dan cantumkan atribusi/lisensinya."),
    cell("code", "import shutil\nfrom google.colab import files\nshutil.make_archive('/content/smart-waste-artifacts', 'zip', '/content/artifacts')\nfiles.download('/content/smart-waste-artifacts.zip')"),
]
notebook = {"cells": cells, "metadata": {"colab": {"name": "Smart_Waste_Training.ipynb"}, "kernelspec": {"display_name": "Python 3", "name": "python3"}, "accelerator": "GPU"}, "nbformat": 4, "nbformat_minor": 5}
(ROOT / "Smart_Waste_Training.ipynb").write_text(json.dumps(notebook, indent=2), encoding="utf-8")
print("Notebook regenerated")
