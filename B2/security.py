"""Safety checks shared by the synthetic BE2 API.

These checks reduce accidental capture of identifiers/secrets in prototype
free-text/JSON fields. They are not a substitute for production data controls.
"""

import re


_FORBIDDEN_KEY = re.compile(r"(?:aadhaar|aadhar|otp|one.?time.?password)", re.IGNORECASE)
_LONG_DIGITS = re.compile(r"(?<!\d)\d{6,}(?!\d)")
_FORBIDDEN_TERMS = re.compile(r"\b(?:aadhaar|aadhar|otp|one.?time.?password)\b", re.IGNORECASE)


class UnsafePayloadError(ValueError):
    """Raised when input contains a prohibited identifier/secret field."""


def validate_no_sensitive_keys(value, path="payload"):
    """Recursively reject Aadhaar/OTP-like field names in a JSON payload."""
    if isinstance(value, dict):
        for key, child in value.items():
            if _FORBIDDEN_KEY.search(str(key)):
                raise UnsafePayloadError(f"Sensitive Aadhaar/OTP field is prohibited at {path}.")
            validate_no_sensitive_keys(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            validate_no_sensitive_keys(child, f"{path}[{index}]")


def validate_safe_json(value, path="payload"):
    """Reject prohibited identifiers/secrets in both JSON keys and string values."""
    validate_no_sensitive_keys(value, path)
    if isinstance(value, dict):
        for key, child in value.items():
            validate_safe_json(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            validate_safe_json(child, f"{path}[{index}]")
    elif isinstance(value, str):
        if _FORBIDDEN_TERMS.search(value) or _LONG_DIGITS.search(value):
            raise UnsafePayloadError(f"Sensitive identifier/OTP-like content is prohibited at {path}.")
    elif isinstance(value, int) and not isinstance(value, bool) and abs(value) >= 100000:
        raise UnsafePayloadError(f"Long numeric identifiers are prohibited at {path}.")


def safe_note(value, field="note", max_length=240):
    """Validate short workflow notes without permitting ID or OTP content."""
    text = str(value or "").strip()
    if len(text) > max_length:
        raise UnsafePayloadError(f"{field} must be {max_length} characters or fewer.")
    if _FORBIDDEN_TERMS.search(text) or _LONG_DIGITS.search(text):
        raise UnsafePayloadError(f"{field} must not contain Aadhaar/OTP terms or long numeric identifiers.")
    return text
