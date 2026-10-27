"""BE2 F4 task and escalation workflow (synthetic prototype only).

This module is framework-independent and uses dictionaries so FE1 can consume
its results without a database or web framework. Persistence, role mapping,
referrals, audit/consent storage, and offline sync are separate BE2 steps.

The day-0/2/5/10 escalation ladder comes from Member 3's handoff and is marked
as a placeholder to be replaced after field validation. It is not clinical
advice and must not be represented as an approved service policy.
"""

from copy import deepcopy
from datetime import timedelta
from typing import Optional
from uuid import uuid4

from B2.demo_clock import DEFAULT_DEMO_DATE, DateLike, parse_date


TASK_STATUSES = ("open", "assigned", "assigned", "acknowledged", "in_progress", "in_progress", "escalated", "closed")
OUTCOME_OPTIONS = (
    "reached",
    "not_reached",
    "referred",
    "recheck_required",
    "no_action_needed",
    "other",
)

# PROPOSED / SYNTHETIC workflow placeholders from the Member 3 handoff.
# Offsets are relative to task creation, not claims about real-world standards.
ESCALATION_LADDER = (
    {"level": 0, "role": "worker", "after_days": 0},
    {"level": 1, "role": "supervisor", "after_days": 2},
    {"level": 2, "role": "anm_block", "after_days": 5},
    {"level": 3, "role": "district", "after_days": 10},
)


class TaskActionError(ValueError):
    """Raised when a task action violates the prototype state machine."""


def _required_text(value, name):
    if not isinstance(value, str) or not value.strip():
        raise TaskActionError(f"{name} is required.")
    return value.strip()


def _copy_task(task):
    if not isinstance(task, dict):
        raise TaskActionError("task must be a dictionary.")
    copied = deepcopy(task)
    if copied.get("status") not in TASK_STATUSES:
        raise TaskActionError("task has an unknown status.")
    if not isinstance(copied.get("events"), list):
        raise TaskActionError("task events must be a list.")
    return copied


def _record(task, event, actor_id, on, details=None):
    task["events"].append({
        "event": event,
        "actor_id": actor_id,
        "at": parse_date(on).isoformat(),
        "details": details or {},
    })


def create_task(
    child_row: dict,
    evaluation: dict,
    created_on: Optional[DateLike] = None,
    task_id: Optional[str] = None,
):
    """Create an open task from a BE1 evaluation.

    GREEN cases do not create an action task and return None. RED, AMBER, and
    GREY cases do. GREY creates a recheck task; it is not treated as a clinical
    finding. Child A (C0001) is the shared BE1 handoff case.
    """
    if not isinstance(child_row, dict) or not isinstance(evaluation, dict):
        raise TaskActionError("child_row and evaluation must be dictionaries.")

    child_id = _required_text(child_row.get("child_id"), "child_id")
    colour = str(evaluation.get("colour", "")).strip().upper()
    if colour not in {"RED", "AMBER", "GREEN", "GREY"}:
        raise TaskActionError("evaluation colour must be RED, AMBER, GREEN, or GREY.")
    if colour == "GREEN":
        return None

    created = parse_date(created_on) if created_on is not None else DEFAULT_DEMO_DATE
    raw_worker = child_row.get("assigned_worker_id")
    worker_id = str(raw_worker).strip() if raw_worker is not None else ""
    owner_id = worker_id or None
    owner_role = "worker" if owner_id else "unassigned"

    alert_level = {"RED": "urgent", "AMBER": "watch", "GREY": "recheck"}[colour]
    first_escalation_date = created + timedelta(days=ESCALATION_LADDER[1]["after_days"])
    reasons = evaluation.get("reasons", [])
    if not isinstance(reasons, list):
        reasons = []

    task = {
        "task_id": task_id or str(uuid4()),
        "child_id": child_id,
        "alert_level": alert_level,
        "colour": colour,
        "status": "open",
        "owner_id": owner_id,
        "owner_role": owner_role,
        "created_on": created.isoformat(),
        "due_on": first_escalation_date.isoformat(),
        "escalation_level": 0,
        "outcome": None,
        "outcome_notes": "",
        "reasons": deepcopy(reasons),
        "events": [],
        "policy_label": "PROPOSED PLACEHOLDER — synthetic demo only",
    }
    _record(
        task,
        "created",
        "system",
        created,
        {"colour": colour, "owner_id": owner_id, "alert_level": alert_level},
    )
    return task


