from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    support = "support"

class Priority(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"

class Severity(str, enum.Enum):
    low    = "low"
    medium = "medium"
    high   = "high"

class TicketStatus(str, enum.Enum):
    received   = "received"
    processing = "processing"
    resolved   = "resolved"
    escalated  = "escalated"
    blocked    = "blocked"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.support)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    session = relationship("ChatSession", back_populates="messages")

class SystemConfig(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class EmailTicket(Base):
    __tablename__ = "email_tickets"
    id = Column(Integer, primary_key=True, index=True)
    sender_email = Column(String(150))
    subject = Column(String(500))
    body = Column(Text)
    status = Column(SAEnum(TicketStatus), default=TicketStatus.received)
    priority = Column(SAEnum(Priority), default=Priority.medium)
    severity = Column(SAEnum(Severity), default=Severity.medium)
    confidence_score = Column(Float, nullable=True)
    generated_response = Column(Text, nullable=True)
    reply_sent = Column(Boolean, default=False)
    received_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

class SecurityLog(Base):
    __tablename__ = "security_logs"
    id = Column(Integer, primary_key=True, index=True)
    email_ticket_id = Column(Integer, ForeignKey("email_tickets.id"), nullable=True)
    flag_type = Column(String(50))  # spam, phishing, prompt_injection
    action_taken = Column(String(50))  # blocked, flagged
    detail = Column(Text, nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)
