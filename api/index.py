"""Vercel serverless entrypoint for the B2 FastAPI prototype.

Vercel serves every /api/* request through this file (see vercel.json).
The B2 routes already live under /api, so the app is exported unchanged.

Vercel's filesystem is read-only except /tmp, so the SQLite prototype store
and the offline queue are pointed there. /tmp is ephemeral: data is synthetic
and is re-seeded on each cold start.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("B2_DB_PATH", "/tmp/b2-prototype.sqlite")
os.environ.setdefault("B2_OFFLINE_QUEUE_DIR", "/tmp/b2-offline")

from B2.api import app  # noqa: E402,F401