def acknowledge_task(task: dict, actor_id: str, on: DateLike):
    """Acknowledge a task that is open or has been escalated."""
    updated = _copy_task(task)
    actor = _required_text(actor_id, "actor_id")
    if updated["status"] not in {"open", "escalated"}:
        raise TaskActionError("Only open or escalated tasks can be acknowledged.")
    previous = updated["status"]
    updated["status"] = "acknowledged"
    _record(updated, "acknowledged", actor, on, {"previous_status": previous})
    return updated


def reassign_task(task: dict, actor_id: str, new_owner_id: str, on: DateLike, reason: str):
    """Reassign a non-closed task and retain who changed ownership and why."""
    updated = _copy_task(task)
    actor = _required_text(actor_id, "actor_id")
    target = _required_text(new_owner_id, "new_owner_id")
    reason_text = _required_text(reason, "reason")
    if updated["status"] == "closed":
        raise TaskActionError("Closed tasks cannot be reassigned.")
    old_owner = updated.get("owner_id")
    updated["owner_id"] = target
    # Role mapping is supplied by the separate F7 module; do not guess a role here.
    _record(
        updated,
        "reassigned",
        actor,
        on,
        {"from_owner_id": old_owner, "to_owner_id": target, "reason": reason_text},
    )
    return updated


def get_escalation_due(task: dict, on: DateLike):
    """Return the next due escalation descriptor, or None if not due/closed."""
    updated = _copy_task(task)
    if updated["status"] == "closed":
        return None
    try:
        level = int(updated.get("escalation_level", 0))
        created = parse_date(updated["created_on"])
    except (TypeError, KeyError, ValueError) as exc:
        raise TaskActionError("task has invalid escalation metadata.") from exc
    if level < 0 or level >= len(ESCALATION_LADDER):
        raise TaskActionError("task has invalid escalation level.")
    next_level = level + 1
    if next_level >= len(ESCALATION_LADDER):
        return None

    step = ESCALATION_LADDER[next_level]
    due_date = created + timedelta(days=step["after_days"])
    today = parse_date(on)
    if today < due_date:
        return None
    return {
        "level": step["level"],
        "role": step["role"],
        "due_on": due_date.isoformat(),
        "days_overdue": (today - due_date).days,
        "policy_label": "PROPOSED PLACEHOLDER — synthetic demo only",
    }


def escalate_task(task: dict, actor_id: str, target_owner_id: str, on: DateLike, reason: str):
    """Escalate to the next scheduled role, requiring a real target ID.

    A target user cannot be guessed: FE/team integration must provide it. This
    protects against silently assigning a case to a made-up account.
    """
    updated = _copy_task(task)
    actor = _required_text(actor_id, "actor_id")
    target = _required_text(target_owner_id, "target_owner_id")
    reason_text = _required_text(reason, "reason")
    due = get_escalation_due(updated, on)
    if due is None:
        raise TaskActionError("No escalation is due for this task today.")

    previous_owner = updated.get("owner_id")
    previous_status = updated["status"]
    updated["owner_id"] = target
    updated["owner_role"] = due["role"]
    updated["escalation_level"] = due["level"]
    updated["status"] = "escalated"

    next_level = due["level"] + 1
    if next_level < len(ESCALATION_LADDER):
        due_on = parse_date(updated["created_on"]) + timedelta(
            days=ESCALATION_LADDER[next_level]["after_days"]
        )
        updated["due_on"] = due_on.isoformat()

    _record(
        updated,
        "escalated",
        actor,
        on,
        {
            "from_owner_id": previous_owner,
            "to_owner_id": target,
            "to_role": due["role"],
            "reason": reason_text,
            "previous_status": previous_status,
        },
    )
    return updated


