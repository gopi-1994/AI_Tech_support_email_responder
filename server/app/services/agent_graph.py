"""
LangGraph AI Agent Pipeline
─────────────────────────────────────────────────────────────────────────────
Implements the architecture from the system design diagram (image.png) as a
proper LangGraph StateGraph.

Graph nodes (in order):
  1. security_check      — keyword/rule-based security screening
  2. classify_ticket     — LLM classifies priority + severity
  3. retrieve_knowledge  — Microsoft Copilot Retrieval API (SharePoint RAG)
  4. generate_response   — LangChain ChatOpenAI generates the reply
  5. evaluate_confidence — threshold check → resolve or escalate
  6. resolve_ticket      — sends email reply, marks RESOLVED
  7. escalate_ticket     — marks ESCALATED (L2 support)
  8. block_ticket        — marks BLOCKED, logs security event

Conditional edges:
  security_check → "block_ticket" if unsafe, else "classify_ticket"
  evaluate_confidence → "resolve_ticket" if score≥threshold, else "escalate_ticket"
"""

import logging
import json
from typing import Optional, TypedDict, Literal

from langgraph.graph import StateGraph, END

from app.services.security import analyze_email_security
from app.services.knowledge import retrieve_knowledge
from app.services.email_sender import send_reply_email

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Shared State
# ─────────────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    # Input — loaded from DB before graph starts
    ticket_id:            int
    sender_email:         str
    subject:              str
    body:                 str
    # LLM config (loaded once)
    api_key:              str
    model_name:           str
    confidence_threshold: float
    copilot_description:  str
    # Security
    is_safe:              bool
    flag_type:            Optional[str]
    flag_detail:          Optional[str]
    # Classification
    priority:             str   # low | medium | high | critical
    severity:             str   # low | medium | high
    # Knowledge retrieval
    knowledge_context:    Optional[str]
    # Response
    generated_response:   Optional[str]
    confidence_score:     float
    # Final
    final_status:         str   # resolved | escalated | blocked
    reply_sent:           bool


# ─────────────────────────────────────────────────────────────────────────────
# Node 1 — Security Check
# ─────────────────────────────────────────────────────────────────────────────

async def security_check(state: AgentState) -> AgentState:
    logger.info(f"[LangGraph] Node: security_check — ticket {state['ticket_id']}")
    is_safe, flag_type, flag_detail = analyze_email_security(
        state["sender_email"], state["subject"], state["body"]
    )
    return {**state, "is_safe": is_safe, "flag_type": flag_type, "flag_detail": flag_detail}


def route_after_security(state: AgentState) -> Literal["classify_ticket", "block_ticket"]:
    return "classify_ticket" if state["is_safe"] else "block_ticket"


# ─────────────────────────────────────────────────────────────────────────────
# Node 2 — Classify Ticket (Priority + Severity via LLM)
# ─────────────────────────────────────────────────────────────────────────────

async def classify_ticket(state: AgentState) -> AgentState:
    logger.info(f"[LangGraph] Node: classify_ticket — ticket {state['ticket_id']}")
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatOpenAI(
            api_key=state["api_key"],
            model=state["model_name"],
            temperature=0,
        )

        prompt = (
            "Classify the following IT support email.\n"
            "Return ONLY valid JSON with two keys:\n"
            '  "priority": one of ["low","medium","high","critical"]\n'
            '  "severity": one of ["low","medium","high"]\n\n'
            f"Subject: {state['subject']}\n"
            f"Body: {state['body'][:500]}"
        )

        response = await llm.ainvoke([
            SystemMessage(content="You are an IT support triage assistant."),
            HumanMessage(content=prompt),
        ])

        content = response.content.strip()
        if content.startswith("```json"): content = content[7:]
        elif content.startswith("```"): content = content[3:]
        if content.endswith("```"): content = content[:-3]
        content = content.strip()

        data = json.loads(content)
        priority = data.get("priority", "medium")
        severity = data.get("severity", "medium")
    except Exception as exc:
        logger.warning(f"classify_ticket failed: {exc} — defaulting to medium/medium")
        priority, severity = "medium", "medium"

    return {**state, "priority": priority, "severity": severity}


# ─────────────────────────────────────────────────────────────────────────────
# Node 3 — Knowledge Retrieval (Copilot + SharePoint RAG)
# ─────────────────────────────────────────────────────────────────────────────

async def retrieve_knowledge_node(state: AgentState) -> AgentState:
    logger.info(f"[LangGraph] Node: retrieve_knowledge — ticket {state['ticket_id']}")
    raw_query = f"{state['subject']} {state['body']}"
    # Sanitize query: remove newlines which might break the Graph API search parser
    query = raw_query.replace("\n", " ").replace("\r", " ").strip()
    knowledge_context = await retrieve_knowledge(query)
    return {**state, "knowledge_context": knowledge_context}


# ─────────────────────────────────────────────────────────────────────────────
# Node 4 — Generate Response (LangChain ChatOpenAI)
# ─────────────────────────────────────────────────────────────────────────────

