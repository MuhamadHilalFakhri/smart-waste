"""Train on training/validation only, then evaluate the selected model once on test."""
import argparse
import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from pixels import load_pixels
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, ConfusionMatrixDisplay
from sklearn.utils.class_weight import compute_class_weight

LABELS = ["organic", "paper", "plastic"]


def train(data="data", output="artifacts", head_epochs=15, fine_epochs=10):
    tf.keras.utils.set_random_seed(42)
    tf.config.experimental.enable_op_determinism()
    data, output = Path(data), Path(output)
    output.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader((data / "manifest.csv").open(encoding="utf-8")))
    for key in ("sha256", "group"):
        sets = [{r[key] for r in rows if r["split"] == split} for split in ("train", "validation", "test")]
        assert not (sets[0] & sets[1] or sets[0] & sets[2] or sets[1] & sets[2]), "Data leakage"

    def dataset(split, shuffle=False):
        selected = [r for r in rows if r["split"] == split]
        paths = [str(data / r["path"]) for r in selected]
        labels = np.array([LABELS.index(r["category"]) for r in selected], dtype=np.int32)

        def generate():
            for path, label in zip(paths, labels):
                yield load_pixels(path), label

        ds = tf.data.Dataset.from_generator(generate, output_signature=(tf.TensorSpec((224, 224, 3), tf.float32), tf.TensorSpec((), tf.int32)))
        if shuffle:
            ds = ds.shuffle(len(selected), seed=42, reshuffle_each_iteration=True)
        return ds.batch(32).prefetch(tf.data.AUTOTUNE), labels

    training, train_labels = dataset("train", True)
    validation, _ = dataset("validation")
    classes = np.arange(3)
    weights = dict(zip(classes.tolist(), compute_class_weight("balanced", classes=classes, y=train_labels).tolist()))
    base = tf.keras.applications.MobileNetV2(input_shape=(224, 224, 3), include_top=False, weights="imagenet")
    base.trainable = False
    inputs = tf.keras.Input((224, 224, 3), name="rgb_0_255")
    x = tf.keras.Sequential([tf.keras.layers.RandomFlip("horizontal", seed=42), tf.keras.layers.RandomRotation(.1, seed=42)], name="augmentation")(inputs)
    x = tf.keras.layers.Rescaling(1 / 127.5, offset=-1, name="mobilenet_preprocessing")(x)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(.2, seed=42)(x)
    model = tf.keras.Model(inputs, tf.keras.layers.Dense(3, activation="softmax", name="probabilities")(x))

    def callbacks(name):
        return [tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True),
                tf.keras.callbacks.ModelCheckpoint(str(output / name), monitor="val_loss", save_best_only=True),
                tf.keras.callbacks.TerminateOnNaN()]

    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    head = model.fit(training, validation_data=validation, epochs=head_epochs, class_weight=weights, callbacks=callbacks("head.keras"))
    base.trainable = True
    for layer in base.layers[:-30]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    fine = model.fit(training, validation_data=validation, epochs=fine_epochs, class_weight=weights, callbacks=callbacks("fine.keras"))
    chosen = "fine.keras" if min(fine.history["val_loss"]) < min(head.history["val_loss"]) else "head.keras"
    model = tf.keras.models.load_model(output / chosen)
    model.save(output / "model.keras")
    # Testing is opened only after the checkpoint is fixed using validation loss.
    testing, actual = dataset("test")
    scores = model.predict(testing)
    predicted = scores.argmax(axis=1)
    accuracy = float(accuracy_score(actual, predicted))
    matrix = confusion_matrix(actual, predicted, labels=classes)
    report = classification_report(actual, predicted, labels=classes, target_names=LABELS, output_dict=True, zero_division=0)
    evaluation = {"test_accuracy": accuracy, "target_accuracy": .8, "meets_target": accuracy >= .8,
                  "test_count": len(actual), "confusion_matrix": matrix.tolist(), "classification_report": report,
                  "selected_checkpoint": chosen, "selection_metric": "validation_loss"}
    (output / "evaluation.json").write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    (output / "classification_report.txt").write_text(classification_report(actual, predicted, labels=classes, target_names=LABELS, zero_division=0), encoding="utf-8")
    ConfusionMatrixDisplay(matrix, display_labels=LABELS).plot(cmap="Greens")
    plt.tight_layout(); plt.savefig(output / "confusion_matrix.png", dpi=160); plt.close()
    histories = {key: head.history[key] + fine.history.get(key, []) for key in head.history}
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    for axis, metric in zip(axes, ("accuracy", "loss")):
        axis.plot(histories[metric], label="train"); axis.plot(histories[f"val_{metric}"], label="validation")
        axis.set_title(metric); axis.set_xlabel("epoch"); axis.legend()
    fig.tight_layout(); fig.savefig(output / "training_curves.png", dpi=160); plt.close(fig)
    metadata = {"version": datetime.now(timezone.utc).strftime("mobilenetv2-%Y%m%dT%H%M%SZ"),
                "labels": LABELS, "input_size": [224, 224], "preprocessing": "embedded_mobilenet_v2",
                "resize": "PIL_BILINEAR", "tensorflow": tf.__version__, "seed": 42,
                "sha256": hashlib.file_digest((output / "model.keras").open("rb"), "sha256").hexdigest()}
    (output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    np.savez_compressed(output / "test_predictions.npz", actual=actual, probabilities=scores)
    for name in ("manifest.csv", "dataset_summary.json"):
        shutil.copy2(data / name, output / name)
    (output / "training_history.json").write_text(json.dumps(histories, indent=2), encoding="utf-8")
    print(json.dumps(evaluation, indent=2))
    print("PASS: target tercapai" if accuracy >= .8 else "BELUM LULUS: laporkan hasil ini secara jujur dan perbaiki eksperimen berdasarkan validation")
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data")
    parser.add_argument("--output", default="artifacts")
    args = parser.parse_args()
    train(args.data, args.output)