def complete_task(task: dict, actor_id: str, outcome: str, on: DateLike, notes: str = ""):
    """Close a task only with a listed outcome; 'other' requires a note."""
    updated = _copy_task(task)
    actor = _required_text(actor_id, "actor_id")
    outcome_value = str(outcome).strip().lower()
    if outcome_value not in OUTCOME_OPTIONS:
        raise TaskActionError("Choose a valid outcome from OUTCOME_OPTIONS.")
    if updated["status"] == "closed":
        raise TaskActionError("Task is already closed.")
    notes_value = str(notes or "").strip()
    if outcome_value == "other" and not notes_value:
        raise TaskActionError("A note is required when outcome is 'other'.")

    updated["status"] = "closed"
    updated["outcome"] = outcome_value
    updated["outcome_notes"] = notes_value
    _record(
        updated,
        "closed",
        actor,
        on,
        {"outcome": outcome_value, "notes": notes_value},
    )
    return updated


def task_is_overdue(task: dict, on: DateLike) -> bool:
    """Whether an unclosed task has reached its current proposed due date."""
    updated = _copy_task(task)
    if updated["status"] == "closed":
        return False
    try:
        due_on = parse_date(updated["due_on"])
    except (KeyError, ValueError) as exc:
        raise TaskActionError("task has an invalid due_on date.") from exc
    return parse_date(on) >= due_on


def list_due_escalations(tasks: list, on: DateLike) -> list:
    """Return task IDs and next escalation targets due on a selected demo date."""
    if not isinstance(tasks, list):
        raise TaskActionError("tasks must be a list.")
    due = []
    for task in tasks:
        descriptor = get_escalation_due(task, on)
        if descriptor is not None:
            due.append({"task_id": task["task_id"], "child_id": task["child_id"], **descriptor})
    return due


def apply_task_action(task: dict, action: str, actor_id: str, on: DateLike, **kwargs):
    """Apply one explicit Day-1 task-state transition.

    The API layer must authorize the actor and centre before calling this
    function. This state machine records each action; it never makes clinical
    decisions. Two-key closure is added in the later closure feature.
    """
    updated = _copy_task(task)
    action_value = _required_text(action, "action").lower()
    actor = _required_text(actor_id, "actor_id")

    if action_value == "assign":
        if updated["status"] != "open":
            raise TaskActionError("Only open tasks can be assigned.")
        owner = _required_text(kwargs.get("owner_id"), "owner_id")
        updated["owner_id"] = owner
        updated["owner_role"] = str(kwargs.get("owner_role") or "worker").strip()
        updated["status"] = "assigned"
        _record(updated, "assigned", actor, on, {"owner_id": owner, "owner_role": updated["owner_role"]})
        return updated

    if action_value == "acknowledge":
        if updated["status"] != "assigned":
            raise TaskActionError("Only assigned tasks can be acknowledged.")
        updated["status"] = "acknowledged"
        _record(updated, "acknowledged", actor, on, {"owner_id": updated.get("owner_id")})
        return updated

    if action_value == "start":
        if updated["status"] != "acknowledged":
            raise TaskActionError("Only acknowledged tasks can move in progress.")
        updated["status"] = "in_progress"
        _record(updated, "in_progress", actor, on)
        return updated

    if action_value == "reassign":
        if updated["status"] not in {"assigned", "acknowledged", "in_progress", "escalated"}:
            raise TaskActionError("Only active assigned tasks can be reassigned.")
        return reassign_task(
            updated,
            actor,
            kwargs.get("owner_id"),
            on,
            kwargs.get("reason", ""),
        )

    if action_value == "close":
        if updated["status"] != "in_progress":
            raise TaskActionError("Task must be in progress before it can be closed.")
        return complete_task(
            updated,
            actor,
            kwargs.get("outcome", ""),
            on,
            kwargs.get("notes", ""),
        )

    if action_value == "escalate":
        if updated["status"] not in {"open", "assigned", "acknowledged", "in_progress"}:
            raise TaskActionError("Task cannot be escalated from its current state.")
        return escalate_task(
            updated,
            actor,
            kwargs.get("owner_id", ""),
            on,
            kwargs.get("reason", ""),
        )

    raise TaskActionError("Unknown task action.")


