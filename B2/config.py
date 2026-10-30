"""Environment validation for a future trusted B2 deployment.

Validation checks presence and shape only. It does not create database
repositories or prove credentials, permissions, schema, or readiness.
"""
from dataclasses import dataclass
import os
from urllib.parse import urlsplit


class ConfigurationError(ValueError):
    """Raised when an explicitly selected auth mode lacks safe config."""


@dataclass(frozen=True)
class SupabaseBackendConfig:
    project_url: str
    publishable_key: str
    database_url: str
    operational_store_kind: str


def load_supabase_backend_config(environ=None) -> SupabaseBackendConfig:
    """Require provider and future storage settings without exposing values."""
    values = os.environ if environ is None else environ
    required = ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "B2_DATABASE_URL", "B2_OPERATIONAL_STORE_KIND")
    missing = [name for name in required if not str(values.get(name, "")).strip()]
    if missing:
        raise ConfigurationError("Missing required Supabase backend settings: " + ", ".join(missing))
    project_url = str(values["SUPABASE_URL"]).rstrip("/")
    parsed = urlsplit(project_url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.path or parsed.query
            or parsed.fragment or parsed.username or parsed.password):
        raise ConfigurationError("SUPABASE_URL must be an HTTPS project origin without credentials or path.")
    database_url = str(values["B2_DATABASE_URL"])
    db = urlsplit(database_url)
    if db.scheme not in {"postgres", "postgresql"} or not db.hostname or not db.path.strip("/"):
        raise ConfigurationError("B2_DATABASE_URL must be a PostgreSQL connection URL.")
    if str(values["B2_OPERATIONAL_STORE_KIND"]).strip().lower() != "postgresql":
        raise ConfigurationError("B2_OPERATIONAL_STORE_KIND must be postgresql for this configuration contract.")
    key = str(values["SUPABASE_PUBLISHABLE_KEY"]).strip()
    if len(key) < 8:
        raise ConfigurationError("SUPABASE_PUBLISHABLE_KEY is missing or malformed.")
    return SupabaseBackendConfig(project_url, key, database_url, "postgresql")
