import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RefreshSession, User
from ..schemas import UserCreate, UserOut, UserPage, UserUpdate
from ..security import admin_user, hasher

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(admin_user)])


@router.get("", response_model=UserPage)
def list_users(
    q: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(User)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(
            or_(
                User.name.ilike(f"%{escaped}%", escape="\\"),
                User.email.ilike(f"%{escaped}%", escape="\\"),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    user = User(
        name=body.name,
        email=str(body.email).lower(),
        role=body.role,
        password_hash=hasher.hash(body.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email sudah digunakan")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, body: UserUpdate, db: Session = Depends(get_db)):
    admins = db.scalars(
        select(User)
        .where(User.role == "admin", User.active.is_(True))
        .order_by(User.id)
        .with_for_update()
    ).all()
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    if (
        user.role == "admin"
        and user.active
        and (body.role != "admin" or not body.active)
        and len(admins) <= 1
    ):
        raise HTTPException(409, "Admin aktif terakhir tidak boleh dinonaktifkan atau diturunkan")
    user.name, user.role, user.active = body.name, body.role, body.active
    if not user.active or body.role != "admin":
        db.execute(
            update(RefreshSession).where(RefreshSession.user_id == user_id).values(revoked=True)
        )
    db.commit()
    return user
