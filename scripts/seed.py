import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../server')))
import asyncio
from app.database import AsyncSessionLocal, init_db
from app import models
from app.auth_utils import get_password_hash
from sqlalchemy import select

async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(models.User).where(models.User.username == "admin"))
        user = result.scalar_one_or_none()
        if not user:
            print("Creating admin user...")
            admin = models.User(
                username="admin",
                email="admin@secureai.local",
                password_hash=get_password_hash("admin123"),
                role=models.UserRole.admin,
                is_active=True
            )
            db.add(admin)
            await db.commit()
            print("Admin created successfully.")
        else:
            print("Admin already exists.")

if __name__ == "__main__":
    asyncio.run(seed())
