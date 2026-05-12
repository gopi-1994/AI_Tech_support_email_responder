from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth_utils import verify_password, create_access_token, get_password_hash

router = APIRouter()

@router.post("/login", response_model=schemas.TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.username == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "username": user.username}

@router.post("/seed-admin")
async def seed_admin(db: AsyncSession = Depends(get_db)):
    """Create default admin if no users exist."""
    result = await db.execute(select(models.User))
    existing = result.scalars().all()
    if existing:
        raise HTTPException(status_code=400, detail="Users already exist")
    admin = models.User(
        username="admin",
        email="admin@secureai.local",
        password_hash=get_password_hash("admin123"),
        role=models.UserRole.admin,
    )
    db.add(admin)
    await db.commit()
    return {"message": "Default admin created. Username: admin | Password: admin123"}
