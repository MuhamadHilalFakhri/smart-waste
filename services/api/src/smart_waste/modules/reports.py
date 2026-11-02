import json
import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..config import settings
from ..database import get_db
from ..inference import classifier
from ..media import normalize_upload, store_image
from ..models import Prediction, Report, StatusHistory, User
from ..schemas import Category, ReportDetail, ReportOut, ReportPage, Status, StatusIn
from ..security import admin_user, current_user, utcnow

router = APIRouter(prefix="/reports", tags=["reports"])


def scoped(user):
    query = select(Report).where(Report.deleted_at.is_(None))
    return query if user.role == "admin" else query.where(Report.owner_id == user.id)


def get_report(db, user, report_id, lock=False):
    query = scoped(user).where(Report.id == report_id)
    report = db.scalar(
        query.with_for_update().execution_options(populate_existing=True) if lock else query
    )
    if not report:
        raise HTTPException(404, "Laporan tidak ditemukan")
    return report


def filtered(query, q="", status=None, category=None, start_date=None, end_date=None):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(422, "Tanggal awal tidak boleh setelah tanggal akhir")
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions = [Report.description.ilike(f"%{escaped}%", escape="\\")]
        try:
            conditions.append(Report.id == uuid.UUID(q))
        except ValueError:
            pass
        query = query.where(or_(*conditions))
    if status:
        query = query.where(Report.status == status)
    if category:
        query = query.where(Report.category == category)
    if start_date:
        query = query.where(
            Report.created_at >= datetime.combine(start_date, time.min, timezone.utc)
        )
    if end_date:
        query = query.where(
            Report.created_at
            < datetime.combine(end_date + timedelta(days=1), time.min, timezone.utc)
        )
    return query


def detail(db, report):
    base = ReportOut.model_validate(report).model_dump()
    base["history"] = db.scalars(
        select(StatusHistory)
        .where(StatusHistory.report_id == report.id)
        .order_by(StatusHistory.created_at, StatusHistory.id)
    ).all()
    base["predictions"] = [
        {
            "id": p.id,
            "category": p.category,
            "confidence": p.confidence,
            "model_version": p.model_version,
            "outcome": p.outcome,
            "probabilities": json.loads(p.probabilities_json),
            "created_at": p.created_at,
        }
        for p in db.scalars(
            select(Prediction)
            .where(Prediction.report_id == report.id)
            .order_by(Prediction.created_at.desc())
        ).all()
    ]
    return base


def prediction_record(report, result):
    return Prediction(
        report_id=report.id,
        image_path=report.image_path,
        category=result["category"],
        confidence=result["confidence"],
        model_version=result["model_version"],
        outcome=result["outcome"],
        probabilities_json=json.dumps(result["probabilities"]),
    )


@router.get("", response_model=ReportPage)
def list_reports(
    q: str = Query("", max_length=200),
    status: Status | None = None,
    category: Category | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = filtered(scoped(user), q, status, category, start_date, end_date)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(Report.created_at.desc(), Report.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=ReportDetail, status_code=201)
async def create_report(
    description: str = Form(min_length=10, max_length=5000),
    category: Category = Form(),
    latitude: float = Form(ge=-90, le=90),
    longitude: float = Form(ge=-180, le=180),
    accuracy: float | None = Form(None, ge=0, le=100000),
    photo: UploadFile = File(),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if len(description.strip()) < 10:
        raise HTTPException(422, "Deskripsi minimal 10 karakter")
    image = await normalize_upload(photo)
    result = await run_in_threadpool(classifier.predict, image)
    filename = store_image(image)
    report = Report(
        id=uuid.uuid4(),
        owner_id=user.id,
        description=description.strip(),
        category=category,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        image_path=filename,
        status="pending",
    )
    db.add(report)
    try:
        db.flush()
        db.add(prediction_record(report, result))
        db.add(
            StatusHistory(
                report_id=report.id, actor_id=user.id, next_status="pending", note="Laporan dibuat"
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        (settings().storage_dir / filename).unlink(missing_ok=True)
        raise
    return detail(db, report)


@router.get("/{report_id}", response_model=ReportDetail)
def read_report(report_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    return detail(db, get_report(db, user, report_id))


@router.get("/{report_id}/photo", response_class=FileResponse)
def report_photo(report_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    report = get_report(db, user, report_id)
    path = settings().storage_dir / report.image_path
    if not path.is_file():
        raise HTTPException(404, "Foto tidak ditemukan")
    return FileResponse(
        path, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"}
    )


@router.patch("/{report_id}", response_model=ReportDetail)
async def edit_report(
    report_id: uuid.UUID,
    description: str = Form(min_length=10, max_length=5000),
    category: Category = Form(),
    latitude: float = Form(ge=-90, le=90),
    longitude: float = Form(ge=-180, le=180),
    accuracy: float | None = Form(None, ge=0, le=100000),
    photo: UploadFile | None = File(None),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    # Re-check the status under a row lock immediately before updating.
    if len(description.strip()) < 10:
        raise HTTPException(422, "Deskripsi minimal 10 karakter")
    get_report(db, user, report_id)
    filename = None
    result = None
    if photo:
        image = await normalize_upload(photo)
        result = await run_in_threadpool(classifier.predict, image)
        filename = store_image(image)
    try:
        report = get_report(db, user, report_id, lock=True)
        if user.role != "admin" and report.status != "pending":
            raise HTTPException(409, "Laporan hanya dapat diedit saat Pending")
        report.description, report.category = description.strip(), category
        report.latitude, report.longitude, report.accuracy = latitude, longitude, accuracy
        report.updated_at = utcnow()
        if filename:
            report.image_path = filename
            db.add(prediction_record(report, result))
        db.add(
            StatusHistory(
                report_id=report.id,
                actor_id=user.id,
                previous_status=report.status,
                next_status=report.status,
                note="Isi laporan diperbarui",
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        if filename:
            (settings().storage_dir / filename).unlink(missing_ok=True)
        raise
    return detail(db, report)


@router.delete("/{report_id}", status_code=204)
def archive_report(report_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    report = get_report(db, user, report_id, lock=True)
    if user.role != "admin" and report.status != "pending":
        raise HTTPException(409, "Laporan hanya dapat dihapus saat Pending")
    report.deleted_at = utcnow()
    db.add(
        StatusHistory(
            report_id=report.id,
            actor_id=user.id,
            previous_status=report.status,
            next_status=report.status,
            note="Laporan diarsipkan",
        )
    )
    db.commit()


@router.patch("/{report_id}/status", response_model=ReportDetail)
def change_status(
    report_id: uuid.UUID, body: StatusIn, user=Depends(admin_user), db: Session = Depends(get_db)
):
    report = get_report(db, user, report_id, lock=True)
    allowed = {"pending": {"in_progress", "rejected"}, "in_progress": {"completed", "rejected"}}
    if body.status not in allowed.get(report.status, set()):
        raise HTTPException(409, "Transisi status tidak diizinkan")
    if body.status == "rejected" and not body.note.strip():
        raise HTTPException(422, "Alasan penolakan wajib diisi")
    db.add(
        StatusHistory(
            report_id=report.id,
            actor_id=user.id,
            previous_status=report.status,
            next_status=body.status,
            note=body.note.strip(),
        )
    )
    report.status, report.updated_at = body.status, utcnow()
    db.commit()
    return detail(db, report)
