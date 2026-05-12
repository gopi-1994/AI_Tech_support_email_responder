from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app import models, schemas
from app.auth_utils import require_admin
from typing import List

router = APIRouter()


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    """
    Full dashboard statistics:
      - Status breakdown (total, received, processing, resolved, escalated, blocked)
      - Priority breakdown (low, medium, high, critical)
      - Severity breakdown (low, medium, high)
      - Reply sent count
      - Security log counts by flag type
    """
    T = models.EmailTicket
    S = models.SecurityLog

    # ── Status counts ──────────────────────────────────────────────────────────
    total       = await db.scalar(select(func.count(T.id)))
    received    = await db.scalar(select(func.count(T.id)).where(T.status == "received"))
    processing  = await db.scalar(select(func.count(T.id)).where(T.status == "processing"))
    resolved    = await db.scalar(select(func.count(T.id)).where(T.status == "resolved"))
    escalated   = await db.scalar(select(func.count(T.id)).where(T.status == "escalated"))
    blocked     = await db.scalar(select(func.count(T.id)).where(T.status == "blocked"))

    # ── Priority counts ────────────────────────────────────────────────────────
    p_low      = await db.scalar(select(func.count(T.id)).where(T.priority == "low"))
    p_medium   = await db.scalar(select(func.count(T.id)).where(T.priority == "medium"))
    p_high     = await db.scalar(select(func.count(T.id)).where(T.priority == "high"))
    p_critical = await db.scalar(select(func.count(T.id)).where(T.priority == "critical"))

    # ── Severity counts ────────────────────────────────────────────────────────
    s_low    = await db.scalar(select(func.count(T.id)).where(T.severity == "low"))
    s_medium = await db.scalar(select(func.count(T.id)).where(T.severity == "medium"))
    s_high   = await db.scalar(select(func.count(T.id)).where(T.severity == "high"))

    # ── Reply sent ─────────────────────────────────────────────────────────────
    replies_sent = await db.scalar(select(func.count(T.id)).where(T.reply_sent == True))

    # ── Security log breakdown ─────────────────────────────────────────────────
    spam     = await db.scalar(select(func.count(S.id)).where(S.flag_type == "spam"))
    phishing = await db.scalar(select(func.count(S.id)).where(S.flag_type == "phishing"))
    injection= await db.scalar(select(func.count(S.id)).where(S.flag_type == "prompt_injection"))

    # ── Auto-resolution rate ───────────────────────────────────────────────────
    processed = (resolved or 0) + (escalated or 0) + (blocked or 0)
    resolution_rate = round((resolved or 0) / processed * 100, 1) if processed > 0 else 0.0

    return {
        "status": {
            "total":      total      or 0,
            "received":   received   or 0,
            "processing": processing or 0,
            "resolved":   resolved   or 0,
            "escalated":  escalated  or 0,
            "blocked":    blocked    or 0,
        },
        "priority": {
            "low":      p_low      or 0,
            "medium":   p_medium   or 0,
            "high":     p_high     or 0,
            "critical": p_critical or 0,
        },
        "severity": {
            "low":    s_low    or 0,
            "medium": s_medium or 0,
            "high":   s_high   or 0,
        },
        "security": {
            "spam":             spam      or 0,
            "phishing":         phishing  or 0,
            "prompt_injection": injection or 0,
        },
        "replies_sent":    replies_sent or 0,
        "resolution_rate": resolution_rate,
        # Legacy flat keys kept for backward compatibility
        "total":     total     or 0,
        "resolved":  resolved  or 0,
        "escalated": escalated or 0,
        "blocked":   blocked   or 0,
    }


@router.get("/tickets", response_model=List[schemas.EmailTicketOut])
async def get_tickets(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(models.EmailTicket).order_by(models.EmailTicket.received_at.desc())
    )
    return result.scalars().all()


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(models.EmailTicket).where(models.EmailTicket.id == ticket_id)
    )
    return result.scalar_one_or_none()


@router.get("/security-logs")
async def get_security_logs(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(models.SecurityLog).order_by(models.SecurityLog.logged_at.desc()).limit(100)
    )
    return result.scalars().all()
