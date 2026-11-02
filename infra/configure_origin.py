"""Update only the public-origin deployment settings; never print credentials."""
import argparse
import os
from pathlib import Path
from urllib.parse import urlparse

parser = argparse.ArgumentParser()
parser.add_argument("origin")
args = parser.parse_args()
origin = args.origin.rstrip("/")
parsed = urlparse(origin)
if parsed.scheme != "https" or not parsed.netloc or parsed.path:
    raise SystemExit("Demo publik harus memakai origin HTTPS tanpa path")
path = Path(__file__).parent / ".env"
values = dict(line.split("=", 1) for line in path.read_text().splitlines() if line and not line.startswith("#"))
values.update(PUBLIC_ORIGIN=origin, COOKIE_SECURE="true", BIND_ADDRESS="0.0.0.0")
temporary = path.with_name(".env.tmp")
with os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8", newline="\n") as stream:
    stream.write("".join(f"{key}={value}\n" for key, value in values.items()))
temporary.replace(path)
print(f"Origin demo dikonfigurasi: {origin}")
