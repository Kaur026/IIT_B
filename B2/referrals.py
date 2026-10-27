"""BE2 F5 referral-loop prototype for synthetic cases.

Keeps referral issuance, outreach attempts, and service outcomes distinct.
It records whether contact was reached (and why not), supports a timeline and
reason counts, and offers non-clinical next-step suggestions. It does not make
clinical decisions or assert that a real referral service has been completed.
"""

from copy import deepcopy
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date


REFERRAL_STATUSES = ("none", "issued", "outcome_logged", "not_needed")
NO_CONTACT_REASONS = (
    "no_answer",
    "wrong_contact",
    "facility_closed",
    "transport_barrier",
    "declined",
    "other",
)
REFERRAL_OUTCOMES = (
    "attended",
    "not_attended",
    "facility_unavailable",
    "unknown",
    "other",
)


class ReferralError(ValueError):
    """Raised for invalid referral transitions or malformed referral data."""


def _required(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ReferralError(f"{field} is required.")
    return value.strip()


def _copy(referral):
    if not isinstance(referral, dict):
        raise ReferralError("referral must be a dictionary.")
    result = deepcopy(referral)
    if result.get("status") not in REFERRAL_STATUSES:
        raise ReferralError("referral has an unknown status.")
    if not isinstance(result.get("timeline"), list):
        raise ReferralError("referral timeline must be a list.")
    return result


def _event(referral, event, actor_id, on, details=None):
    referral["timeline"].append({
        "event": event,
        "actor_id": actor_id,
        "at": parse_date(on).isoformat(),
        "details": details or {},
    })


def issue_referral(
    child_id: str,
    issued_by: str,
    destination: str,
    reason: str,
    on: DateLike,
    task_id: str = "",
    referral_id: str = "",
):
    """Create an issued referral record with a traceable initial event."""
    child = _required(child_id, "child_id")
    actor = _required(issued_by, "issued_by")
    place = _required(destination, "destination")
    why = _required(reason, "reason")
    issued_on = parse_date(on).isoformat()
    record = {
        "referral_id": referral_id.strip() or str(uuid4()),
        "child_id": child,
        "task_id": task_id.strip() if isinstance(task_id, str) else "",
        "status": "issued",
        "destination": place,
        "reason": why,
        "issued_by": actor,
        "issued_on": issued_on,
        "reached": None,
        "last_contact_reason": None,
        "outcome": None,
        "outcome_notes": "",
        "timeline": [],
        "label": "SYNTHETIC / PROPOSED INTEGRATION",
    }
    _event(record, "referral_issued", actor, on, {"destination": place, "reason": why})
    return record


def record_contact_attempt(
    referral: dict,
    actor_id: str,
    on: DateLike,
    reached: bool,
    reason: str = "",
    notes: str = "",
):
    """Append a contact attempt; `reached` must be an explicit yes/no boolean."""
    updated = _copy(referral)
    actor = _required(actor_id, "actor_id")
    if updated["status"] != "issued":
        raise ReferralError("Contact attempts require an issued referral.")
    if not isinstance(reached, bool):
        raise ReferralError("reached must be True or False.")

    reason_value = str(reason or "").strip().lower()
    if reached is False and reason_value not in NO_CONTACT_REASONS:
        raise ReferralError("A valid reason is required when contact was not reached.")
    if reached is True and reason_value and reason_value not in NO_CONTACT_REASONS:
        raise ReferralError("Unknown contact reason.")

    note_value = str(notes or "").strip()
    if reason_value == "other" and not note_value:
        raise ReferralError("A note is required when the reason is 'other'.")

    updated["reached"] = reached
    updated["last_contact_reason"] = reason_value or None
    _event(
        updated,
        "contact_attempt",
        actor,
        on,
        {
            "reached": reached,
            "reason": reason_value or None,
            "notes": note_value,
        },
    )
    return updated


def log_referral_outcome(
    referral: dict,
    actor_id: str,
    outcome: str,
    on: DateLike,
    notes: str = "",
):
    """Record a service outcome after issue; never infer it from a contact call."""
    updated = _copy(referral)
    actor = _required(actor_id, "actor_id")
    value = str(outcome or "").strip().lower()
    if updated["status"] != "issued":
        raise ReferralError("Only issued referrals can receive an outcome.")
    if value not in REFERRAL_OUTCOMES:
        raise ReferralError("Choose a valid referral outcome.")
    note_value = str(notes or "").strip()
    if value == "other" and not note_value:
        raise ReferralError("A note is required for the 'other' outcome.")

    updated["status"] = "outcome_logged"
    updated["outcome"] = value
    updated["outcome_notes"] = note_value
    _event(updated, "outcome_logged", actor, on, {"outcome": value, "notes": note_value})
    return updated


def mark_not_needed(child_id: str, actor_id: str, on: DateLike, reason: str):
    """Record an explicit decision that referral is not needed, with a reason."""
    child = _required(child_id, "child_id")
    actor = _required(actor_id, "actor_id")
    why = _required(reason, "reason")
    record = {
        "referral_id": str(uuid4()),
        "child_id": child,
        "task_id": "",
        "status": "not_needed",
        "destination": "",
        "reason": why,
        "issued_by": actor,
        "issued_on": parse_date(on).isoformat(),
        "reached": None,
        "last_contact_reason": None,
        "outcome": None,
        "outcome_notes": "",
        "timeline": [],
        "label": "SYNTHETIC / PROPOSED INTEGRATION",
    }
    _event(record, "referral_not_needed", actor, on, {"reason": why})
    return record


def suggested_next_step(referral: dict) -> dict:
    """Return a neutral workflow suggestion; this is not clinical advice."""
    record = _copy(referral)
    if record["status"] == "outcome_logged":
        return {"code": "review_outcome", "text": "Review and record the next workflow action."}
    if record["status"] == "not_needed":
        return {"code": "no_referral_pending", "text": "No referral is pending; retain the documented reason."}
    if record["status"] == "none":
        return {"code": "confirm_referral_decision", "text": "Record whether a referral is needed under the approved workflow."}
    reason = record.get("last_contact_reason")
    if record.get("reached") is False:
        messages = {
            "no_answer": "Try the next approved contact method or record another attempt.",
            "wrong_contact": "Check the contact details through the approved process.",
            "facility_closed": "Confirm operating hours and arrange an approved follow-up.",
            "transport_barrier": "Record the barrier and notify the responsible supervisor.",
            "declined": "Record the response respectfully and follow the approved escalation process.",
            "other": "Review the recorded note and choose the next approved workflow step.",
        }
        return {"code": reason or "contact_not_reached", "text": messages.get(reason, "Record the contact result and follow the approved process.")}
    if record.get("reached") is True:
        return {"code": "follow_up_outcome", "text": "Record the referral service outcome when it is known."}
    return {"code": "contact_pending", "text": "Record a contact attempt or follow the approved workflow."}


def referral_summary(referrals: list) -> dict:
    """Count legacy referral records by status and no-contact reason."""
    if not isinstance(referrals, list):
        raise ReferralError("referrals must be a list.")
    statuses = {status: 0 for status in REFERRAL_STATUSES}
    reasons = {}
    for referral in referrals:
        record = _copy(referral)
        statuses[record["status"]] += 1
        reason = record.get("last_contact_reason")
        if reason:
            reasons[reason] = reasons.get(reason, 0) + 1
    return {"total": len(referrals), "by_status": statuses, "by_contact_reason": reasons}


# Revised generic/DEIC service-follow-up loop from the Oct 24 handoff. These
# workflow states are not a clinical eligibility or treatment determination.
FOLLOWUP_REFERRAL_KINDS = frozenset({"general", "deic"})
FOLLOWUP_REFERRAL_STATUSES = ("sent", "acknowledged", "attended", "outcome_recorded", "not_needed")
FOLLOWUP_REASON_CODES = frozenset({
    "case_follow_up", "verification_follow_up", "disability_service_follow_up",
    "service_follow_up", "other_approved_workflow",
})
FOLLOWUP_OUTCOME_CODES = frozenset({
    "service_contact_recorded", "appointment_recorded", "follow_up_requested",
    "facility_unavailable", "not_attended", "unknown", "other_workflow_outcome",
})


def create_followup_referral(beneficiary_id: str, centre_id: str, referral_kind: str,
                             destination: str, reason_code: str, actor_id: str,
                             on: DateLike, due_on: DateLike = None, task_id: str = ""):
    """Create a generic or DEIC referral with only coded, operational fields."""
    for key, value in (("beneficiary_id", beneficiary_id), ("centre_id", centre_id),
                       ("destination", destination), ("actor_id", actor_id)):
        if not isinstance(value, str) or not value.strip():
            raise ReferralError(f"{key} is required.")
    kind = str(referral_kind or "").strip().lower()
    reason = str(reason_code or "").strip().lower()
    if kind not in FOLLOWUP_REFERRAL_KINDS:
        raise ReferralError("referral_kind must be general or deic.")
    if reason not in FOLLOWUP_REASON_CODES:
        raise ReferralError("reason_code is not an approved workflow code.")
    created = parse_date(on).isoformat()
    due = parse_date(due_on).isoformat() if due_on is not None else ""
    record = {
        "referral_id": str(uuid4()), "beneficiary_id": beneficiary_id.strip(),
        "centre_id": centre_id.strip(), "task_id": str(task_id or "").strip(),
        "referral_kind": kind, "destination": destination.strip(),
        "reason_code": reason, "status": "sent", "created_at": created,
        "sent_by": actor_id.strip(), "due_on": due or None,
        "acknowledged_at": None, "attended_at": None,
        "outcome_code": None, "outcome_recorded_at": None,
        "timeline": [{"event": "sent", "actor_id": actor_id.strip(), "at": created}],
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
        "eligibility_decision": False,
    }
    return record


def update_followup_referral(record: dict, actor_id: str, action: str,
                             on: DateLike, outcome_code: str = ""):
    """Apply one monotonic referral state transition; never infer an outcome."""
    if not isinstance(record, dict) or record.get("status") not in FOLLOWUP_REFERRAL_STATUSES:
        raise ReferralError("Referral record has an invalid state.")
    if not isinstance(actor_id, str) or not actor_id.strip():
        raise ReferralError("actor_id is required.")
    verb = str(action or "").strip().lower()
    if verb != "record_outcome" and outcome_code:
        raise ReferralError("outcome_code is allowed only for record_outcome.")
    when = parse_date(on).isoformat()
    updated = deepcopy(record)
    if verb == "acknowledge":
        if updated["status"] != "sent":
            raise ReferralError("Only a sent referral can be acknowledged.")
        updated["status"] = "acknowledged"
        updated["acknowledged_at"] = when
    elif verb == "attend":
        if updated["status"] not in {"sent", "acknowledged"}:
            raise ReferralError("Referral attendance can be recorded only before an outcome.")
        updated["status"] = "attended"
        updated["attended_at"] = when
    elif verb == "record_outcome":
        if updated["status"] != "attended":
            raise ReferralError("An outcome can be recorded only after attendance is recorded.")
        code = str(outcome_code or "").strip().lower()
        if code not in FOLLOWUP_OUTCOME_CODES:
            raise ReferralError("outcome_code is not an approved workflow code.")
        updated["status"] = "outcome_recorded"
        updated["outcome_code"] = code
        updated["outcome_recorded_at"] = when
    else:
        raise ReferralError("action must be acknowledge, attend, or record_outcome.")
    updated["timeline"].append({"event": verb, "actor_id": actor_id.strip(), "at": when,
                                "outcome_code": updated.get("outcome_code") if verb == "record_outcome" else None})
    return updated


def followup_is_overdue(record: dict, as_of: DateLike) -> bool:
    """Overdue is derived only when a real explicit due date was supplied."""
    if not isinstance(record, dict):
        raise ReferralError("record must be a dictionary.")
    if record.get("status") in {"outcome_recorded", "not_needed"} or not record.get("due_on"):
        return False
    return parse_date(as_of) > parse_date(record["due_on"])
