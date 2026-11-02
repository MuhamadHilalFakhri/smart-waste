"""Validate a Colab export without training or substituting evaluation results."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

LABELS = ["organic", "paper", "plastic"]


def verify(directory):
    root = Path(directory)
    for name in ("model.keras", "metadata.json", "evaluation.json", "manifest.csv",
                 "dataset_summary.json", "test_predictions.npz", "classification_report.txt",
                 "confusion_matrix.png", "training_curves.png", "training_history.json"):
        if not (root / name).is_file():
            raise ValueError(f"Artefak belum lengkap: {name}")
    metadata = json.loads((root / "metadata.json").read_text())
    evaluation = json.loads((root / "evaluation.json").read_text())
    if (metadata["labels"] != LABELS or metadata["input_size"] != [224, 224]
            or metadata["preprocessing"] != "embedded_mobilenet_v2"):
        raise ValueError("Kontrak preprocessing/label tidak sesuai API")
    with (root / "model.keras").open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != metadata["sha256"]:
        raise ValueError("Checksum model tidak sesuai")
    with (root / "manifest.csv").open(encoding="utf-8") as stream:
        rows = list(csv.DictReader(stream))
    for key in ("sha256", "group"):
        groups = [{r[key] for r in rows if r["split"] == split}
                  for split in ("train", "validation", "test")]
        if groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2]:
            raise ValueError("Duplikasi melintasi split")
    with np.load(root / "test_predictions.npz", allow_pickle=False) as predictions:
        actual, scores = predictions["actual"], predictions["probabilities"]
    test_rows = [r for r in rows if r["split"] == "test"]
    expected = np.array([LABELS.index(r["category"]) for r in test_rows])
    if len(test_rows) == 0 or not np.array_equal(actual, expected):
        raise ValueError("Label testing tidak sesuai manifest")
    if (scores.shape != (len(actual), 3) or not np.isfinite(scores).all()
            or (scores < 0).any() or (scores > 1).any()
            or not np.allclose(scores.sum(axis=1), 1, atol=1e-4)):
        raise ValueError("Probabilitas testing tidak valid")
    predicted = scores.argmax(axis=1)
    accuracy = float(accuracy_score(actual, predicted))
    matrix = confusion_matrix(actual, predicted, labels=range(3)).tolist()
    report = classification_report(actual, predicted, labels=range(3),
                                   target_names=LABELS, output_dict=True, zero_division=0)
    if (not np.isclose(evaluation["test_accuracy"], accuracy)
            or evaluation["test_count"] != len(actual)
            or evaluation["confusion_matrix"] != matrix):
        raise ValueError("Evaluasi JSON tidak sesuai prediksi testing tersimpan")
    for label in LABELS:
        for metric in ("precision", "recall", "f1-score", "support"):
            if not np.isclose(evaluation["classification_report"][label][metric], report[label][metric]):
                raise ValueError(f"Classification report tidak sesuai: {label}/{metric}")
    print(json.dumps({"model_sha256": digest, "test_count": len(actual),
                      "test_accuracy": accuracy, "meets_target": accuracy >= .8,
                      "note": "Konsistensi artefak; inferensi model tetap harus diuji setelah pemasangan."}, indent=2))
    return accuracy >= .8


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", nargs="?", default="ml/artifacts")
    args = parser.parse_args()
    raise SystemExit(0 if verify(args.directory) else 1)
