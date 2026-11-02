"""Create a local deployment environment without printing secret values."""
import argparse
import os
import secrets
from pathlib import Path
from urllib.parse import urlparse

parser = argparse.ArgumentParser()
parser.add_argument("--origin", required=True)
parser.add_argument("--bind", default="127.0.0.1")
args = parser.parse_args()
origin = args.origin.rstrip("/")
url = urlparse(origin)
if url.scheme not in ("http", "https") or not url.netloc or url.path:
    raise SystemExit("Origin harus berupa http(s)://host[:port], tanpa path")
target = Path(__file__).parent / ".env"
if target.exists():
    raise SystemExit("infra/.env sudah ada; tidak ditimpa")
values = {
    "POSTGRES_PASSWORD": secrets.token_hex(24),
    "JWT_SECRET": secrets.token_hex(48),
    "ADMIN_EMAIL": os.getenv("ADMIN_EMAIL", "admin@example.com"),
    "ADMIN_PASSWORD": secrets.token_urlsafe(24),
    "PUBLIC_ORIGIN": origin,
    "COOKIE_SECURE": str(url.scheme == "https").lower(),
    "BIND_ADDRESS": args.bind,
    "APP_PORT": "8080",
}
descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
    stream.write("".join(f"{key}={value}\n" for key, value in values.items()))
print("infra/.env dibuat. Kredensial hanya tersedia di file tersebut; jangan commit atau publikasikan.")
