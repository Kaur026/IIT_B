"""BE2 F10 append-only audit and consent records for synthetic prototype data.

This is an in-memory JSON-compatible model, not durable or compliant storage.
Do not store real patient information, credentials, access tokens, or free-text
clinical narratives here. Production requires a reviewed database, access
controls, retention policy, and locally applicable consent/privacy review.
"""

from copy import deepcopy
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date


CONSENT_STATUSES = ("granted", "declined", "withdrawn", "not_obtained")
CONSENT_METHODS = ("in_person", "phone", "written", "other", "unknown")


class AuditRecordError(ValueError):
    """Raised for invalid audit or consent records."""


def _required(value, field):
    if not isinstance(value, str) or not value.strip():
        raise AuditRecordError(f"{field} is required.")
    return value.strip()


def append_event(
    log: list,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    on: DateLike,
    details: dict = None,
    event_id: str = "",
):
    """Return a new event list with one event appended; never mutate input."""
    if not isinstance(log, list):
        raise AuditRecordError("log must be a list.")
    actor = _required(actor_id, "actor_id")
    action_value = _required(action, "action")
    kind = _required(entity_type, "entity_type")
    entity = _required(entity_id, "entity_id")
    if details is not None and not isinstance(details, dict):
        raise AuditRecordError("details must be a dictionary.")
    new_log = deepcopy(log)
    identifier = event_id.strip() if isinstance(event_id, str) else ""
    if identifier and any(item.get("event_id") == identifier for item in new_log if isinstance(item, dict)):
        raise AuditRecordError("event_id already exists in the audit log.")
    new_log.append({
        "event_id": identifier or str(uuid4()),
        "actor_id": actor,
        "action": action_value,
        "entity_type": kind,
        "entity_id": entity,
        "at": parse_date(on).isoformat(),
        "details": deepcopy(details or {}),
        "label": "SYNTHETIC / PROPOSED INTEGRATION",
    })
    return new_log


def create_consent_record(
    subject_id: str,
    recorded_by: str,
    purpose: str,
    status: str,
    on: DateLike,
    method: str = "unknown",
    notes: str = "",
    consent_id: str = "",
):
    """Create a consent record; this records a choice but does not certify legality."""
    subject = _required(subject_id, "subject_id")
    actor = _required(recorded_by, "recorded_by")
    purpose_value = _required(purpose, "purpose")
    status_value = str(status or "").strip().lower()
    if status_value not in CONSENT_STATUSES:
        raise AuditRecordError("status must be one of CONSENT_STATUSES.")
    method_value = str(method or "unknown").strip().lower()
    if method_value not in CONSENT_METHODS:
        raise AuditRecordError("method must be one of CONSENT_METHODS.")
    note_value = str(notes or "").strip()
    if method_value == "other" and not note_value:
        raise AuditRecordError("notes are required when method is 'other'.")
    identifier = consent_id.strip() if isinstance(consent_id, str) else ""
    recorded_at = parse_date(on).isoformat()
    event = {
        "event_id": str(uuid4()),
        "action": "consent_recorded",
        "actor_id": actor,
        "at": recorded_at,
        "from_status": None,
        "to_status": status_value,
        "method": method_value,
        "purpose": purpose_value,
        "notes": note_value,
    }
    return {
        "consent_id": identifier or str(uuid4()),
        "subject_id": subject,
        "current_status": status_value,
        "purpose": purpose_value,
        "events": [event],
        "label": "SYNTHETIC / PROPOSED INTEGRATION",
    }


def change_consent_status(record: dict, recorded_by: str, new_status: str, on: DateLike, reason: str):
    """Append a consent status change; prior events are preserved unchanged."""
    if not isinstance(record, dict):
        raise AuditRecordError("consent record must be a dictionary.")
    updated = deepcopy(record)
    if not isinstance(updated.get("events"), list):
        raise AuditRecordError("consent events must be a list.")
    actor = _required(recorded_by, "recorded_by")
    reason_value = _required(reason, "reason")
    status_value = str(new_status or "").strip().lower()
    if status_value not in CONSENT_STATUSES:
        raise AuditRecordError("new_status must be one of CONSENT_STATUSES.")
    old_status = updated.get("current_status")
    if old_status not in CONSENT_STATUSES:
        raise AuditRecordError("consent record has an invalid current_status.")
    if status_value == old_status:
        raise AuditRecordError("new_status must differ from current_status.")
    updated["events"].append({
        "event_id": str(uuid4()),
        "action": "consent_status_changed",
        "actor_id": actor,
        "at": parse_date(on).isoformat(),
        "from_status": old_status,
        "to_status": status_value,
        "reason": reason_value,
    })
    updated["current_status"] = status_value
    return updated


def audit_consent_change(log: list, consent_record: dict, on: DateLike):
    """Append the latest consent event to the generic audit stream."""
    if not isinstance(consent_record, dict) or not consent_record.get("events"):
        raise AuditRecordError("consent_record must contain at least one event.")
    event = consent_record["events"][-1]
    return append_event(
        log,
        actor_id=event["actor_id"],
        action=event["action"],
        entity_type="consent",
        entity_id=consent_record["consent_id"],
        on=on,
        details={
            "subject_id": consent_record["subject_id"],
            "from_status": event.get("from_status"),
            "to_status": event.get("to_status"),
        },
    )
