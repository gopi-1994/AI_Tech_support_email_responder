import os
import sys
import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import auth, users, settings, chat, emails

# Configure Date-Specific File Logging in Project Root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
log_dir = os.path.join(project_root, 'logs')
os.makedirs(log_dir, exist_ok=True)

today_str = datetime.now().strftime("%Y-%m-%d")
log_filename = os.path.join(log_dir, f"{today_str}.log")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
    handlers=[
        logging.FileHandler(log_filename, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

app = FastAPI(
    title="Secure AI Agent API",
    description="Automated Technical Support Email Processing using Microsoft Copilot Retrieval API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.email_monitor import fetch_emails

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup():
    await init_db()
    scheduler.add_job(fetch_emails, "interval", minutes=1)
    scheduler.start()

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(emails.router, prefix="/api/emails", tags=["Emails"])

@app.get("/")
async def root():
    return {"message": "Secure AI Agent API is running"}
