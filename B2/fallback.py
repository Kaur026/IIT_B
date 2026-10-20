"""BE2 F6 never-blocked workflow fallback for synthetic demos.

A fallback must not bypass authentication or silently change clinical state.
It records a safe handoff to an approved manual process while preserving the
fact that the automated workflow is unavailable.
"""

from uuid import uuid4

from B2.demo_clock import DateLike, parse_date


class FallbackError(ValueError):
    """Raised when a fallback record cannot be safely constructed."""


SAFE_NEXT_ACTIONS = {
    "authentication_failed": (
        "Protected records remain unavailable. Use the approved manual process "
        "and notify the responsible supervisor; do not share credentials."
    ),
    "offline": (
        "Keep the synthetic task in the local pending queue and use the approved "
        "manual process until synchronization is available."
    ),
    "service_unavailable": (
        "Record the pending action locally and notify the responsible supervisor "
        "through the approved channel."
    ),
    "unknown": (
        "Do not discard the task. Use the approved manual process and ask a "
        "supervisor to review the failure."
    ),
}


def create_fallback_record(
    child_id: str,
    source_stage: str,
    reason_code: str,
    on: DateLike,
    assigned_worker_id: str = "",
    task_id: str = "",
    error_reference: str = "",
    fallback_id: str = "",
):
    """Create a JSON-safe manual/offline fallback record without PHI or secrets."""
    if not isinstance(child_id, str) or not child_id.strip():
        raise FallbackError("child_id is required.")
    if not isinstance(source_stage, str) or not source_stage.strip():
        raise FallbackError("source_stage is required.")
    code = str(reason_code or "unknown").strip().lower()
    if code not in SAFE_NEXT_ACTIONS:
        code = "unknown"
    worker = assigned_worker_id.strip() if isinstance(assigned_worker_id, str) else ""
    task = task_id.strip() if isinstance(task_id, str) else ""
    # Store a short opaque reference only. Never put stack traces, tokens, or
    # uploaded sensitive content into a fallback record.
    ref = error_reference.strip()[:80] if isinstance(error_reference, str) else ""

    identifier = fallback_id.strip() if isinstance(fallback_id, str) else ""
    return {
        "fallback_id": identifier or str(uuid4()),
        "child_id": child_id.strip(),
        "task_id": task,
        "assigned_worker_id": worker or None,
        "source_stage": source_stage.strip(),
        "reason_code": code,
        "created_at": parse_date(on).isoformat(),
        "state": "manual_action_pending",
        "automated_action_allowed": False,
        "protected_data_access_allowed": False,
        "next_action": SAFE_NEXT_ACTIONS[code],
        "error_reference": ref,
        "label": "SYNTHETIC / PROPOSED INTEGRATION",
    }


def can_continue_safely(record: dict) -> bool:
    """True means a manual fallback is offered, not that protected access is granted."""
    if not isinstance(record, dict):
        raise FallbackError("fallback record must be a dictionary.")
    return (
        record.get("state") == "manual_action_pending"
        and record.get("automated_action_allowed") is False
        and record.get("protected_data_access_allowed") is False
    )


def mark_fallback_action(record: dict, actor_id: str, on: DateLike, action: str):
    """Record that a manual fallback was acknowledged; no protected action occurs."""
    if not isinstance(record, dict):
        raise FallbackError("fallback record must be a dictionary.")
    if not isinstance(actor_id, str) or not actor_id.strip():
        raise FallbackError("actor_id is required.")
    if record.get("state") != "manual_action_pending":
        raise FallbackError("fallback record is not pending manual action.")
    if not isinstance(action, str) or not action.strip():
        raise FallbackError("action description is required.")
    updated = dict(record)
    updated["state"] = "manual_action_recorded"
    updated["manual_action"] = action.strip()
    updated["acted_by"] = actor_id.strip()
    updated["acted_at"] = parse_date(on).isoformat()
    return updated
