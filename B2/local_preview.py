"""Loopback-only launcher for the isolated prepared CSV preview.

This runner is deliberately separate from the normal ``uvicorn B2.api:app``
entry point. It binds only to 127.0.0.1 and isolates the prototype store in
memory before importing the API module.
"""

from __future__ import annotations

import os
import sys


_DEPLOYMENT_MARKERS = (
    "VERCEL", "RENDER", "RAILWAY_ENVIRONMENT", "DYNO", "K_SERVICE",
    "AWS_LAMBDA_FUNCTION_NAME", "CI",
)


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() not in {"", "false", "0", "no"}


def validate_local_preview_environment(environ) -> None:
    if str(environ.get("B2_PREPARED_PREVIEW_ENABLED", "")).strip().lower() != "true":
        raise RuntimeError("Set B2_PREPARED_PREVIEW_ENABLED=true explicitly for a local preview.")
    if str(environ.get("B2_ENV", "")).strip().lower() not in {"development", "local"}:
        raise RuntimeError("Prepared preview requires B2_ENV=development or local.")
    auth_mode = str(environ.get("B2_AUTH_MODE", "disabled")).strip().lower()
    if auth_mode != "disabled":
        raise RuntimeError("Prepared preview requires B2_AUTH_MODE=disabled; authentication settings are not changed by this runner.")
    if _truthy(environ.get("B2_PREPARED_ROWS_ENABLED")) or _truthy(environ.get("B2_PREPARED_SUMMARY_PUBLIC")):
        raise RuntimeError("Disable the existing prepared-row and public-summary gates before starting local preview.")
    active_markers = [name for name in _DEPLOYMENT_MARKERS if _truthy(environ.get(name))]
    if active_markers:
        raise RuntimeError("Prepared preview is prohibited in CI or deployed environments.")
    try:
        port = int(environ.get("B2_PREPARED_PREVIEW_PORT", "8000"))
    except (TypeError, ValueError) as exc:
        raise RuntimeError("B2_PREPARED_PREVIEW_PORT must be a valid local TCP port.") from exc
    if not 1 <= port <= 65535:
        raise RuntimeError("B2_PREPARED_PREVIEW_PORT must be a valid local TCP port.")


def main() -> None:
    try:
        validate_local_preview_environment(os.environ)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2) from exc

    # The module-level normal API app opens a prototype store on import. Keep
    # even that unrelated prototype isolated from the developer's SQLite file.
    os.environ["B2_DB_PATH"] = ":memory:"
    from B2.api import app
    import uvicorn

    if not app.state.prepared_preview_enabled:
        raise SystemExit("Prepared preview API refused its current environment.")
    port = int(os.environ.get("B2_PREPARED_PREVIEW_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, proxy_headers=False, reload=False)


if __name__ == "__main__":
    main()
