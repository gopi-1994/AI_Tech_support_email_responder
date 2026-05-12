"""
SMTP Email Sender Service
Sends generated AI responses back to the ticket sender.
SMTP credentials are read from the SystemConfig DB table.
"""
import asyncio
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import SystemConfig

logger = logging.getLogger(__name__)


async def _load_smtp_config() -> dict:
    """Load SMTP settings from SystemConfig DB."""
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from"]
    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(SystemConfig).where(SystemConfig.key.in_(keys))
        )
        cfg = {row.key: row.value for row in rows.scalars()}
    return cfg


async def send_reply_email(
    to_address: str,
    subject: str,
    body: str,
) -> bool:
    """
    Send an email reply to the ticket sender via SMTP.

    Returns True on success, False on failure.
    """
    cfg = await _load_smtp_config()
    smtp_host = cfg.get("smtp_host")
    smtp_port = int(cfg.get("smtp_port") or 587)
    smtp_user = cfg.get("smtp_user")
    smtp_password = cfg.get("smtp_password")
    smtp_from = cfg.get("smtp_from") or smtp_user

    if not all([smtp_host, smtp_user, smtp_password]):
        logger.warning("SMTP not configured — skipping email reply.")
        return False

    reply_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = reply_subject
    msg["From"]    = smtp_from
    msg["To"]      = to_address

    # Plain text part
    msg.attach(MIMEText(body, "plain"))

    def _send_sync():
        context = ssl.create_default_context()
        if smtp_port == 465:
            # SSL
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, to_address, msg.as_string())
        else:
            # STARTTLS (587 / 25)
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, to_address, msg.as_string())

    try:
        await asyncio.to_thread(_send_sync)
        logger.info(f"Reply sent to {to_address} for subject: {reply_subject}")
        return True
    except Exception as exc:
        logger.error(f"SMTP send failed to {to_address}: {exc}")
        return False


async def send_escalation_email(
    escalation_emails: str,
    ticket_id: int,
    original_sender: str,
    subject: str,
    body: str,
) -> bool:
    """
    Forward an escalated ticket to the specified internal team emails.
    """
    cfg = await _load_smtp_config()
    smtp_host = cfg.get("smtp_host")
    smtp_port = int(cfg.get("smtp_port") or 587)
    smtp_user = cfg.get("smtp_user")
    smtp_password = cfg.get("smtp_password")
    smtp_from = cfg.get("smtp_from") or smtp_user

    if not all([smtp_host, smtp_user, smtp_password]):
        logger.warning("SMTP not configured — skipping escalation email.")
        return False
        
    emails_list = [e.strip() for e in escalation_emails.split(",") if e.strip()]
    if not emails_list:
        return False

    forward_subject = f"[ESCALATED] Ticket #{ticket_id}: {subject}"
    
    forward_body = (
        f"An email ticket has been escalated for manual review.\n\n"
        f"--- TICKET DETAILS ---\n"
        f"Ticket ID: {ticket_id}\n"
        f"From: {original_sender}\n"
        f"Subject: {subject}\n\n"
        f"--- ORIGINAL MESSAGE ---\n"
        f"{body}\n"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = forward_subject
    msg["From"]    = smtp_from
    msg["To"]      = ", ".join(emails_list)

    msg.attach(MIMEText(forward_body, "plain"))

    def _send_sync():
        context = ssl.create_default_context()
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, emails_list, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, emails_list, msg.as_string())

    try:
        await asyncio.to_thread(_send_sync)
        logger.info(f"Escalation email sent to {len(emails_list)} recipients for ticket {ticket_id}")
        return True
    except Exception as exc:
        logger.error(f"SMTP escalation send failed for ticket {ticket_id}: {exc}")
        return False