def apply_task_action(task: dict, action: str, actor_id: str, on: DateLike, **kwargs):
    """Apply one explicit Day-1 task-state transition.

    The API layer must authorize the actor and centre before calling this
    function. This state machine records each action; it never makes clinical
    decisions. Closing requires an explicit closure_verified marker from the
    two-key closure service; public API callers cannot supply that marker.
    """
    updated = _copy_task(task)
    action_value = _required_text(action, "action").lower()
    actor = _required_text(actor_id, "actor_id")

    if action_value == "assign":
        if updated["status"] != "open":
            raise TaskActionError("Only open tasks can be assigned.")
        owner = _required_text(kwargs.get("owner_id"), "owner_id")
        updated["owner_id"] = owner
        updated["owner_role"] = str(kwargs.get("owner_role") or "worker").strip()
        updated["status"] = "assigned"
        _record(updated, "assigned", actor, on, {"owner_id": owner, "owner_role": updated["owner_role"]})
        return updated

    if action_value == "acknowledge":
        if updated["status"] not in {"assigned", "escalated"}:
            raise TaskActionError("Only assigned or escalated tasks can be acknowledged.")
        previous = updated["status"]
        updated["status"] = "acknowledged"
        _record(updated, "acknowledged", actor, on, {"owner_id": updated.get("owner_id"), "previous_status": previous})
        return updated

    if action_value == "start":
        if updated["status"] != "acknowledged":
            raise TaskActionError("Only acknowledged tasks can move in progress.")
        updated["status"] = "in_progress"
        _record(updated, "in_progress", actor, on)
        return updated

    if action_value == "reassign":
        if updated["status"] not in {"assigned", "acknowledged", "in_progress", "escalated"}:
            raise TaskActionError("Only active assigned tasks can be reassigned.")
        return reassign_task(
            updated,
            actor,
            kwargs.get("owner_id"),
            on,
            kwargs.get("reason", ""),
        )

    if action_value == "record_progress":
        if updated["status"] != "in_progress":
            raise TaskActionError("Progress can be recorded only while a task is in progress.")
        note = _required_text(kwargs.get("notes"), "notes")
        progress = updated.setdefault("progress_notes", [])
        if not isinstance(progress, list):
            raise TaskActionError("task progress_notes must be a list.")
        progress.append({"actor_id": actor, "at": parse_date(on).isoformat(), "note": note})
        _record(updated, "progress_recorded", actor, on, {"note": note})
        return updated

    if action_value == "close":
        if kwargs.get("closure_verified") is not True:
            raise TaskActionError("Two-key closure service confirmation is required.")
        if updated["status"] != "in_progress":
            raise TaskActionError("Task must be in progress before it can be closed.")
        return complete_task(
            updated,
            actor,
            kwargs.get("outcome", ""),
            on,
            kwargs.get("notes", ""),
        )

    if action_value == "escalate":
        if updated["status"] not in {"open", "assigned", "acknowledged", "in_progress"}:
            raise TaskActionError("Task cannot be escalated from its current state.")
        return escalate_task(
            updated,
            actor,
            kwargs.get("owner_id", ""),
            on,
            kwargs.get("reason", ""),
        )

    raise TaskActionError("Unknown task action.")
