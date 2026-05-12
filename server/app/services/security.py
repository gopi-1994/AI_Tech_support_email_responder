from typing import Tuple, Optional
import re
import logging

logger = logging.getLogger(__name__)

# Basic heuristics for demonstration purposes
SPAM_KEYWORDS = ["lottery", "winner", "cash prize", "buy now", "click below", "viagra", "crypto", "investment"]
PHISHING_KEYWORDS = ["verify your account", "update your password", "unauthorized login", "urgent action required"]
PROMPT_INJECTION_KEYWORDS = ["ignore previous", "system prompt", "disregard instructions", "you are now", "act as", "forget everything"]

def analyze_email_security(sender: str, subject: str, body: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Analyzes an email for security risks.
    Returns:
        is_safe (bool): True if no issues detected
        flag_type (str | None): Type of issue ("spam", "phishing", "prompt_injection") or None
        detail (str | None): Details about the detection or None
    """
    content = f"{subject} {body}".lower()

    # 1. Check for prompt injection first (most critical for LLM)
    for pi_phrase in PROMPT_INJECTION_KEYWORDS:
        if pi_phrase in content:
            logger.warning(f"Prompt injection detected from {sender}")
            return False, "prompt_injection", f"Detected phrase: '{pi_phrase}'"
            
    # 2. Check for phishing
    for phish_phrase in PHISHING_KEYWORDS:
        if phish_phrase in content:
            logger.warning(f"Phishing detected from {sender}")
            return False, "phishing", f"Detected phrase: '{phish_phrase}'"
            
    # 3. Check for spam
    spam_count = sum(1 for word in SPAM_KEYWORDS if word in content)
    if spam_count >= 2:
        logger.warning(f"Spam detected from {sender}")
        return False, "spam", f"Detected {spam_count} spam keywords"

    return True, None, None
