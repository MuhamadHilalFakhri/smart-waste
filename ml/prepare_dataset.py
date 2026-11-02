"""Download RealWaste and create a reproducible, duplicate-grouped split."""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from sklearn.model_selection import train_test_split

SOURCE = "https://archive.ics.uci.edu/static/public/908/realwaste.zip"
MAPPING = {"Food Organics": "organic", "Vegetation": "organic", "Paper": "paper", "Plastic": "plastic"}
LABELS = ["organic", "paper", "plastic"]


def canonical_image(raw):
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((2048, 2048))
        output = io.BytesIO()
        image.save(output, "JPEG", quality=88)
        return output.getvalue()


def difference_hash(raw):
    with Image.open(io.BytesIO(raw)) as image:
        pixels = np.asarray(image.convert("L").resize((9, 8), Image.Resampling.BILINEAR))
    return int("".join("1" if v else "0" for v in (pixels[:, 1:] > pixels[:, :-1]).flat), 2)


def prepare(root="data"):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    archive_path = root / "realwaste.zip"
    if not archive_path.exists():
        partial = archive_path.with_suffix(".partial")
        urllib.request.urlretrieve(SOURCE, partial)
        partial.replace(archive_path)
    rows, rejected = [], []
    images = root / "images"
    images.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive_path) as archive:
        for member in sorted(archive.namelist()):
            path = Path(member)
            if path.parent.name not in MAPPING or path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            try:
                raw = archive.read(member)
                image = canonical_image(raw)
                checksum = hashlib.sha256(raw).hexdigest()
                label = MAPPING[path.parent.name]
                target = images / f"{checksum}.jpg"
                target.write_bytes(image)
                rows.append({"path": target.relative_to(root).as_posix(), "source_path": member,
                             "category": label, "sha256": checksum, "dhash": difference_hash(image)})
            except (OSError, ValueError):
                rejected.append({"source_path": member, "reason": "decode_failed"})
    if len(rows) < 150:
        raise RuntimeError("Dataset kurang dari 150 gambar; periksa unduhan dan struktur sumber")
    parent = list(range(len(rows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, item in enumerate(rows):
        for j in range(i):
            other = rows[j]
            if item["sha256"] == other["sha256"] or (item["dhash"] ^ other["dhash"]).bit_count() <= 4:
                parent[find(i)] = find(j)
    groups = {}
    for i, item in enumerate(rows):
        groups.setdefault(find(i), []).append(item)
    clean = []
    for group in groups.values():
        if len({r["category"] for r in group}) > 1:
            rejected.extend({"source_path": r["source_path"], "reason": "cross_label_duplicate_group"} for r in group)
            continue
        # Retain one representative; near-duplicates cannot cross the split.
        representative = group[0]
        representative["group"] = representative["sha256"]
        clean.append(representative)
        rejected.extend({"source_path": r["source_path"], "reason": "duplicate"} for r in group[1:])
    counts = Counter(r["category"] for r in clean)
    if any(counts[label] < 50 for label in LABELS):
        raise RuntimeError(f"Butuh minimal 50 gambar unik per kelas: {counts}")
    train, held_out = train_test_split(clean, test_size=0.30, random_state=42,
                                      stratify=[r["category"] for r in clean])
    validation, test = train_test_split(held_out, test_size=0.50, random_state=42,
                                       stratify=[r["category"] for r in held_out])
    for split, items in (("train", train), ("validation", validation), ("test", test)):
        for item in items:
            item["split"] = split
    fields = ["path", "source_path", "category", "sha256", "group", "split"]
    with (root / "manifest.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(clean)
    with archive_path.open("rb") as source_stream:
        archive_sha256 = hashlib.file_digest(source_stream, "sha256").hexdigest()
    summary = {"source": SOURCE, "source_sha256": archive_sha256,
               "seed": 42, "mapping": MAPPING, "unique_images": len(clean), "counts": dict(counts),
               "split_counts": dict(Counter(f'{r["split"]}/{r["category"]}' for r in clean)),
               "duplicate_policy": "SHA256 or dHash Hamming <=4; conflicting-label groups excluded", "rejected": rejected}
    (root / "dataset_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "rejected"}, indent=2))
    return root / "manifest.csv"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="data")
    prepare(parser.parse_args().root)
