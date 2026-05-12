"""
Knowledge retrieval service using Microsoft Copilot Retrieval API (Graph API).
Falls back to local keyword search if Copilot is not configured.
"""

import logging
import json
import time
import hashlib
import base64
import secrets
from pathlib import Path
from typing import Optional, Dict, Any, List
from urllib.parse import urlencode, quote

import httpx
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import SystemConfig

logger = logging.getLogger(__name__)

# Local fallback knowledge base
FALLBACK_KNOWLEDGE = {
    "password": (
        "To reset your password, visit https://account.company.com/reset. "
        "Our support team cannot reset passwords manually due to security policies."
    ),
    "vpn": (
        "If you are having VPN connection issues, ensure you are using the latest version "
        "of Cisco AnyConnect. Disconnect, restart your PC, then reconnect using vpn.company.com."
    ),
    "printer": (
        "To add a network printer, go to 'Printers & scanners' in Windows Settings, "
        "click 'Add device', and search for 'Office-MFP'."
    ),
    "software": (
        "Software installation requests require manager approval. "
        "Please submit a request via the IT Self-Service Portal."
    ),
}


# ---------------------------------------------------------------------------
# Token helpers (Authorization Code + PKCE flow, stored in SystemConfig DB)
# ---------------------------------------------------------------------------

