"""Human-reviewed access-exception tracker for synthetic workflow cases.

The tracker records coded barriers and their resolution. It never denies a
benefit, makes an eligibility decision, or stores Aadhaar numbers/OTPs.
"""

from copy import deepcopy
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date


EXCEPTION_TYPES = frozenset({
    "pending_mobile_verification",
    "identity_mismatch",
    "document_unavailable",
    "benefit_access_blocked",
    "other_review_needed",
})
EXCEPTION_STATUSES = frozenset({"open", "resolved"})
RESOLUTION_CODES = frozenset({
    "verification_completed",
    "manual_review_completed",
    "records_corrected_by_authorized_process",
    "referred_to_responsible_office",
    "no_barrier_found",
    "other_review_outcome",
})


class AccessExceptionError(ValueError):
    """Raised for an invalid exception-tracker transition."""


def create_exception(beneficiary_id: str, centre_id: str, exception_type: str,
                     opened_by: str, on: DateLike, task_id: str = ""):
    values = (beneficiary_id, centre_id, opened_by)
    if any(not isinstance(v, str) or not v.strip() for v in values):
        raise AccessExceptionError("beneficiary_id, centre_id, and opened_by are required.")
    kind = str(exception_type or "").strip().lower()
    if kind not in EXCEPTION_TYPES:
        raise AccessExceptionError("exception_type is not an allowed coded barrier.")
    when = parse_date(on).isoformat()
    return {
        "exception_id": str(uuid4()),
        "beneficiary_id": beneficiary_id.strip(),
        "centre_id": centre_id.strip(),
        "task_id": str(task_id or "").strip(),
        "exception_type": kind,
        "status": "open",
        "opened_by": opened_by.strip(),
        "opened_at": when,
        "resolution_code": None,
        "resolved_by": None,
        "resolved_at": None,
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
        "access_decision": "human review only; this record does not deny access or determine eligibility",
    }


def resolve_exception(record: dict, resolved_by: str, resolution_code: str, on: DateLike):
    if not isinstance(record, dict) or record.get("status") != "open":
        raise AccessExceptionError("Only an open access exception can be resolved.")
    if not isinstance(resolved_by, str) or not resolved_by.strip():
        raise AccessExceptionError("resolved_by is required.")
    code = str(resolution_code or "").strip().lower()
    if code not in RESOLUTION_CODES:
        raise AccessExceptionError("resolution_code is not an allowed coded outcome.")
    updated = deepcopy(record)
    updated.update({
        "status": "resolved",
        "resolution_code": code,
        "resolved_by": resolved_by.strip(),
        "resolved_at": parse_date(on).isoformat(),
    })
    return updated


def exception_counts(records: list):
    if not isinstance(records, list):
        raise AccessExceptionError("records must be a list.")
    by_status = {status: 0 for status in sorted(EXCEPTION_STATUSES)}
    by_type = {kind: 0 for kind in sorted(EXCEPTION_TYPES)}
    for record in records:
        if not isinstance(record, dict) or record.get("status") not in EXCEPTION_STATUSES:
            raise AccessExceptionError("record has an invalid status.")
        by_status[record["status"]] += 1
        kind = record.get("exception_type")
        if kind not in EXCEPTION_TYPES:
            raise AccessExceptionError("record has an invalid exception type.")
        by_type[kind] += 1
    return {"total": len(records), "by_status": by_status, "by_type": by_type}
