from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.auth_utils import require_admin, get_current_user
from typing import List
from datetime import datetime

router = APIRouter()

ALLOWED_KEYS = {
    "openai_api_key", "openai_model",
    "m365_tenant_id", "m365_client_id", "m365_client_secret", "m365_sharepoint_url",
    # Real Copilot retrieval keys (mapped to service)
    "copilot_tenant_id", "copilot_client_id", "copilot_client_secret", "sharepoint_site_url", "copilot_description", "sharepoint_folder",
    # IMAP inbound
    "imap_host", "imap_user", "imap_password", "imap_folder",
    # SMTP outbound
    "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from",
    "license_key", "confidence_threshold", "escalation_emails"
}

@router.get("/", response_model=List[schemas.ConfigOut])
async def get_all_settings(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(models.SystemConfig))
    return result.scalars().all()

@router.post("/")
async def update_settings(payload: schemas.ConfigBulkUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    for item in payload.configs:
        if item.key not in ALLOWED_KEYS:
            continue
        result = await db.execute(select(models.SystemConfig).where(models.SystemConfig.key == item.key))
        config = result.scalar_one_or_none()
        if config:
            config.value = item.value
            config.updated_at = datetime.utcnow()
        else:
            db.add(models.SystemConfig(key=item.key, value=item.value))
    await db.commit()
    return {"detail": "Settings updated"}

@router.get("/{key}")
async def get_setting(key: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(models.SystemConfig).where(models.SystemConfig.key == key))
    item = result.scalar_one_or_none()
    if not item:
        return {"key": key, "value": None}
    # Mask secret fields
    value = item.value
    if key in ("openai_api_key", "m365_client_secret", "copilot_client_secret", "imap_password", "smtp_password", "license_key"):
        value = "••••••••" if value else None
    return {"key": key, "value": value}

# ---------------------------------------------------------------------------
# Copilot OAuth endpoints
# ---------------------------------------------------------------------------

@router.get("/copilot/authorize")
async def copilot_authorize(_=Depends(require_admin)):
    """Generate OAuth authorization URL for Copilot API access."""
    from app.services.knowledge import get_copilot_auth_url
    try:
        info = await get_copilot_auth_url()
        return info
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/copilot/callback", response_class=HTMLResponse)
async def copilot_callback(request: Request):
    """
    OAuth callback – exchanges the code for tokens.
    Microsoft redirects the browser here after user consent.
    """
    from app.services.knowledge import complete_copilot_auth
    code = request.query_params.get("code")
    error = request.query_params.get("error")

    if error:
        return HTMLResponse(
            f"<h2>Authorization failed</h2><p>{request.query_params.get('error_description', error)}</p>",
            status_code=400
        )
    if not code:
        return HTMLResponse("<h2>Authorization failed</h2><p>No code received.</p>", status_code=400)

    try:
        await complete_copilot_auth(code)
        return HTMLResponse(
            "<h2>✅ Copilot Authorization Successful</h2>"
            "<p>You can close this tab and return to the application.</p>"
        )
    except Exception as exc:
        return HTMLResponse(f"<h2>Error</h2><p>{exc}</p>", status_code=500)


# ---------------------------------------------------------------------------
# IMAP test endpoint
# ---------------------------------------------------------------------------

@router.post("/test-imap")
async def test_imap_connection(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    """Try a live IMAP login using the currently saved credentials."""
    import asyncio
    from sqlalchemy import select as sa_select

    host = await db.scalar(sa_select(models.SystemConfig.value).where(models.SystemConfig.key == "imap_host"))
    user = await db.scalar(sa_select(models.SystemConfig.value).where(models.SystemConfig.key == "imap_user"))
    pwd  = await db.scalar(sa_select(models.SystemConfig.value).where(models.SystemConfig.key == "imap_password"))

    if not host or not user or not pwd:
        raise HTTPException(status_code=400, detail="IMAP credentials are not fully configured. Save them first.")

    def _try_login():
        from imap_tools import MailBox
        with MailBox(host).login(user, pwd, initial_folder='INBOX'):
            pass   # success if no exception

    try:
        await asyncio.to_thread(_try_login)
        return {"detail": f"Connected to {host} as {user} ✓"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"IMAP connection failed: {exc}")
