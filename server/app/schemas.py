from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str

# --- Users ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "support"

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

# --- Chat ---
class ChatSessionCreate(BaseModel):
    title: str = "New Chat"

class ChatSessionOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    content: str

class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime
    class Config:
        from_attributes = True

# --- Settings ---
class ConfigItem(BaseModel):
    key: str
    value: Optional[str] = None

class ConfigBulkUpdate(BaseModel):
    configs: List[ConfigItem]

class ConfigOut(BaseModel):
    key: str
    value: Optional[str]
    updated_at: datetime
    class Config:
        from_attributes = True

# --- Email Tickets ---
class EmailTicketOut(BaseModel):
    id: int
    sender_email: str
    subject: str
    body: Optional[str] = None
    status: str
    priority: Optional[str] = None
    severity: Optional[str] = None
    confidence_score: Optional[float] = None
    generated_response: Optional[str] = None
    reply_sent: bool = False
    received_at: datetime
    processed_at: Optional[datetime] = None
    class Config:
        from_attributes = True