class _CopilotTokenManager:
    """
    Lightweight token manager that persists Copilot OAuth tokens in the
    SystemConfig database table instead of a flat JSON file, so it integrates
    cleanly with the rest of the backend.
    """

    AUTHORIZE_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    SCOPES = [
        "https://graph.microsoft.com/Files.Read.All",
        "https://graph.microsoft.com/Sites.Read.All",
        "offline_access",
    ]

    def __init__(self, tenant_id: str, client_id: str, client_secret: Optional[str] = None,
                 redirect_uri: str = "http://localhost:8111/api/settings/copilot/callback"):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self._pkce_verifier: Optional[str] = None

    # ---- PKCE helpers ----

    def _generate_pkce(self):
        code_verifier = secrets.token_urlsafe(64)[:128]
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode()).digest()
        ).decode().rstrip("=")
        return code_verifier, code_challenge

    def get_authorization_url(self) -> Dict[str, str]:
        self._pkce_verifier, code_challenge = self._generate_pkce()
        state = secrets.token_urlsafe(32)
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.SCOPES),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "response_mode": "query",
        }
        auth_url = self.AUTHORIZE_URL.format(tenant_id=self.tenant_id)
        return {
            "authorization_url": f"{auth_url}?{urlencode(params)}",
            "code_verifier": self._pkce_verifier,
            "state": state,
        }

    # ---- Token exchange / refresh ----

    async def exchange_code(self, code: str, code_verifier: str) -> None:
        token_url = self.TOKEN_URL.format(tenant_id=self.tenant_id)
        data = {
            "client_id": self.client_id,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "code_verifier": code_verifier,
            "scope": " ".join(self.SCOPES),
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url, data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if response.status_code != 200:
            err = response.json()
            raise Exception(f"Token exchange failed: {err.get('error_description', err.get('error'))}")

        token_data = response.json()
        expires_at = int(time.time()) + token_data.get("expires_in", 3600)
        await _save_config_keys({
            "copilot_access_token": token_data["access_token"],
            "copilot_refresh_token": token_data.get("refresh_token", ""),
            "copilot_expires_at": str(expires_at),
        })

    async def _do_refresh(self, refresh_token: str) -> str:
        token_url = self.TOKEN_URL.format(tenant_id=self.tenant_id)
        data = {
            "client_id": self.client_id,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": " ".join(self.SCOPES),
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url, data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if response.status_code != 200:
            err = response.json()
            raise Exception(f"Token refresh failed: {err.get('error_description', err.get('error'))}")

        token_data = response.json()
        expires_at = int(time.time()) + token_data.get("expires_in", 3600)
        new_refresh = token_data.get("refresh_token", refresh_token)
        await _save_config_keys({
            "copilot_access_token": token_data["access_token"],
            "copilot_refresh_token": new_refresh,
            "copilot_expires_at": str(expires_at),
        })
        return token_data["access_token"]

    async def get_valid_token(self) -> str:
        cfg = await _load_config_keys([
            "copilot_access_token", "copilot_refresh_token", "copilot_expires_at"
        ])
        access = cfg.get("copilot_access_token")
        expires_at = int(cfg.get("copilot_expires_at", "0") or "0")
        refresh = cfg.get("copilot_refresh_token")

        if not access:
            raise Exception(
                "Copilot token not configured. "
                "An admin must complete OAuth via the Admin → SharePoint settings page."
            )
        # Refresh if within 5-minute window
        if time.time() >= (expires_at - 300):
            if not refresh:
                raise Exception("Copilot token expired and no refresh token. Please re-authorize.")
            access = await self._do_refresh(refresh)
        return access


# ---------------------------------------------------------------------------
# DB helpers for SystemConfig key-value pairs
# ---------------------------------------------------------------------------

async def _load_config_keys(keys: List[str]) -> Dict[str, Optional[str]]:
    result: Dict[str, Optional[str]] = {k: None for k in keys}
    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(SystemConfig).where(SystemConfig.key.in_(keys))
        )
        for row in rows.scalars():
            result[row.key] = row.value
    return result


async def _save_config_keys(mapping: Dict[str, str]) -> None:
    async with AsyncSessionLocal() as db:
        for key, value in mapping.items():
            existing = await db.scalar(
                select(SystemConfig).where(SystemConfig.key == key)
            )
            if existing:
                existing.value = value
            else:
                db.add(SystemConfig(key=key, value=value))
        await db.commit()


# ---------------------------------------------------------------------------
# Copilot Retrieval API call
# ---------------------------------------------------------------------------

COPILOT_RETRIEVAL_URL = "https://graph.microsoft.com/v1.0/copilot/retrieval"


async def _copilot_search(query: str, site_url: str, folder: str, access_token: str) -> Optional[str]:
    """
    Call the Microsoft Copilot Retrieval API and return the top relevant text, restricted to a specific folder.
    """
    clean_site = site_url.rstrip("/")
    encoded_folder = quote(folder.strip("/"), safe='')
    site_filter = f'path:"{clean_site}/Shared%20Documents/{encoded_folder}/"'
    body = {
        "queryString": query,
        "dataSource": "sharePoint",
        "filterExpression": site_filter,
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    logger.info(f"Copilot retrieval request: query='{query}', filter='{site_filter}'")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(COPILOT_RETRIEVAL_URL, json=body, headers=headers)

    if response.status_code != 200:
        error_text = response.text
        logger.error(f"Copilot API error: {response.status_code} - {error_text}")
        if response.status_code == 401:
            raise Exception("copilot_token_expired")
        if response.status_code == 403:
            raise Exception(
                "Access denied to Copilot Retrieval API. "
                "Ensure Files.Read.All and Sites.Read.All delegated permissions are granted."
            )
        raise Exception(f"Copilot API error {response.status_code}: {error_text[:300]}")

    data = response.json()
    hits = data.get("retrievalHits", [])
    
    logger.info(f"Copilot API 200 OK. Found {len(hits)} retrieval hits.")
    
    if not hits:
        return None

    # Collect all extracts sorted by relevance score
    extracts: List[Dict[str, Any]] = []
    for hit in hits:
        for extract in hit.get("extracts", []):
            text = extract.get("text", "").strip()
            score = extract.get("relevanceScore", 0)
            if text:
                extracts.append({"text": text, "score": score})

    extracts.sort(key=lambda x: x["score"], reverse=True)

    # Return top-3 extracts concatenated
    top_texts = [e["text"] for e in extracts[:3]]
    return "\n\n".join(top_texts) if top_texts else None


# ---------------------------------------------------------------------------
# Public API used by ai_agent.py
# ---------------------------------------------------------------------------

async def retrieve_knowledge(query: str) -> Optional[str]:
    """
    Retrieve relevant knowledge for an email query.

    Strategy:
      1. Load Copilot credentials from SystemConfig.
      2. Try Microsoft Copilot Retrieval API (best results, relevance-scored).
      3. On auth failure, attempt token refresh and retry once.
      4. Fall back to local keyword search if Copilot is not configured or fails.
    """
    logger.info(f"Knowledge retrieval for: {query[:60]}")

    # Load required config values
    cfg = await _load_config_keys([
        "copilot_tenant_id",
        "copilot_client_id",
        "copilot_client_secret",
        "sharepoint_site_url",
        "sharepoint_folder",
        "copilot_access_token",
        "copilot_refresh_token",
        "copilot_expires_at",
    ])

    tenant_id = cfg.get("copilot_tenant_id")
    client_id = cfg.get("copilot_client_id")
    client_secret = cfg.get("copilot_client_secret")
    site_url = cfg.get("sharepoint_site_url")
    folder = cfg.get("sharepoint_folder")

    if not all([tenant_id, client_id, site_url, folder]):
        logger.info("Copilot (or mandatory SharePoint folder) not fully configured – using local fallback knowledge.")
        return _local_fallback(query)

    try:
        manager = _CopilotTokenManager(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
        )
        token = await manager.get_valid_token()
        result = await _copilot_search(query, site_url, folder, token)

        if result:
            logger.info("Copilot retrieval succeeded.")
            return result

        logger.info("Copilot returned no results – using local fallback.")
        return _local_fallback(query)

    except Exception as exc:
        logger.warning(f"Copilot retrieval failed: {exc}. Falling back to local knowledge.")
        return _local_fallback(query)


def _local_fallback(query: str) -> Optional[str]:
    """Simple keyword-based local fallback search."""
    query_lower = query.lower()
    matches = [text for key, text in FALLBACK_KNOWLEDGE.items() if key in query_lower]
    return "\n".join(matches) if matches else None


# ---------------------------------------------------------------------------
# OAuth helpers exposed to the settings router
# ---------------------------------------------------------------------------

async def get_copilot_auth_url() -> Dict[str, str]:
    """
    Generate the OAuth authorization URL for an admin to complete Copilot setup.
    Called from the /api/settings/copilot/authorize endpoint.
    """
    cfg = await _load_config_keys(["copilot_tenant_id", "copilot_client_id", "copilot_client_secret"])
    tenant_id = cfg.get("copilot_tenant_id")
    client_id = cfg.get("copilot_client_id")
    client_secret = cfg.get("copilot_client_secret")

    if not tenant_id or not client_id:
        raise Exception("copilot_tenant_id and copilot_client_id must be saved in Admin settings first.")

    manager = _CopilotTokenManager(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
    url_info = manager.get_authorization_url()

    # Persist code_verifier temporarily so the callback can use it
    await _save_config_keys({"copilot_pkce_verifier": url_info["code_verifier"]})
    return url_info


async def complete_copilot_auth(code: str, code_verifier: Optional[str] = None) -> Dict[str, str]:
    """
    Exchange authorization code for tokens. Called from the callback endpoint.
    """
    cfg = await _load_config_keys([
        "copilot_tenant_id", "copilot_client_id", "copilot_client_secret", "copilot_pkce_verifier"
    ])
    tenant_id = cfg["copilot_tenant_id"]
    client_id = cfg["copilot_client_id"]
    client_secret = cfg.get("copilot_client_secret")
    verifier = code_verifier or cfg.get("copilot_pkce_verifier")

    if not verifier:
        raise Exception("PKCE code verifier not found. Please restart the authorization flow.")

    manager = _CopilotTokenManager(tenant_id=tenant_id, client_id=client_id, client_secret=client_secret)
    await manager.exchange_code(code, verifier)
    return {"status": "success", "message": "Copilot authorization complete. Tokens saved."}
