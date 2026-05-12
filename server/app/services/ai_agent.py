"""
AI Agent Orchestrator
─────────────────────────────────────────────────────────────────────────────
Public entry point: process_new_ticket(ticket_id)

Loads the ticket + system config from the DB, builds the initial AgentState,
invokes the compiled LangGraph pipeline (agent_graph.compiled_graph), then
persists the final status, priority, severity, confidence score, and generated
response back to the DB.

email_monitor.py calls process_new_ticket() — its interface is unchanged.
"""

import logging
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import SystemConfig, EmailTicket, TicketStatus, SecurityLog, Priority, Severity

logger = logging.getLogger(__name__)


async def process_new_ticket(ticket_id: int) -> None:
    """
    Orchestrates AI processing for a single email ticket using LangGraph.
    Called by email_monitor.py after a new ticket is saved to the DB.
    """
    # ── 1. Load ticket from DB ────────────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        ticket = await db.get(EmailTicket, ticket_id)
        if not ticket:
            logger.error(f"Ticket {ticket_id} not found.")
            return

        logger.info(f"[Agent] Processing ticket {ticket_id}: {ticket.subject}")
        ticket.status = TicketStatus.processing
        await db.commit()

        # Load system config
        api_key   = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "openai_api_key"))
        model     = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "openai_model")) or "gpt-4o"
        threshold = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "confidence_threshold"))
        copilot_desc = await db.scalar(select(SystemConfig.value).where(SystemConfig.key == "copilot_description"))

        sender  = ticket.sender_email
        subject = ticket.subject
        body    = ticket.body

    if not api_key:
        logger.error("OpenAI API key not set — escalating ticket.")
        async with AsyncSessionLocal() as db:
            t = await db.get(EmailTicket, ticket_id)
            if t:
                t.status       = TicketStatus.escalated
                t.processed_at = datetime.utcnow()
                await db.commit()
        return

    # ── 2. Build initial state ─────────────────────────────────────────────────
    initial_state = {
        "ticket_id":            ticket_id,
        "sender_email":         sender or "",
        "subject":              subject or "",
        "body":                 body or "",
        "api_key":              api_key,
        "model_name":           model,
        "confidence_threshold": float(threshold) if threshold else 0.8,
        "copilot_description":  copilot_desc or "",
        # defaults — will be overwritten by graph nodes
        "is_safe":              True,
        "flag_type":            None,
        "flag_detail":          None,
        "priority":             "medium",
        "severity":             "medium",
        "knowledge_context":    None,
        "generated_response":   None,
        "confidence_score":     0.0,
        "final_status":         "escalated",
        "reply_sent":           False,
    }

    # ── 3. Run the LangGraph pipeline ─────────────────────────────────────────
    try:
        from app.services.agent_graph import compiled_graph
        final_state = await compiled_graph.ainvoke(initial_state)
    except Exception as exc:
        logger.error(f"[Agent] LangGraph execution failed for ticket {ticket_id}: {exc}")
        async with AsyncSessionLocal() as db:
            t = await db.get(EmailTicket, ticket_id)
            if t:
                t.status       = TicketStatus.escalated
                t.processed_at = datetime.utcnow()
                await db.commit()
        return

    # ── 4. Persist results ────────────────────────────────────────────────────
    final_status   = final_state.get("final_status", "escalated")
    flag_type      = final_state.get("flag_type")
    flag_detail    = final_state.get("flag_detail")
    priority_val   = final_state.get("priority", "medium")
    severity_val   = final_state.get("severity", "medium")
    confidence     = final_state.get("confidence_score", 0.0)
    generated      = final_state.get("generated_response", "")
    reply_sent     = final_state.get("reply_sent", False)

    status_map = {
        "resolved":  TicketStatus.resolved,
        "escalated": TicketStatus.escalated,
        "blocked":   TicketStatus.blocked,
    }

    async with AsyncSessionLocal() as db:
        t = await db.get(EmailTicket, ticket_id)
        if not t:
            return

        t.status             = status_map.get(final_status, TicketStatus.escalated)
        t.priority           = Priority(priority_val)
        t.severity           = Severity(severity_val)
        t.confidence_score   = confidence
        t.generated_response = generated
        t.reply_sent         = reply_sent
        t.processed_at       = datetime.utcnow()
        await db.commit()

        # Log security events
        if final_status == "blocked" and flag_type:
            sec_log = SecurityLog(
                email_ticket_id=ticket_id,
                flag_type=flag_type,
                action_taken="blocked",
                detail=flag_detail,
            )
            db.add(sec_log)
            await db.commit()

    logger.info(
        f"[Agent] Ticket {ticket_id} → {final_status.upper()} "
        f"| priority={priority_val} severity={severity_val} "
        f"| confidence={confidence:.2f} reply_sent={reply_sent}"
    )
