import asyncio
import logging
from datetime import datetime
from imap_tools import MailBox, AND
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import SystemConfig, EmailTicket, TicketStatus
# Note: we import ai_agent dynamically or after definition to avoid circular imports

logger = logging.getLogger(__name__)

async def fetch_emails():
    """
    Connects to the IMAP server and fetches unread emails.
    """
    async with AsyncSessionLocal() as db:
        # Get IMAP config from database
        imap_host = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "imap_host"))
        imap_user = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "imap_user"))
        imap_pass = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "imap_password"))
        imap_folder = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "imap_folder"))
        
        if not imap_host or not imap_user or not imap_pass:
            logger.warning("IMAP configuration is missing. Configure via Admin dashboard.")
            return

    def _fetch_sync():
        new_tickets = []
        try:
            folder_to_check = imap_folder or 'INBOX'
            with MailBox(imap_host).login(imap_user, imap_pass, initial_folder=folder_to_check) as mailbox:
                # fetch all unread, maximum 10 per cycle to prevent overwhelming the AI
                for msg in mailbox.fetch(AND(seen=False), mark_seen=True, limit=10):
                    new_tickets.append({
                        "sender_email": msg.from_,
                        "subject": msg.subject,
                        "body": msg.text or msg.html, # Prefer plain text if available, fallback to HTML
                        "received_at": msg.date
                    })
        except Exception as e:
            logger.error(f"Error fetching emails from IMAP: {e}")
        return new_tickets
    
    # Run IMAP blocking call in thread
    new_tickets_data = await asyncio.to_thread(_fetch_sync)

    if new_tickets_data:
        async with AsyncSessionLocal() as db:
            from app.services.ai_agent import process_new_ticket
            
            for data in new_tickets_data:
                # Basic cleanup
                sender = data["sender_email"][:150] if data["sender_email"] else "unknown"
                subject = data["subject"][:500] if data["subject"] else "(No Subject)"
                body = data["body"] or ""
                
                ticket = EmailTicket(
                    sender_email=sender,
                    subject=subject,
                    body=body,
                    status=TicketStatus.received,
                    received_at=data["received_at"].replace(tzinfo=None) if data["received_at"] else datetime.utcnow()
                )
                db.add(ticket)
                await db.commit()
                await db.refresh(ticket)
                
                # Process sequentially to avoid hitting OpenAI TPM rate limits
                await process_new_ticket(ticket.id)