async def generate_response(state: AgentState) -> AgentState:
    logger.info(f"[LangGraph] Node: generate_response — ticket {state['ticket_id']}")
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatOpenAI(
            api_key=state["api_key"],
            model=state["model_name"],
            temperature=0.3,
        )

        system_prompt = (
            "You are a professional IT Support AI Agent. "
            "Use the provided Knowledge Base context to write a helpful, concise reply. "
            "Respond in a strict professional email format. "
            "CRITICAL: Address the user using their provided Sender Email. Do NOT use any placeholders like [Recipient's Name], [Your Name], [Company Name], or any square brackets at all. "
            "Always sign off the email exactly as: 'Best regards,\\n\\nSupport Team'. "
            f"Base your confidence score on how well the Knowledge Base Context addresses the user's issue. You should know that the Knowledge Base contains: {state.get('copilot_description', 'general documentation')}. "
            "Return ONLY valid JSON with no markdown formatting inside the response_text: "
            '{"response_text": "...", "confidence_score": 0.0}'
        )

        user_content = f"Sender Email: {state['sender_email']}\nSubject: {state['subject']}\n\nBody: {state['body']}\n"
        if state.get("knowledge_context"):
            user_content += f"\n--- Knowledge Base Context ---\n{state['knowledge_context']}\n"
        else:
            user_content += "\n--- No relevant knowledge found. Answer generally. ---\n"

        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_content),
        ])

        content = response.content.strip()
        if content.startswith("```json"): content = content[7:]
        elif content.startswith("```"): content = content[3:]
        if content.endswith("```"): content = content[:-3]
        content = content.strip()

        data = json.loads(content)
        generated_response = data.get("response_text", "")
        confidence_score = float(data.get("confidence_score", 0.0))
    except Exception as exc:
        logger.error(f"generate_response failed: {exc}")
        generated_response = ""
        confidence_score = 0.0

    return {**state, "generated_response": generated_response, "confidence_score": confidence_score}


# ─────────────────────────────────────────────────────────────────────────────
# Node 5 — Evaluate Confidence
# ─────────────────────────────────────────────────────────────────────────────

async def evaluate_confidence(state: AgentState) -> AgentState:
    logger.info(
        f"[LangGraph] Node: evaluate_confidence — ticket {state['ticket_id']} "
        f"score={state['confidence_score']:.2f} threshold={state['confidence_threshold']:.2f}"
    )
    # Nothing to update here; routing is done via the conditional edge
    return state


def route_after_confidence(state: AgentState) -> Literal["resolve_ticket", "escalate_ticket"]:
    if state["confidence_score"] >= state["confidence_threshold"]:
        return "resolve_ticket"
    return "escalate_ticket"


# ─────────────────────────────────────────────────────────────────────────────
# Node 6 — Resolve Ticket (send email reply + mark RESOLVED)
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_ticket(state: AgentState) -> AgentState:
    logger.info(f"[LangGraph] Node: resolve_ticket — ticket {state['ticket_id']}")
    reply_sent = await send_reply_email(
        to_address=state["sender_email"],
        subject=state["subject"],
        body=state["generated_response"] or "",
    )
    return {**state, "final_status": "resolved", "reply_sent": reply_sent}


# ─────────────────────────────────────────────────────────────────────────────
# Node 7 — Escalate Ticket (L2 support)
# ─────────────────────────────────────────────────────────────────────────────

async def escalate_ticket(state: AgentState) -> AgentState:
    logger.info(f"[LangGraph] Node: escalate_ticket — ticket {state['ticket_id']} (L2)")
    
    from app.database import AsyncSessionLocal
    from app.models import SystemConfig
    from sqlalchemy import select
    from app.services.email_sender import send_escalation_email
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(SystemConfig.value).where(SystemConfig.key == "escalation_emails"))
        escalation_emails = res.scalar_one_or_none()
        
    if escalation_emails:
        await send_escalation_email(
            escalation_emails=escalation_emails,
            ticket_id=state['ticket_id'],
            original_sender=state['sender_email'],
            subject=state['subject'],
            body=state['body']
        )
        
    return {**state, "final_status": "escalated"}


# ─────────────────────────────────────────────────────────────────────────────
# Node 8 — Block Ticket (security violation)
# ─────────────────────────────────────────────────────────────────────────────

async def block_ticket(state: AgentState) -> AgentState:
    logger.info(
        f"[LangGraph] Node: block_ticket — ticket {state['ticket_id']} "
        f"reason={state.get('flag_type')}"
    )
    return {**state, "final_status": "blocked"}


# ─────────────────────────────────────────────────────────────────────────────
# Graph Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """
    Build and compile the LangGraph StateGraph.
    Matches the architecture diagram (image.png) exactly.
    """
    g = StateGraph(AgentState)

    # Register nodes
    g.add_node("security_check",      security_check)
    g.add_node("classify_ticket",     classify_ticket)
    g.add_node("retrieve_knowledge",  retrieve_knowledge_node)
    g.add_node("generate_response",   generate_response)
    g.add_node("evaluate_confidence", evaluate_confidence)
    g.add_node("resolve_ticket",      resolve_ticket)
    g.add_node("escalate_ticket",     escalate_ticket)
    g.add_node("block_ticket",        block_ticket)

    # Entry point
    g.set_entry_point("security_check")

    # Conditional edge: security result
    g.add_conditional_edges(
        "security_check",
        route_after_security,
        {
            "classify_ticket": "classify_ticket",
            "block_ticket":    "block_ticket",
        },
    )

    # Linear pipeline: classify → retrieve → generate → evaluate
    g.add_edge("classify_ticket",    "retrieve_knowledge")
    g.add_edge("retrieve_knowledge", "generate_response")
    g.add_edge("generate_response",  "evaluate_confidence")

    # Conditional edge: confidence threshold
    g.add_conditional_edges(
        "evaluate_confidence",
        route_after_confidence,
        {
            "resolve_ticket":  "resolve_ticket",
            "escalate_ticket": "escalate_ticket",
        },
    )

    # Terminal nodes
    g.add_edge("resolve_ticket",  END)
    g.add_edge("escalate_ticket", END)
    g.add_edge("block_ticket",    END)

    return g.compile()


# Compile once at module load
compiled_graph = build_graph()
