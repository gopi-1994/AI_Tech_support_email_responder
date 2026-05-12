from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from app import models, schemas
from app.auth_utils import get_current_user
from typing import List
from datetime import datetime
import openai

router = APIRouter()

async def get_openai_config(db: AsyncSession):
    keys = ["openai_api_key", "openai_model"]
    result = await db.execute(select(models.SystemConfig).where(models.SystemConfig.key.in_(keys)))
    rows = {r.key: r.value for r in result.scalars().all()}
    return rows.get("openai_api_key"), rows.get("openai_model", "gpt-4o")

@router.get("/sessions", response_model=List[schemas.ChatSessionOut])
async def get_sessions(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(models.ChatSession)
        .where(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc())
    )
    return result.scalars().all()

@router.post("/sessions", response_model=schemas.ChatSessionOut)
async def create_session(payload: schemas.ChatSessionCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    session = models.ChatSession(user_id=current_user.id, title=payload.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(models.ChatSession).where(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"detail": "Deleted"}

@router.get("/sessions/{session_id}/messages", response_model=List[schemas.MessageOut])
async def get_messages(session_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(models.ChatMessage)
        .where(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.timestamp.asc())
    )
    return result.scalars().all()

@router.post("/sessions/{session_id}/messages", response_model=schemas.MessageOut)
async def send_message(session_id: int, payload: schemas.MessageCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    # Verify session ownership
    res = await db.execute(select(models.ChatSession).where(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save user message
    user_msg = models.ChatMessage(session_id=session_id, role="user", content=payload.content)
    db.add(user_msg)

    # Update session title if first message
    msg_count_res = await db.execute(select(models.ChatMessage).where(models.ChatMessage.session_id == session_id))
    if len(msg_count_res.scalars().all()) == 0:
        session.title = payload.content[:60]

    await db.commit()
    await db.refresh(user_msg)

    # Get all previous messages for context
    history_res = await db.execute(
        select(models.ChatMessage).where(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.timestamp.asc())
    )
    history = [{"role": m.role, "content": m.content} for m in history_res.scalars().all()]

    # Call OpenAI
    api_key, model = await get_openai_config(db)
    if not api_key:
        ai_reply = "⚠️ OpenAI API key not configured. Please go to Settings → Model to add your API key."
    else:
        try:
            client = openai.AsyncOpenAI(api_key=api_key)
            import json
            import re
            from sqlalchemy import text
            
            schema_info = """
Table: email_tickets
Columns:
- id (INTEGER, primary key)
- message_id (VARCHAR, email message id)
- sender_email (VARCHAR)
- subject (VARCHAR)
- body (TEXT)
- received_at (DATETIME)
- status (VARCHAR: 'pending', 'resolved', 'escalated', 'blocked')
- priority (VARCHAR: 'low', 'medium', 'high', 'critical')
- severity (VARCHAR: 'low', 'medium', 'high', 'critical')
- confidence_score (FLOAT: 0.0 to 1.0)
- generated_response (TEXT)
- reply_sent (BOOLEAN)
- processed_at (DATETIME)
"""
            system_prompt = (
                "You are a professional AI technical support assistant and data analyst representing the Support Team. "
                "You have access to a tool 'query_email_tickets' to run SQL queries against the database. "
                f"The database schema is:\n{schema_info}\n"
                "When a user asks for analytics, metrics, or specific ticket details, write a SQL query to fetch the data using the tool. "
                "Limit the number of rows if appropriate. "
                "Always sign off your final responses exactly as: 'Best regards,\\n\\nSupport Team'."
            )
            
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "query_email_tickets",
                        "description": "Execute a SQL SELECT query to retrieve data from the email_tickets table.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "sql_query": {
                                    "type": "string",
                                    "description": "The raw SQL SELECT query (e.g. SELECT count(*) FROM email_tickets WHERE status='escalated')"
                                }
                            },
                            "required": ["sql_query"]
                        }
                    }
                }
            ]
            
            messages = [{"role": "system", "content": system_prompt}] + history
            
            max_retries = 6  # 1 initial call + up to 5 retries
            
            for attempt in range(max_retries):
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=tools,
                    temperature=0.4,
                )
                
                message = response.choices[0].message
                
                if message.tool_calls:
                    messages.append(message)
                    
                    for tool_call in message.tool_calls:
                        if tool_call.function.name == "query_email_tickets":
                            # Default empty args string if missing
                            args_str = tool_call.function.arguments or "{}"
                            try:
                                args = json.loads(args_str)
                            except json.JSONDecodeError:
                                args = {}
                            
                            query = args.get("sql_query", "")
                            
                            # Security and enforcement
                            if not query.strip().upper().startswith("SELECT"):
                                query_result = "Error: Only SELECT queries are allowed. Please fix your query."
                            else:
                                # Use regex to force table name to email_tickets
                                safe_query = re.sub(r'(?i)\bFROM\s+([a-zA-Z0-9_]+)\b', 'FROM email_tickets', query)
                                safe_query = re.sub(r'(?i)\bJOIN\s+([a-zA-Z0-9_]+)\b', 'JOIN email_tickets', safe_query)
                                
                                try:
                                    result = await db.execute(text(safe_query))
                                    mappings = result.mappings().all()
                                    dict_rows = [dict(m) for m in mappings]
                                    query_result = json.dumps(dict_rows, default=str)
                                except Exception as db_err:
                                    query_result = f"Database Error: {str(db_err)}. Please analyze the error, fix your SQL syntax, and try again."
                            
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tool_call.id,
                                "name": tool_call.function.name,
                                "content": query_result
                            })
                    
                    # Continue the loop so the LLM receives the tool response (and potential errors) to retry
                    continue
                else:
                    # LLM returned a final text response without calling tools
                    ai_reply = message.content
                    break
            else:
                # If we exhausted all 6 iterations
                ai_reply = "⚠️ I encountered too many database errors and could not complete the query. Please refine your request."
            
        except Exception as e:
            ai_reply = f"⚠️ AI Error: {str(e)}"

    # Save AI response
    ai_msg = models.ChatMessage(session_id=session_id, role="assistant", content=ai_reply)
    session.updated_at = datetime.utcnow()
    db.add(ai_msg)
    await db.commit()
    await db.refresh(ai_msg)
    return ai_msg
