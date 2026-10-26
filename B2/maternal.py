"""Restricted, opt-in maternal follow-up workflow for synthetic adult cases.

Feature access defaults off. This module records only operational follow-up
codes/dates, not clinical details. Under-18 cases are deferred and not stored.
It provides no treatment, pregnancy-termination, or eligibility advice.
"""

from copy import deepcopy
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date

FOLLOWUP_TYPES = frozenset({"routine_check_in", "referral_follow_up", "service_contact"})
FOLLOWUP_STATUSES = frozenset({"pending", "not_reached", "completed", "deferred"})
FOLLOWUP_OUTCOMES = frozenset({"contact_recorded", "appointment_recorded", "follow_up_requested", "other_workflow_result"})


class MaternalFollowupError(ValueError):
    """Raised for a disabled, out-of-scope, or invalid maternal workflow."""


def create_followup(beneficiary_id: str, centre_id: str, age_years: int,
                    followup_type: str, due_on: DateLike, actor_id: str,
                    enabled: bool, allowed_roles, actor_role: str):
    if not enabled:
        raise MaternalFollowupError("Maternal follow-up is disabled until the team approves its scope and permissions.")
    if actor_role not in set(allowed_roles or ()):
        raise MaternalFollowupError("Role is not permitted to access restricted maternal follow-up.")
    if isinstance(age_years, bool) or not isinstance(age_years, int) or age_years < 0 or age_years > 120:
        raise MaternalFollowupError("age_years must be a whole number between 0 and 120.")
    if age_years < 18:
        return {
            "deferred": True,
            "reason_code": "under_18_deferred",
            "record": None,
            "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
        }
    kind = str(followup_type or "").strip().lower()
    if kind not in FOLLOWUP_TYPES:
        raise MaternalFollowupError("followup_type is not an allowed operational code.")
    for name, value in (("beneficiary_id", beneficiary_id), ("centre_id", centre_id), ("actor_id", actor_id)):
        if not isinstance(value, str) or not value.strip():
            raise MaternalFollowupError(f"{name} is required.")
    when = parse_date(due_on).isoformat()
    record = {
        "followup_id": str(uuid4()),
        "beneficiary_id": beneficiary_id.strip(),
        "centre_id": centre_id.strip(),
        "followup_type": kind,
        "due_on": when,
        "status": "pending",
        "created_by": actor_id.strip(),
        "created_at": when,
        "outcome_code": None,
        "updated_by": None,
        "updated_at": None,
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION — RESTRICTED",
        "clinical_advice": False,
    }
    return {"deferred": False, "reason_code": None, "record": record,
            "label": "SYNTHETIC DATA / PROPOSED INTEGRATION — RESTRICTED"}


def update_followup(record: dict, actor_id: str, status: str, on: DateLike,
                    outcome_code: str = ""):
    if not isinstance(record, dict) or record.get("status") not in {"pending", "not_reached"}:
        raise MaternalFollowupError("Only a pending or not-reached follow-up can be updated.")
    if not isinstance(actor_id, str) or not actor_id.strip():
        raise MaternalFollowupError("actor_id is required.")
    new_status = str(status or "").strip().lower()
    if new_status not in {"not_reached", "completed", "deferred"}:
        raise MaternalFollowupError("status must be not_reached, completed, or deferred.")
    code = str(outcome_code or "").strip().lower()
    if new_status == "completed" and code not in FOLLOWUP_OUTCOMES:
        raise MaternalFollowupError("A valid operational outcome_code is required for completion.")
    if new_status != "completed" and code:
        raise MaternalFollowupError("outcome_code is allowed only for completed follow-up.")
    updated = deepcopy(record)
    updated.update({"status": new_status, "outcome_code": code or None,
                    "updated_by": actor_id.strip(), "updated_at": parse_date(on).isoformat()})
    return updated
