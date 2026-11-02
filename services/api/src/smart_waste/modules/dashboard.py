from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import Category, DashboardOut, Status
from ..security import current_user
from .reports import filtered, scoped

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(
    status: Status | None = None,
    category: Category | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    sub = filtered(
        scoped(user), status=status, category=category, start_date=start_date, end_date=end_date
    ).subquery()
    status_counts = dict(
        db.execute(select(sub.c.status, func.count()).group_by(sub.c.status)).all()
    )
    category_counts = dict(
        db.execute(select(sub.c.category, func.count()).group_by(sub.c.category)).all()
    )
    day = func.date(sub.c.created_at)
    dates = db.execute(select(day, func.count()).group_by(day).order_by(day.desc()).limit(30)).all()
    return {
        "total": sum(status_counts.values()),
        "by_status": {
            s: status_counts.get(s, 0) for s in ("pending", "in_progress", "completed", "rejected")
        },
        "by_category": {c: category_counts.get(c, 0) for c in ("organic", "plastic", "paper")},
        "by_day": [{"date": str(d), "count": count} for d, count in reversed(dates)],
    }
