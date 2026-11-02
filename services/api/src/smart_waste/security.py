import hashlib
import secrets
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import RefreshSession, User

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
attempts = defaultdict(deque)
attempts_lock = Lock()


def utcnow():
    return datetime.now(timezone.utc)


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def verify_password(value, password_hash):
    try:
        return hasher.verify(password_hash, value)
    except (VerificationError, InvalidHashError):
        return False


def check_origin(request):
    origin = request.headers.get("origin")
    if origin and origin not in settings().allowed_origins:
        raise HTTPException(403, "Asal permintaan tidak diizinkan")


def login_limit(request):
    key = request.client.host if request.client else "unknown"
    current = utcnow().timestamp()
    with attempts_lock:
        # Bound memory even when many different addresses make failed attempts.
        if len(attempts) > 10000:
            expired = [k for k, q in attempts.items() if not q or q[-1] < current - 900]
            for item in expired:
                del attempts[item]
            if len(attempts) > 10000:
                raise HTTPException(429, "Terlalu banyak permintaan. Coba lagi nanti.")
        queue = attempts[key]
        while queue and queue[0] < current - 900:
            queue.popleft()
        if len(queue) >= 10:
            raise HTTPException(429, "Terlalu banyak percobaan. Tunggu 15 menit.")
        queue.append(current)


def new_session(db, user):
    session = RefreshSession(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash="",
        csrf_token=secrets.token_hex(32),
        expires_at=utcnow() + timedelta(days=settings().refresh_days),
    )
    db.add(session)
    token = rotate(session)
    db.commit()
    return session, token


def rotate(session):
    token = f"{session.id}.{secrets.token_urlsafe(48)}"
    session.token_hash = digest(token)
    return token


def issue(response: Response, user, session, refresh, mobile=False):
    access = jwt.encode(
        {
            "sub": str(user.id),
            "sid": str(session.id),
            "exp": utcnow() + timedelta(minutes=settings().access_minutes),
            "iat": utcnow(),
            "iss": "smart-waste",
            "aud": "smart-waste-clients",
        },
        settings().jwt_secret,
        algorithm="HS256",
    )
    if mobile:
        return {"user": user, "access_token": access, "refresh_token": refresh}
    for name, value, http_only, lifetime in (
        ("sw_access", access, True, settings().access_minutes * 60),
        ("sw_refresh", refresh, True, int((aware(session.expires_at) - utcnow()).total_seconds())),
        ("sw_csrf", session.csrf_token, False, settings().refresh_days * 86400),
    ):
        response.set_cookie(
            name,
            value,
            httponly=http_only,
            secure=settings().cookie_secure,
            samesite="lax",
            max_age=lifetime,
            path="/",
        )
    return {"user": user}


def clear_cookies(response):
    for name in ("sw_access", "sw_refresh", "sw_csrf"):
        response.delete_cookie(name, path="/", secure=settings().cookie_secure, samesite="lax")


def csrf(request, session):
    check_origin(request)
    token = request.headers.get("x-csrf-token", "")
    if not token or not secrets.compare_digest(token, session.csrf_token):
        raise HTTPException(403, "Token CSRF tidak valid. Muat ulang halaman.")


def refresh_session(db, token):
    try:
        sid = uuid.UUID(token.split(".", 1)[0])
    except (ValueError, AttributeError):
        raise HTTPException(401, "Sesi berakhir. Silakan masuk kembali.")
    session = db.get(RefreshSession, sid)
    if not session or session.revoked or aware(session.expires_at) <= utcnow():
        raise HTTPException(401, "Sesi berakhir. Silakan masuk kembali.")
    if not secrets.compare_digest(session.token_hash, digest(token)):
        session.revoked = True
        db.commit()
        raise HTTPException(401, "Token sesi telah digunakan. Silakan masuk kembali.")
    return session


def current_user(
    request: Request,
    db: Session = Depends(get_db),
    authorization: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    token = authorization.credentials if authorization else request.cookies.get("sw_access")
    try:
        claims = jwt.decode(
            token or "",
            settings().jwt_secret,
            algorithms=["HS256"],
            audience="smart-waste-clients",
            issuer="smart-waste",
            options={"require": ["sub", "sid", "exp", "iat"]},
        )
        user = db.get(User, uuid.UUID(claims["sub"]))
        session = db.get(RefreshSession, uuid.UUID(claims["sid"]))
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise HTTPException(401, "Sesi berakhir. Silakan masuk kembali.")
    if (
        not user
        or not user.active
        or not session
        or session.revoked
        or session.user_id != user.id
        or aware(session.expires_at) <= utcnow()
    ):
        raise HTTPException(401, "Sesi tidak aktif. Silakan masuk kembali.")
    if not authorization and request.method not in ("GET", "HEAD", "OPTIONS"):
        csrf(request, session)
    return user


def admin_user(user: User = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Akses khusus Admin")
    return user
