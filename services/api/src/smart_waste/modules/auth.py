from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import AuthOut, LoginIn, RefreshIn, RegisterIn, UserOut
from ..security import (
    check_origin,
    clear_cookies,
    csrf,
    current_user,
    hasher,
    issue,
    login_limit,
    new_session,
    refresh_session,
    rotate,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
DUMMY_HASH = hasher.hash("timing-comparison-only-password")


@router.post("/register", response_model=AuthOut, status_code=201)
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    check_origin(request)
    login_limit(request)
    user = User(
        name=body.name, email=str(body.email).lower(), password_hash=hasher.hash(body.password)
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email sudah digunakan")
    session, refresh = new_session(db, user)
    return issue(response, user, session, refresh, request.headers.get("x-client-type") == "mobile")


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    check_origin(request)
    login_limit(request)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    valid = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not user.active or not valid:
        raise HTTPException(401, "Email atau password tidak sesuai")
    session, refresh = new_session(db, user)
    return issue(response, user, session, refresh, request.headers.get("x-client-type") == "mobile")


@router.post("/refresh", response_model=AuthOut)
def refresh(body: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    mobile = request.headers.get("x-client-type") == "mobile"
    session = refresh_session(
        db, body.refresh_token if mobile else request.cookies.get("sw_refresh")
    )
    if not mobile:
        csrf(request, session)
    user = db.get(User, session.user_id)
    if not user or not user.active:
        raise HTTPException(401, "Akun tidak aktif")
    value = rotate(session)
    db.commit()
    return issue(response, user, session, value, mobile)


@router.post("/logout", status_code=204)
def logout(body: RefreshIn, request: Request, response: Response, db: Session = Depends(get_db)):
    mobile = request.headers.get("x-client-type") == "mobile"
    token = body.refresh_token if mobile else request.cookies.get("sw_refresh")
    if token:
        session = refresh_session(db, token)
        if not mobile:
            csrf(request, session)
        session.revoked = True
        db.commit()
    clear_cookies(response)


@router.get("/me", response_model=UserOut)
def me(user=Depends(current_user)):
    return user
