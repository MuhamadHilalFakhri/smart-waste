import argparse
import json
from pathlib import Path

from sqlalchemy import select

from .config import settings
from .database import SessionLocal
from .models import User
from .security import hasher


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["seed-admin", "openapi"])
    parser.add_argument("--output", default="../../packages/api-client/openapi.json")
    args = parser.parse_args()
    if args.command == "openapi":
        from .main import app

        path = Path(args.output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
        print(f"OpenAPI exported to {path}")
        return
    config = settings()
    if len(config.admin_password) < 12:
        raise SystemExit("ADMIN_PASSWORD minimal 12 karakter; gunakan secret environment")
    with SessionLocal() as db:
        email = config.admin_email.lower()
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            if existing.role != "admin" or not existing.active:
                raise SystemExit(
                    "Email seed sudah dimiliki akun non-Admin/nonaktif; periksa secara manual"
                )
            print("Admin sudah ada; password tidak diubah")
            return
        db.add(
            User(
                name="Administrator",
                email=email,
                role="admin",
                password_hash=hasher.hash(config.admin_password),
            )
        )
        db.commit()
        print("Admin dibuat")


if __name__ == "__main__":
    main()
