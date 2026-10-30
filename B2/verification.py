"""BE2 Day 1 measurement verification service.

A remeasurement is appended as a new record; it never overwrites the original
CSV/database measurement. BE1's validators and rules engine remain the source
of all flag decisions. This service is synthetic-prototype code only.
"""

import json
import sys
from pathlib import Path
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date
from B2.store import StoreError


ROOT = Path(__file__).resolve().parents[1]
B1_DIR = ROOT / "B1"
if str(B1_DIR) not in sys.path:
    sys.path.insert(0, str(B1_DIR))

ALLOWED_MEASUREMENT_FIELDS = {
    "measurement_date", "weight_kg", "height_cm", "muac_mm", "oedema", "danger_sign"
}
SOURCE_FIELDS = ("weight_kg", "height_cm", "muac_mm", "oedema", "danger_sign", "measurement_date")


class VerificationError(ValueError):
    """Raised for a malformed or out-of-scope remeasurement request."""


def _be1_modules():
    try:
        import data_checks
        import rules_engine
    except ImportError as exc:
        raise VerificationError("BE1 modules are unavailable; install B1 dependencies first.") from exc
    return data_checks, rules_engine


def _age_months(date_of_birth, on):
    if not date_of_birth:
        return None
    born, current = parse_date(date_of_birth), parse_date(on)
    months = (current.year - born.year) * 12 + current.month - born.month
    if current.day < born.day:
        months -= 1
    return months


def build_flag_snapshot(beneficiary, measurement, evaluation, data_check, rule_version, created_at, flag_id=None):
    """Create an immutable flag snapshot grounded in saved source values."""
    reasons = evaluation.get("reasons", [])
    return {
        "flag_id": flag_id or str(uuid4()),
        "beneficiary_id": beneficiary["beneficiary_id"],
        "centre_id": beneficiary["centre_id"],
        "created_at": parse_date(created_at).isoformat(),
        "measurement_id": measurement["measurement_id"],
        "rule_version": rule_version,
        "colour": evaluation.get("colour"),
        "who": evaluation.get("who", "child"),
        "reasons": reasons,
        "issues": data_check.get("issues", []),
        "missing_fields": [item.get("code", "unknown") for item in data_check.get("issues", [])],
        "source_values": {field: measurement.get(field) for field in SOURCE_FIELDS},
        "confidence": evaluation.get("confidence"),
        "confidence_note": evaluation.get("confidence_note", ""),
        "needs_human_verification": True,
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
    }


def remeasure(store, beneficiary_id: str, values: dict, actor_id: str, recorded_at: DateLike, today: DateLike = None):
    """Validate and append a new measurement, then save its new rule evaluation.

    The caller must perform role/centre authorization before calling this.
    Returns both the new measurement record and an immutable flag snapshot.
    """
    beneficiary = store.get_beneficiary(beneficiary_id)
    if beneficiary is None:
        raise VerificationError("Beneficiary not found.")
    if not isinstance(values, dict) or not values:
        raise VerificationError("At least one new measurement field is required.")
    unexpected = set(values) - ALLOWED_MEASUREMENT_FIELDS
    if unexpected:
        raise VerificationError("Unsupported measurement fields: " + ", ".join(sorted(unexpected)))
    if not isinstance(actor_id, str) or not actor_id.strip():
        raise VerificationError("actor_id is required.")

    old_records = store.list_measurements(beneficiary_id)
    if not old_records:
        raise VerificationError("No original measurement exists; cannot create a remeasurement.")
    previous = old_records[-1]
    source_row = dict(beneficiary.get("source_row", beneficiary))
    source_row.update({
        "child_id": beneficiary_id,
        "assigned_worker_id": beneficiary.get("assigned_worker_id", ""),
        "sex": beneficiary.get("sex", source_row.get("sex", "")),
    })
    if beneficiary.get("date_of_birth"):
        source_row["age_months"] = _age_months(beneficiary["date_of_birth"], values.get("measurement_date") or recorded_at)
    merged = dict(source_row)
    merged.update({key: previous.get(key) for key in ALLOWED_MEASUREMENT_FIELDS if key in previous})
    merged.update(values)
    if merged.get("measurement_date"):
        merged["measurement_date"] = parse_date(merged["measurement_date"]).isoformat()
    else:
        merged["measurement_date"] = ""
    merged["measurement_valid"] = True

    data_checks, rules_engine = _be1_modules()
    demo_today = parse_date(today) if today is not None else parse_date(recorded_at)
    check = data_checks.check_child(merged, today=demo_today)
    merged["measurement_valid"] = bool(check.get("measurement_valid"))
    evaluation = rules_engine.evaluate_child(merged, today=demo_today)

    measurement_id = str(uuid4())
    recorded_date = parse_date(recorded_at).isoformat()
    new_record = {
        "measurement_id": measurement_id,
        "beneficiary_id": beneficiary_id,
        "centre_id": beneficiary["centre_id"],
        "source": "remeasurement",
        "parent_measurement_id": previous["measurement_id"],
        "recorded_at": recorded_date,
        "recorded_by": actor_id.strip(),
        "age_months": merged.get("age_months"),
        "measurement_valid": merged["measurement_valid"],
        "data_quality_issues": check.get("issues", []),
        "evaluation": evaluation,
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
        **{field: merged.get(field) for field in SOURCE_FIELDS},
    }
    threshold_path = B1_DIR / "thresholds.json"
    try:
        rule_version = json.loads(threshold_path.read_text(encoding="utf-8")).get("version", "unknown")
    except (OSError, json.JSONDecodeError):
        rule_version = "unknown"
    flag = build_flag_snapshot(
        beneficiary,
        new_record,
        evaluation,
        check,
        rule_version,
        recorded_date,
    )
    save_pair = getattr(store, "save_measurement_and_flag", None)
    if not callable(save_pair):
        raise VerificationError("The configured repository does not support atomic measurement evaluation storage.")
    try:
        save_pair(new_record, flag)
    except StoreError as exc:
        raise VerificationError("Remeasurement and evaluation could not be saved.") from exc
    return {"measurement": new_record, "flag": flag}
